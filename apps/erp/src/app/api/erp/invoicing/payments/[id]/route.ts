import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

interface InvoicePayment {
  id: number;
  invoice_id: number;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string;
  reference: string;
  notes: string;
  recorded_by: number;
}

// GET /api/erp/invoicing/payments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'invoicing', 'read');
    const { id } = await params;
    const paymentId = parseInt(id);

    const payment = await queryOne<InvoicePayment>(`
      SELECT ip.*, i.invoice_number, c.name as company_name, u.display_name as recorded_by_name
      FROM inv_invoice_payments ip
      JOIN inv_invoices i ON ip.invoice_id = i.id
      LEFT JOIN crm_companies c ON i.company_id = c.id
      LEFT JOIN users u ON ip.recorded_by = u.id
      WHERE ip.id = ?
    `, [paymentId]);

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error('Get payment error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/invoicing/payments/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'invoicing', 'write');
    const { id } = await params;
    const paymentId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<InvoicePayment>('SELECT * FROM inv_invoice_payments WHERE id = ?', [paymentId]);
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const allowedFields = ['amount', 'payment_date', 'payment_method', 'reference', 'notes'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(paymentId);
    await query(`UPDATE inv_invoice_payments SET ${updates.join(', ')} WHERE id = ?`, values);

    // Update invoice paid amount and status
    await query(`
      UPDATE inv_invoices i SET
        paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM inv_invoice_payments WHERE invoice_id = i.id),
        status = CASE
          WHEN (SELECT COALESCE(SUM(amount), 0) FROM inv_invoice_payments WHERE invoice_id = i.id) >= i.total_amount THEN 'paid'
          WHEN (SELECT COALESCE(SUM(amount), 0) FROM inv_invoice_payments WHERE invoice_id = i.id) > 0 THEN 'partial'
          ELSE i.status
        END
      WHERE i.id = ?
    `, [existing.invoice_id]);

    await logERPAction({
      user_id: auth.userId,
      module: 'invoicing',
      action: 'update',
      entity_type: 'payment',
      entity_id: paymentId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<InvoicePayment>('SELECT * FROM inv_invoice_payments WHERE id = ?', [paymentId]);
    return NextResponse.json({ success: true, payment: updated });
  } catch (error: any) {
    console.error('Update payment error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/invoicing/payments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'invoicing', 'delete');
    const { id } = await params;
    const paymentId = parseInt(id);

    const existing = await queryOne<InvoicePayment>('SELECT * FROM inv_invoice_payments WHERE id = ?', [paymentId]);
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    await query('DELETE FROM inv_invoice_payments WHERE id = ?', [paymentId]);

    // Update invoice paid amount and status
    await query(`
      UPDATE inv_invoices i SET
        paid_amount = (SELECT COALESCE(SUM(amount), 0) FROM inv_invoice_payments WHERE invoice_id = i.id),
        status = CASE
          WHEN (SELECT COALESCE(SUM(amount), 0) FROM inv_invoice_payments WHERE invoice_id = i.id) >= i.total_amount THEN 'paid'
          WHEN (SELECT COALESCE(SUM(amount), 0) FROM inv_invoice_payments WHERE invoice_id = i.id) > 0 THEN 'partial'
          ELSE 'sent'
        END
      WHERE i.id = ?
    `, [existing.invoice_id]);

    await logERPAction({
      user_id: auth.userId,
      module: 'invoicing',
      action: 'delete',
      entity_type: 'payment',
      entity_id: paymentId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete payment error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

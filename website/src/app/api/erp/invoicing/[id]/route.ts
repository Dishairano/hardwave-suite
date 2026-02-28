import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { Invoice } from '@/lib/erp-types';

// GET /api/erp/invoicing/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'invoicing', 'read');
    const { id } = await params;
    const invoiceId = parseInt(id);

    const invoice = await queryOne<Invoice>(`
      SELECT i.*, c.name as company_name, u.display_name as created_by_name
      FROM inv_invoices i
      LEFT JOIN crm_companies c ON i.company_id = c.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = ?
    `, [invoiceId]);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get invoice lines
    const lines = await query<any[]>(`
      SELECT il.*, p.name as product_name
      FROM inv_invoice_lines il
      LEFT JOIN inv_products p ON il.product_id = p.id
      WHERE il.invoice_id = ?
      ORDER BY il.line_number
    `, [invoiceId]);

    // Get payments
    const payments = await query<any[]>(`
      SELECT ip.*, u.display_name as recorded_by_name
      FROM inv_invoice_payments ip
      LEFT JOIN users u ON ip.recorded_by = u.id
      WHERE ip.invoice_id = ?
      ORDER BY ip.payment_date DESC
    `, [invoiceId]);

    return NextResponse.json({ invoice, lines, payments });
  } catch (error: any) {
    console.error('Get invoice error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/invoicing/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'invoicing', 'write');
    const { id } = await params;
    const invoiceId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<Invoice>('SELECT * FROM inv_invoices WHERE id = ?', [invoiceId]);
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (existing.status === 'paid') {
      return NextResponse.json({ error: 'Cannot modify a paid invoice' }, { status: 400 });
    }

    const allowedFields = [
      'company_id', 'contact_id', 'invoice_date', 'due_date', 'status',
      'subtotal', 'tax_amount', 'total_amount', 'currency', 'notes',
      'terms', 'billing_address', 'shipping_address'
    ];
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

    values.push(invoiceId);
    await query(`UPDATE inv_invoices SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'invoicing',
      action: 'update',
      entity_type: 'invoice',
      entity_id: invoiceId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<Invoice>('SELECT * FROM inv_invoices WHERE id = ?', [invoiceId]);
    return NextResponse.json({ success: true, invoice: updated });
  } catch (error: any) {
    console.error('Update invoice error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/invoicing/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'invoicing', 'delete');
    const { id } = await params;
    const invoiceId = parseInt(id);

    const existing = await queryOne<Invoice>('SELECT * FROM inv_invoices WHERE id = ?', [invoiceId]);
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Can only delete draft invoices' }, { status: 400 });
    }

    await query('DELETE FROM inv_invoices WHERE id = ?', [invoiceId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'invoicing',
      action: 'delete',
      entity_type: 'invoice',
      entity_id: invoiceId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete invoice error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

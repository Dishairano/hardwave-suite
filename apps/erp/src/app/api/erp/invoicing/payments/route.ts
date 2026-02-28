import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { ERPPayment } from '@/lib/erp-types';

// GET /api/erp/invoicing/payments - List payments
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'invoicing', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const invoiceId = searchParams.get('invoice_id');
    const paymentMethod = searchParams.get('payment_method');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (invoiceId) {
      whereClause += ' AND p.invoice_id = ?';
      params.push(parseInt(invoiceId));
    }

    if (paymentMethod) {
      whereClause += ' AND p.payment_method = ?';
      params.push(paymentMethod);
    }

    // Get total count and sum
    const countResult = await queryOne<{ total: number; total_received: number }>(
      `SELECT COUNT(*) as total, SUM(p.amount) as total_received FROM erp_payments p ${whereClause}`, params
    );
    const total = countResult?.total || 0;
    const totalReceived = countResult?.total_received || 0;

    const sql = `
      SELECT
        p.*,
        i.invoice_number,
        co.name as company_name,
        u.display_name as received_by_name
      FROM erp_payments p
      JOIN erp_invoices i ON p.invoice_id = i.id
      LEFT JOIN crm_companies co ON i.company_id = co.id
      LEFT JOIN users u ON p.received_by = u.id
      ${whereClause}
      ORDER BY p.payment_date DESC LIMIT ? OFFSET ?
    `;

    const payments = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json({
      ...buildPaginationResponse(payments, total, page, limit),
      summary: { totalReceived },
    });
  } catch (error: any) {
    console.error('Get payments error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/invoicing/payments - Record payment
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'invoicing', 'write');
    const body = await request.json();

    const {
      invoice_id,
      amount,
      payment_date,
      payment_method = 'bank_transfer',
      reference,
      notes,
    } = body;

    if (!invoice_id || !amount || !payment_date) {
      return NextResponse.json(
        { error: 'Invoice, amount, and payment date are required' },
        { status: 400 }
      );
    }

    // Get invoice details
    const invoice = await queryOne<any>(
      'SELECT * FROM erp_invoices WHERE id = ?',
      [invoice_id]
    );

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get total paid so far
    const paidResult = await queryOne<{ total_paid: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total_paid FROM erp_payments WHERE invoice_id = ?
    `, [invoice_id]);

    const totalPaid = (paidResult?.total_paid || 0) + parseFloat(amount);

    if (totalPaid > invoice.total_amount) {
      return NextResponse.json(
        { error: 'Payment amount exceeds remaining balance' },
        { status: 400 }
      );
    }

    // Create payment
    const result = await query<any>(`
      INSERT INTO erp_payments (
        invoice_id, amount, payment_date, payment_method, reference, notes, received_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice_id,
      amount,
      payment_date,
      payment_method,
      reference || null,
      notes || null,
      auth.userId,
    ]);

    const paymentId = result.insertId;

    // Update invoice status
    let newStatus = invoice.status;
    if (totalPaid >= invoice.total_amount) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'partial';
    }

    if (newStatus !== invoice.status) {
      await query('UPDATE erp_invoices SET status = ? WHERE id = ?', [newStatus, invoice_id]);
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'invoicing',
      action: 'payment',
      entity_type: 'payment',
      entity_id: paymentId,
      new_values: { invoice_id, amount, payment_method },
      ip_address: getClientIP(request),
    });

    const payment = await queryOne<ERPPayment>(
      'SELECT * FROM erp_payments WHERE id = ?',
      [paymentId]
    );

    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (error: any) {
    console.error('Record payment error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

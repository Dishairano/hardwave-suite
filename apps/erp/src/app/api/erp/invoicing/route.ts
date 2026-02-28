import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getNextSequence, getClientIP, buildPaginationResponse, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { ERPInvoice } from '@/lib/erp-types';

// GET /api/erp/invoicing - List invoices
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'invoicing', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    const projectId = searchParams.get('project_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }

    if (customerId) {
      whereClause += ' AND i.customer_id = ?';
      params.push(parseInt(customerId));
    }

    if (projectId) {
      whereClause += ' AND i.project_id = ?';
      params.push(parseInt(projectId));
    }

    if (dateFrom) {
      whereClause += ' AND i.issue_date >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND i.issue_date <= ?';
      params.push(dateTo);
    }

    // Get total count and sums
    const countResult = await queryOne<{ total: number; total_invoiced: number }>(
      `SELECT COUNT(*) as total, SUM(i.total_amount) as total_invoiced FROM erp_invoices i ${whereClause}`, params
    );
    const total = countResult?.total || 0;
    const totalInvoiced = countResult?.total_invoiced || 0;

    const sql = `
      SELECT
        i.*,
        co.name as company_name,
        p.name as project_name,
        u.display_name as created_by_name
      FROM erp_invoices i
      LEFT JOIN crm_companies co ON i.company_id = co.id
      LEFT JOIN prj_projects p ON i.project_id = p.id
      JOIN users u ON i.created_by = u.id
      ${whereClause}
      ORDER BY i.issue_date DESC, i.created_at DESC LIMIT ? OFFSET ?
    `;

    const invoices = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json({
      ...buildPaginationResponse(invoices, total, page, limit),
      summary: { totalInvoiced },
    });
  } catch (error: any) {
    console.error('Get invoices error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/invoicing - Create invoice
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'invoicing', 'write');
    const body = await request.json();

    const {
      customer_id,
      project_id,
      invoice_date,
      due_date,
      currency = 'USD',
      notes,
      terms,
      items = [],
    } = body;

    if (!customer_id || !invoice_date || !due_date) {
      return NextResponse.json(
        { error: 'Customer, invoice date, and due date are required' },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    const invoiceNumber = await getNextSequence('invoice');

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const lineTotal = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);
      subtotal += lineTotal;
      if (item.tax_rate) {
        taxAmount += lineTotal * (parseFloat(item.tax_rate) / 100);
      }
    }

    const totalAmount = subtotal + taxAmount;

    // Create invoice
    const result = await query<any>(`
      INSERT INTO erp_invoices (
        invoice_number, customer_id, project_id, invoice_date, due_date,
        currency, subtotal, tax_amount, total_amount, notes, terms,
        status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `, [
      invoiceNumber,
      customer_id,
      project_id || null,
      invoice_date,
      due_date,
      currency,
      subtotal,
      taxAmount,
      totalAmount,
      notes || null,
      terms || null,
      auth.userId,
    ]);

    const invoiceId = result.insertId;

    // Create invoice items
    for (const item of items) {
      const lineTotal = (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);
      const lineTax = item.tax_rate ? lineTotal * (parseFloat(item.tax_rate) / 100) : 0;

      await query(`
        INSERT INTO erp_invoice_items (
          invoice_id, description, quantity, unit_price, tax_rate, line_total
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        item.description,
        parseFloat(item.quantity) || 1,
        parseFloat(item.unit_price) || 0,
        parseFloat(item.tax_rate) || 0,
        lineTotal + lineTax,
      ]);
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'invoicing',
      action: 'create',
      entity_type: 'invoice',
      entity_id: invoiceId,
      new_values: { invoice_number: invoiceNumber, total_amount: totalAmount },
      ip_address: getClientIP(request),
    });

    // Fetch complete invoice
    const invoice = await queryOne<ERPInvoice>(`
      SELECT i.*, c.name as customer_name
      FROM erp_invoices i
      LEFT JOIN crm_companies c ON i.customer_id = c.id
      WHERE i.id = ?
    `, [invoiceId]);

    const invoiceItems = await query<any[]>(
      'SELECT * FROM erp_invoice_items WHERE invoice_id = ?',
      [invoiceId]
    );

    return NextResponse.json({
      success: true,
      invoice: { ...invoice, items: invoiceItems },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create invoice error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

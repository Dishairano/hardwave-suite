import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { InvSupplier } from '@/lib/erp-types';

// GET /api/erp/inventory/suppliers - List suppliers
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('is_active');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.email LIKE ? OR s.contact_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (isActive !== null && isActive !== undefined) {
      whereClause += ' AND s.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM inv_suppliers s${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Main query
    const sql = `
      SELECT
        s.*,
        (SELECT COUNT(*) FROM inv_purchase_orders WHERE supplier_id = s.id) as order_count
      FROM inv_suppliers s
      ${whereClause} ORDER BY s.name ASC LIMIT ? OFFSET ?
    `;
    const suppliers = await query<any[]>(sql, [...params, limit, offset]);

    const parsedSuppliers = suppliers.map(supplier => ({
      ...supplier,
      payment_terms: parseJsonField(supplier.payment_terms, {}),
    }));

    return NextResponse.json(buildPaginationResponse(parsedSuppliers, total, page, limit));
  } catch (error: any) {
    console.error('Get suppliers error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/inventory/suppliers - Create supplier
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const body = await request.json();

    const {
      code,
      name,
      contact_name,
      email,
      phone,
      website,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      payment_terms = {},
      notes,
      is_active = true,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    // Generate code if not provided
    let supplierCode = code;
    if (!supplierCode) {
      const lastSupplier = await queryOne<{ code: string }>(
        `SELECT code FROM inv_suppliers ORDER BY id DESC LIMIT 1`
      );
      const lastNum = lastSupplier?.code
        ? parseInt(lastSupplier.code.replace('SUP', ''))
        : 0;
      supplierCode = `SUP${String(lastNum + 1).padStart(4, '0')}`;
    }

    const result = await query<any>(`
      INSERT INTO inv_suppliers (
        code, name, contact_name, email, phone, website,
        address_line1, address_line2, city, state, postal_code, country,
        payment_terms, notes, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      supplierCode,
      name,
      contact_name || null,
      email || null,
      phone || null,
      website || null,
      address_line1 || null,
      address_line2 || null,
      city || null,
      state || null,
      postal_code || null,
      country || null,
      JSON.stringify(payment_terms),
      notes || null,
      is_active,
    ]);

    const supplierId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'create',
      entity_type: 'supplier',
      entity_id: supplierId,
      new_values: { code: supplierCode, name },
      ip_address: getClientIP(request),
    });

    const supplier = await queryOne<InvSupplier>(
      'SELECT * FROM inv_suppliers WHERE id = ?',
      [supplierId]
    );

    return NextResponse.json({ success: true, supplier }, { status: 201 });
  } catch (error: any) {
    console.error('Create supplier error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

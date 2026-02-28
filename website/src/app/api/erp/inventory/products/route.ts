import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { InvProduct } from '@/lib/erp-types';

// GET /api/erp/inventory/products - List products
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('category_id');
    const lowStock = searchParams.get('low_stock') === 'true';

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (categoryId) {
      whereClause += ' AND p.category_id = ?';
      params.push(parseInt(categoryId));
    }

    if (lowStock) {
      whereClause += ' AND (SELECT COALESCE(SUM(quantity), 0) FROM inv_stock WHERE product_id = p.id) <= p.reorder_point';
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM inv_products p${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Main query
    const sql = `
      SELECT
        p.*,
        c.name as category_name,
        (SELECT COALESCE(SUM(quantity), 0) FROM inv_stock WHERE product_id = p.id) as total_stock
      FROM inv_products p
      LEFT JOIN inv_categories c ON p.category_id = c.id
      ${whereClause} ORDER BY p.name ASC LIMIT ? OFFSET ?
    `;
    const products = await query<any[]>(sql, [...params, limit, offset]);

    const parsedProducts = products.map(product => ({
      ...product,
      attributes: parseJsonField(product.attributes, {}),
    }));

    return NextResponse.json(buildPaginationResponse(parsedProducts, total, page, limit));
  } catch (error: any) {
    console.error('Get products error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/inventory/products - Create product
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const body = await request.json();

    const {
      sku,
      name,
      description,
      category_id,
      unit_of_measure = 'each',
      cost_price,
      selling_price,
      reorder_point = 0,
      reorder_quantity = 0,
      weight,
      weight_unit,
      dimensions,
      barcode,
      is_active = true,
      attributes = {},
    } = body;

    if (!sku || !name) {
      return NextResponse.json({ error: 'SKU and name are required' }, { status: 400 });
    }

    // Check for duplicate SKU
    const existing = await queryOne<{ id: number }>('SELECT id FROM inv_products WHERE sku = ?', [sku]);
    if (existing) {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO inv_products (
        sku, name, description, category_id, unit_of_measure,
        cost_price, selling_price, reorder_point, reorder_quantity,
        weight, weight_unit, dimensions, barcode, is_active, attributes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      sku,
      name,
      description || null,
      category_id || null,
      unit_of_measure,
      cost_price || 0,
      selling_price || 0,
      reorder_point,
      reorder_quantity,
      weight || null,
      weight_unit || null,
      dimensions || null,
      barcode || null,
      is_active,
      JSON.stringify(attributes),
    ]);

    const productId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'create',
      entity_type: 'product',
      entity_id: productId,
      new_values: { sku, name },
      ip_address: getClientIP(request),
    });

    const product = await queryOne<InvProduct>('SELECT * FROM inv_products WHERE id = ?', [productId]);

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    console.error('Create product error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

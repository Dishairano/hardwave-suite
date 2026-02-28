import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/inventory/stock - Get stock levels
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const productId = searchParams.get('product_id');
    const locationId = searchParams.get('location_id');
    const lowStock = searchParams.get('low_stock') === 'true';

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (productId) {
      whereClause += ' AND s.product_id = ?';
      params.push(parseInt(productId));
    }

    if (locationId) {
      whereClause += ' AND s.location_id = ?';
      params.push(parseInt(locationId));
    }

    if (lowStock) {
      whereClause += ' AND s.quantity <= p.reorder_point';
    }

    // Get total count (JOIN inv_products needed for low_stock filter on p.reorder_point)
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM inv_stock s JOIN inv_products p ON s.product_id = p.id${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Main query
    const sql = `
      SELECT
        s.*,
        p.sku,
        p.name as product_name,
        p.reorder_point,
        p.unit_of_measure,
        l.name as location_name
      FROM inv_stock s
      JOIN inv_products p ON s.product_id = p.id
      LEFT JOIN inv_locations l ON s.location_id = l.id
      ${whereClause} ORDER BY p.name, l.name ASC LIMIT ? OFFSET ?
    `;
    const stock = await query<any[]>(sql, [...params, limit, offset]);

    // Get summary stats
    const summaryResult = await queryOne<any>(`
      SELECT
        COUNT(DISTINCT product_id) as unique_products,
        SUM(quantity) as total_quantity,
        (SELECT COUNT(*) FROM inv_stock s2 JOIN inv_products p2 ON s2.product_id = p2.id WHERE s2.quantity <= p2.reorder_point) as low_stock_count
      FROM inv_stock
    `);

    return NextResponse.json({
      ...buildPaginationResponse(stock, total, page, limit),
      summary: {
        uniqueProducts: summaryResult?.unique_products || 0,
        totalQuantity: summaryResult?.total_quantity || 0,
        lowStockCount: summaryResult?.low_stock_count || 0,
      },
    });
  } catch (error: any) {
    console.error('Get stock error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/inventory/stock - Adjust stock
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const body = await request.json();

    const {
      product_id,
      location_id,
      adjustment_type,
      quantity,
      reference,
      notes,
    } = body;

    if (!product_id || !adjustment_type || quantity === undefined) {
      return NextResponse.json(
        { error: 'Product, adjustment type, and quantity are required' },
        { status: 400 }
      );
    }

    const adjustmentTypes = ['in', 'out', 'adjustment', 'transfer'];
    if (!adjustmentTypes.includes(adjustment_type)) {
      return NextResponse.json({ error: 'Invalid adjustment type' }, { status: 400 });
    }

    // Get or create stock record
    let stock = await queryOne<{ id: number; quantity: number }>(`
      SELECT id, quantity FROM inv_stock WHERE product_id = ? AND location_id = ?
    `, [product_id, location_id || null]);

    const previousQuantity = stock?.quantity || 0;
    let newQuantity: number;

    switch (adjustment_type) {
      case 'in':
        newQuantity = previousQuantity + Math.abs(quantity);
        break;
      case 'out':
        newQuantity = previousQuantity - Math.abs(quantity);
        if (newQuantity < 0) {
          return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 });
        }
        break;
      case 'adjustment':
        newQuantity = quantity; // Set to exact value
        break;
      default:
        newQuantity = previousQuantity;
    }

    if (stock) {
      await query('UPDATE inv_stock SET quantity = ?, updated_at = NOW() WHERE id = ?', [newQuantity, stock.id]);
    } else {
      const result = await query<any>(`
        INSERT INTO inv_stock (product_id, location_id, quantity) VALUES (?, ?, ?)
      `, [product_id, location_id || null, newQuantity]);
      stock = { id: result.insertId, quantity: newQuantity };
    }

    // Log movement
    await query(`
      INSERT INTO inv_stock_movements (
        product_id, location_id, movement_type, quantity,
        reference_type, reference_id, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      product_id,
      location_id || null,
      adjustment_type,
      adjustment_type === 'out' ? -Math.abs(quantity) : Math.abs(quantity),
      'manual',
      null,
      notes || null,
      auth.userId,
    ]);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'stock_adjustment',
      entity_type: 'stock',
      entity_id: stock.id,
      old_values: { quantity: previousQuantity },
      new_values: { quantity: newQuantity, adjustment_type },
      ip_address: getClientIP(request),
    });

    return NextResponse.json({
      success: true,
      stock: { product_id, location_id, quantity: newQuantity },
    });
  } catch (error: any) {
    console.error('Adjust stock error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

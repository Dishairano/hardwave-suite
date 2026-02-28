import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { InvProduct } from '@/lib/erp-types';

// GET /api/erp/inventory/products/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { id } = await params;
    const productId = parseInt(id);

    const product = await queryOne<InvProduct>(`
      SELECT p.*, c.name as category_name, s.name as supplier_name
      FROM inv_products p
      LEFT JOIN inv_categories c ON p.category_id = c.id
      LEFT JOIN inv_suppliers s ON p.default_supplier_id = s.id
      WHERE p.id = ?
    `, [productId]);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get stock levels by location
    const stockLevels = await query<any[]>(`
      SELECT sl.*, l.name as location_name
      FROM inv_stock_levels sl
      JOIN inv_locations l ON sl.location_id = l.id
      WHERE sl.product_id = ?
    `, [productId]);

    // Get recent movements
    const movements = await query<any[]>(`
      SELECT sm.*, l.name as location_name, u.display_name as user_name
      FROM inv_stock_movements sm
      LEFT JOIN inv_locations l ON sm.location_id = l.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.product_id = ?
      ORDER BY sm.created_at DESC
      LIMIT 20
    `, [productId]);

    return NextResponse.json({ product, stockLevels, movements });
  } catch (error: any) {
    console.error('Get product error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/inventory/products/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const { id } = await params;
    const productId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<InvProduct>('SELECT * FROM inv_products WHERE id = ?', [productId]);
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const allowedFields = [
      'sku', 'name', 'description', 'category_id', 'unit_of_measure', 'cost_price',
      'sell_price', 'currency', 'min_stock_level', 'reorder_point', 'reorder_quantity',
      'default_supplier_id', 'barcode', 'weight', 'dimensions', 'is_active', 'tags'
    ];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'tags' || field === 'dimensions') {
          values.push(JSON.stringify(body[field]));
        } else {
          values.push(body[field]);
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(productId);
    await query(`UPDATE inv_products SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'update',
      entity_type: 'product',
      entity_id: productId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<InvProduct>('SELECT * FROM inv_products WHERE id = ?', [productId]);
    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    console.error('Update product error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/inventory/products/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'delete');
    const { id } = await params;
    const productId = parseInt(id);

    const existing = await queryOne<InvProduct>('SELECT * FROM inv_products WHERE id = ?', [productId]);
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check for stock
    const stock = await queryOne<{ total: number }>('SELECT SUM(quantity) as total FROM inv_stock_levels WHERE product_id = ?', [productId]);
    if (stock && stock.total > 0) {
      return NextResponse.json({ error: 'Cannot delete product with stock on hand' }, { status: 400 });
    }

    await query('DELETE FROM inv_products WHERE id = ?', [productId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'delete',
      entity_type: 'product',
      entity_id: productId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete product error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

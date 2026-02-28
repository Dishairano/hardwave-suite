import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

interface StockLevel {
  id: number;
  product_id: number;
  location_id: number;
  quantity: number;
  reserved_quantity: number;
  last_counted_at: string;
}

// GET /api/erp/inventory/stock/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { id } = await params;
    const stockId = parseInt(id);

    const stock = await queryOne<StockLevel>(`
      SELECT sl.*, p.sku, p.name as product_name, l.name as location_name
      FROM inv_stock_levels sl
      JOIN inv_products p ON sl.product_id = p.id
      JOIN inv_locations l ON sl.location_id = l.id
      WHERE sl.id = ?
    `, [stockId]);

    if (!stock) {
      return NextResponse.json({ error: 'Stock record not found' }, { status: 404 });
    }

    // Get recent movements for this stock record
    const movements = await query<any[]>(`
      SELECT sm.*, u.display_name as user_name
      FROM inv_stock_movements sm
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.product_id = ? AND sm.location_id = ?
      ORDER BY sm.created_at DESC
      LIMIT 20
    `, [stock.product_id, stock.location_id]);

    return NextResponse.json({ stock, movements });
  } catch (error: any) {
    console.error('Get stock error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/inventory/stock/[id] - Adjust stock (creates movement record)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const { id } = await params;
    const stockId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<StockLevel>('SELECT * FROM inv_stock_levels WHERE id = ?', [stockId]);
    if (!existing) {
      return NextResponse.json({ error: 'Stock record not found' }, { status: 404 });
    }

    const allowedFields = ['quantity', 'reserved_quantity', 'last_counted_at'];
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

    // If quantity changed, create a movement record
    if (body.quantity !== undefined && body.quantity !== existing.quantity) {
      const difference = body.quantity - existing.quantity;
      await query(`
        INSERT INTO inv_stock_movements (product_id, location_id, movement_type, quantity, reference, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        existing.product_id,
        existing.location_id,
        difference > 0 ? 'adjustment_in' : 'adjustment_out',
        Math.abs(difference),
        body.reference || 'Manual adjustment',
        body.notes || null,
        auth.userId,
      ]);
    }

    values.push(stockId);
    await query(`UPDATE inv_stock_levels SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'update',
      entity_type: 'stock_level',
      entity_id: stockId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<StockLevel>('SELECT * FROM inv_stock_levels WHERE id = ?', [stockId]);
    return NextResponse.json({ success: true, stock: updated });
  } catch (error: any) {
    console.error('Update stock error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/inventory/stock/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'delete');
    const { id } = await params;
    const stockId = parseInt(id);

    const existing = await queryOne<StockLevel>('SELECT * FROM inv_stock_levels WHERE id = ?', [stockId]);
    if (!existing) {
      return NextResponse.json({ error: 'Stock record not found' }, { status: 404 });
    }

    if (existing.quantity > 0) {
      return NextResponse.json({ error: 'Cannot delete stock record with quantity on hand' }, { status: 400 });
    }

    await query('DELETE FROM inv_stock_levels WHERE id = ?', [stockId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'delete',
      entity_type: 'stock_level',
      entity_id: stockId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete stock error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

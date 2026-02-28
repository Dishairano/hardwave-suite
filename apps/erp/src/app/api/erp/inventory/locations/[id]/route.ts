import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/inventory/locations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { id } = await params;

    const location = await queryOne<any>('SELECT * FROM inv_locations WHERE id = ?', [parseInt(id)]);
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const stock = await query<any[]>(`
      SELECT s.*, p.sku, p.name as product_name
      FROM inv_stock s
      JOIN inv_products p ON s.product_id = p.id
      WHERE s.location_id = ?
      ORDER BY p.name
    `, [parseInt(id)]);

    return NextResponse.json({ location, stock });
  } catch (error: any) {
    console.error('Get location error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/inventory/locations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const { id } = await params;
    const locationId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM inv_locations WHERE id = ?', [locationId]);
    if (!existing) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'code', 'address', 'city', 'state', 'country', 'is_active'];
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

    values.push(locationId);
    await query(`UPDATE inv_locations SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'update',
      entity_type: 'location',
      entity_id: locationId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>('SELECT * FROM inv_locations WHERE id = ?', [locationId]);
    return NextResponse.json({ success: true, location: updated });
  } catch (error: any) {
    console.error('Update location error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/inventory/locations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'delete');
    const { id } = await params;
    const locationId = parseInt(id);

    const existing = await queryOne<any>('SELECT * FROM inv_locations WHERE id = ?', [locationId]);
    if (!existing) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const stock = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM inv_stock WHERE location_id = ? AND quantity > 0', [locationId]);
    if (stock && stock.count > 0) {
      return NextResponse.json({ error: 'Cannot delete location with stock' }, { status: 400 });
    }

    await query('DELETE FROM inv_locations WHERE id = ?', [locationId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'delete',
      entity_type: 'location',
      entity_id: locationId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete location error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

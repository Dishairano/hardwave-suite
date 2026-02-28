import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/inventory/locations
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'inventory', 'read');

    const locations = await query<any[]>(`
      SELECT l.*,
        (SELECT COUNT(DISTINCT product_id) FROM inv_stock WHERE location_id = l.id) as product_count,
        (SELECT COALESCE(SUM(quantity), 0) FROM inv_stock WHERE location_id = l.id) as total_quantity
      FROM inv_locations l
      ORDER BY l.name
    `);

    return NextResponse.json({ locations });
  } catch (error: any) {
    console.error('Get locations error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/inventory/locations
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const body = await request.json();

    const { name, code, address, city, state, country, is_active = true } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO inv_locations (name, code, address, city, state, country, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, code || null, address || null, city || null, state || null, country || null, is_active]);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'create',
      entity_type: 'location',
      entity_id: result.insertId,
      new_values: { name, code },
      ip_address: getClientIP(request),
    });

    const location = await queryOne<any>('SELECT * FROM inv_locations WHERE id = ?', [result.insertId]);

    return NextResponse.json({ success: true, location }, { status: 201 });
  } catch (error: any) {
    console.error('Create location error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/inventory/categories
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'inventory', 'read');

    const categories = await query<any[]>(`
      SELECT c.*, p.name as parent_name,
        (SELECT COUNT(*) FROM inv_products WHERE category_id = c.id) as product_count
      FROM inv_categories c
      LEFT JOIN inv_categories p ON c.parent_id = p.id
      ORDER BY c.name
    `);

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Get categories error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/inventory/categories
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const body = await request.json();

    const { name, description, parent_id, is_active = true } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO inv_categories (name, description, parent_id, is_active)
      VALUES (?, ?, ?, ?)
    `, [name, description || null, parent_id || null, is_active]);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'create',
      entity_type: 'category',
      entity_id: result.insertId,
      new_values: { name },
      ip_address: getClientIP(request),
    });

    const category = await queryOne<any>('SELECT * FROM inv_categories WHERE id = ?', [result.insertId]);

    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error: any) {
    console.error('Create category error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

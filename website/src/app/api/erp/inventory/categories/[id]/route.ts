import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/inventory/categories/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { id } = await params;

    const category = await queryOne<any>(`
      SELECT c.*, p.name as parent_name
      FROM inv_categories c
      LEFT JOIN inv_categories p ON c.parent_id = p.id
      WHERE c.id = ?
    `, [parseInt(id)]);

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const products = await query<any[]>(`
      SELECT id, sku, name, is_active FROM inv_products WHERE category_id = ? ORDER BY name LIMIT 50
    `, [parseInt(id)]);

    const children = await query<any[]>('SELECT * FROM inv_categories WHERE parent_id = ?', [parseInt(id)]);

    return NextResponse.json({ category, products, children });
  } catch (error: any) {
    console.error('Get category error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/inventory/categories/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const { id } = await params;
    const categoryId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM inv_categories WHERE id = ?', [categoryId]);
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'description', 'parent_id', 'is_active'];
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

    values.push(categoryId);
    await query(`UPDATE inv_categories SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'update',
      entity_type: 'category',
      entity_id: categoryId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>('SELECT * FROM inv_categories WHERE id = ?', [categoryId]);
    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    console.error('Update category error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/inventory/categories/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'delete');
    const { id } = await params;
    const categoryId = parseInt(id);

    const existing = await queryOne<any>('SELECT * FROM inv_categories WHERE id = ?', [categoryId]);
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const products = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM inv_products WHERE category_id = ?', [categoryId]);
    if (products && products.count > 0) {
      return NextResponse.json({ error: 'Cannot delete category with products' }, { status: 400 });
    }

    const children = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM inv_categories WHERE parent_id = ?', [categoryId]);
    if (children && children.count > 0) {
      return NextResponse.json({ error: 'Cannot delete category with subcategories' }, { status: 400 });
    }

    await query('DELETE FROM inv_categories WHERE id = ?', [categoryId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'delete',
      entity_type: 'category',
      entity_id: categoryId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete category error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

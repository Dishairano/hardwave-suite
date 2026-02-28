import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/finance/categories - List expense categories
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'finance', 'read');

    const categories = await query<any[]>(`
      SELECT
        c.*,
        a.code as gl_account_code,
        a.name as gl_account_name,
        (SELECT COUNT(*) FROM fin_expenses WHERE category_id = c.id) as expense_count,
        (SELECT COALESCE(SUM(amount), 0) FROM fin_expenses WHERE category_id = c.id AND status = 'approved') as total_amount
      FROM fin_expense_categories c
      LEFT JOIN fin_accounts a ON c.account_id = a.id
      WHERE c.is_active = 1
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

// POST /api/erp/finance/categories - Create expense category
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const body = await request.json();

    const { name, description, account_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO fin_expense_categories (name, description, account_id, is_active)
      VALUES (?, ?, ?, 1)
    `, [name, description || null, account_id || null]);

    const categoryId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'create',
      entity_type: 'expense_category',
      entity_id: categoryId,
      new_values: { name },
      ip_address: getClientIP(request),
    });

    const category = await queryOne<any>(
      'SELECT * FROM fin_expense_categories WHERE id = ?',
      [categoryId]
    );

    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error: any) {
    console.error('Create category error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

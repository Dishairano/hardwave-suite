import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinExpenseCategory } from '@/lib/erp-types';

// GET /api/erp/finance/categories/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'finance', 'read');
    const { id } = await params;
    const categoryId = parseInt(id);

    const category = await queryOne<FinExpenseCategory>(`
      SELECT c.*, a.code as account_code, a.name as account_name
      FROM fin_expense_categories c
      LEFT JOIN fin_accounts a ON c.account_id = a.id
      WHERE c.id = ?
    `, [categoryId]);

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error: any) {
    console.error('Get category error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/finance/categories/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const { id } = await params;
    const categoryId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<FinExpenseCategory>('SELECT * FROM fin_expense_categories WHERE id = ?', [categoryId]);
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'description', 'account_id', 'is_active'];
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
    await query(`UPDATE fin_expense_categories SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'update',
      entity_type: 'expense_category',
      entity_id: categoryId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<FinExpenseCategory>('SELECT * FROM fin_expense_categories WHERE id = ?', [categoryId]);
    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    console.error('Update category error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/finance/categories/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'delete');
    const { id } = await params;
    const categoryId = parseInt(id);

    const existing = await queryOne<FinExpenseCategory>('SELECT * FROM fin_expense_categories WHERE id = ?', [categoryId]);
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Check for expenses using this category
    const expenses = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM fin_expenses WHERE category_id = ?', [categoryId]);
    if (expenses && expenses.count > 0) {
      return NextResponse.json({ error: 'Cannot delete category with existing expenses' }, { status: 400 });
    }

    await query('DELETE FROM fin_expense_categories WHERE id = ?', [categoryId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'delete',
      entity_type: 'expense_category',
      entity_id: categoryId,
      old_values: sanitizeForAudit(existing as any),
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

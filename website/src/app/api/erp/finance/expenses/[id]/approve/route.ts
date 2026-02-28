import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinExpense } from '@/lib/erp-types';

// POST /api/erp/finance/expenses/[id]/approve - Approve expense
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'approve');
    const { id } = await params;
    const expenseId = parseInt(id);

    const expense = await queryOne<FinExpense>(
      'SELECT * FROM fin_expenses WHERE id = ?',
      [expenseId]
    );

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.status !== 'submitted') {
      return NextResponse.json(
        { error: 'Only submitted expenses can be approved' },
        { status: 400 }
      );
    }

    await query(`
      UPDATE fin_expenses
      SET status = 'approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [auth.userId, expenseId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'approve',
      entity_type: 'expense',
      entity_id: expenseId,
      old_values: { status: 'submitted' },
      new_values: { status: 'approved' },
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<FinExpense>(
      'SELECT * FROM fin_expenses WHERE id = ?',
      [expenseId]
    );

    return NextResponse.json({ success: true, expense: updated });
  } catch (error: any) {
    console.error('Approve expense error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinExpense } from '@/lib/erp-types';

// GET /api/erp/finance/expenses/[id] - Get expense details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'read');
    const { id } = await params;
    const expenseId = parseInt(id);

    const expense = await queryOne<any>(`
      SELECT
        e.*,
        c.name as category_name,
        c.account_id as category_account_id,
        u.display_name as submitted_by_name,
        a.display_name as approved_by_name,
        prj.name as project_name
      FROM fin_expenses e
      LEFT JOIN fin_expense_categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN users a ON e.approved_by = a.id
      LEFT JOIN prj_projects prj ON e.project_id = prj.id
      WHERE e.id = ?
    `, [expenseId]);

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json({ expense });
  } catch (error: any) {
    console.error('Get expense error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/finance/expenses/[id] - Update expense or approve/reject
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const { id } = await params;
    const expenseId = parseInt(id);
    const body = await request.json();

    const expense = await queryOne<FinExpense>(
      'SELECT * FROM fin_expenses WHERE id = ?',
      [expenseId]
    );

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const oldValues = { ...expense };

    // Handle approval/rejection
    if (body.action === 'approve' || body.action === 'reject') {
      // Check if user has approval permission
      await requireERPPermission(request, 'finance', 'approve');

      if (expense.status !== 'submitted') {
        return NextResponse.json(
          { error: 'Only submitted expenses can be approved or rejected' },
          { status: 400 }
        );
      }

      const newStatus = body.action === 'approve' ? 'approved' : 'rejected';

      await query(`
        UPDATE fin_expenses
        SET status = ?, approved_by = ?, approved_at = NOW(), rejected_reason = ?
        WHERE id = ?
      `, [
        newStatus,
        auth.userId,
        body.action === 'reject' ? body.rejected_reason || body.rejection_reason || null : null,
        expenseId,
      ]);

      await logERPAction({
        user_id: auth.userId,
        module: 'finance',
        action: body.action,
        entity_type: 'expense',
        entity_id: expenseId,
        old_values: { status: expense.status },
        new_values: { status: newStatus },
        ip_address: getClientIP(request),
      });

      const updated = await queryOne<FinExpense>(
        'SELECT * FROM fin_expenses WHERE id = ?',
        [expenseId]
      );

      return NextResponse.json({ success: true, expense: updated });
    }

    // Regular update - only allowed for pending expenses by submitter
    if (expense.status !== 'submitted') {
      return NextResponse.json(
        { error: 'Only submitted expenses can be edited' },
        { status: 400 }
      );
    }

    if (expense.user_id !== auth.userId) {
      return NextResponse.json(
        { error: 'Only the submitter can edit this expense' },
        { status: 403 }
      );
    }

    const updateFields: string[] = [];
    const updateParams: any[] = [];

    const allowedFields = [
      'expense_date', 'category_id', 'amount', 'currency',
      'description', 'vendor', 'project_id', 'receipt_url'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateParams.push(body[field] || null);
      }
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = NOW()');
      updateParams.push(expenseId);

      await query(`
        UPDATE fin_expenses SET ${updateFields.join(', ')} WHERE id = ?
      `, updateParams);

      await logERPAction({
        user_id: auth.userId,
        module: 'finance',
        action: 'update',
        entity_type: 'expense',
        entity_id: expenseId,
        old_values: oldValues,
        new_values: body,
        ip_address: getClientIP(request),
      });
    }

    const updated = await queryOne<any>(`
      SELECT e.*, c.name as category_name
      FROM fin_expenses e
      LEFT JOIN fin_expense_categories c ON e.category_id = c.id
      WHERE e.id = ?
    `, [expenseId]);

    return NextResponse.json({ success: true, expense: updated });
  } catch (error: any) {
    console.error('Update expense error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/finance/expenses/[id] - Delete expense
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'delete');
    const { id } = await params;
    const expenseId = parseInt(id);

    const expense = await queryOne<FinExpense>(
      'SELECT * FROM fin_expenses WHERE id = ?',
      [expenseId]
    );

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Only submitted expenses can be deleted, and only by submitter or admin
    if (expense.status !== 'submitted' && expense.user_id !== auth.userId) {
      return NextResponse.json(
        { error: 'Only submitted expenses can be deleted' },
        { status: 400 }
      );
    }

    await query('DELETE FROM fin_expenses WHERE id = ?', [expenseId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'delete',
      entity_type: 'expense',
      entity_id: expenseId,
      old_values: expense,
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete expense error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

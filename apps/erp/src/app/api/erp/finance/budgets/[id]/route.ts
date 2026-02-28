import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinBudget } from '@/lib/erp-types';

// GET /api/erp/finance/budgets/[id] - Get budget with lines and actuals
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'finance', 'read');
    const { id } = await params;
    const budgetId = parseInt(id);

    const budget = await queryOne<any>(`
      SELECT b.*, u.display_name as created_by_name
      FROM fin_budgets b
      JOIN users u ON b.created_by = u.id
      WHERE b.id = ?
    `, [budgetId]);

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    // Get budget lines with actual amounts
    const lines = await query<any[]>(`
      SELECT
        bl.*,
        a.code as account_code,
        a.name as account_name,
        a.account_type,
        COALESCE((
          SELECT SUM(
            CASE WHEN a.account_type IN ('asset', 'expense') THEN jl.debit - jl.credit
                 ELSE jl.credit - jl.debit END
          )
          FROM fin_journal_lines jl
          JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
          WHERE jl.account_id = bl.account_id
            AND je.status = 'posted'
            AND je.entry_date BETWEEN ? AND ?
        ), 0) as actual_amount
      FROM fin_budget_lines bl
      JOIN fin_accounts a ON bl.account_id = a.id
      WHERE bl.budget_id = ?
      ORDER BY a.code
    `, [budget.start_date, budget.end_date, budgetId]);

    // Calculate totals
    const totals = lines.reduce((acc, line) => ({
      budget: acc.budget + parseFloat(line.amount || 0),
      actual: acc.actual + parseFloat(line.actual_amount || 0),
    }), { budget: 0, actual: 0 });

    return NextResponse.json({
      budget: {
        ...budget,
        lines,
        totals,
        variance: totals.budget - totals.actual,
        variance_percent: totals.budget > 0 ? ((totals.budget - totals.actual) / totals.budget) * 100 : 0,
      }
    });
  } catch (error: any) {
    console.error('Get budget error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/finance/budgets/[id] - Update budget
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const { id } = await params;
    const budgetId = parseInt(id);
    const body = await request.json();

    const budget = await queryOne<FinBudget>(
      'SELECT * FROM fin_budgets WHERE id = ?',
      [budgetId]
    );

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    // Handle status changes
    if (body.action === 'approve') {
      await requireERPPermission(request, 'finance', 'approve');

      if (budget.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft budgets can be approved' },
          { status: 400 }
        );
      }

      await query('UPDATE fin_budgets SET status = ? WHERE id = ?', ['active', budgetId]);

      await logERPAction({
        user_id: auth.userId,
        module: 'finance',
        action: 'approve',
        entity_type: 'budget',
        entity_id: budgetId,
        old_values: { status: 'draft' },
        new_values: { status: 'active' },
        ip_address: getClientIP(request),
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === 'close') {
      await query('UPDATE fin_budgets SET status = ? WHERE id = ?', ['closed', budgetId]);
      return NextResponse.json({ success: true });
    }

    // Regular update - only allowed for draft budgets
    if (budget.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft budgets can be edited' },
        { status: 400 }
      );
    }

    const updateFields: string[] = [];
    const updateParams: any[] = [];

    const allowedFields = ['name', 'fiscal_year', 'start_date', 'end_date', 'description'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateParams.push(body[field]);
      }
    }

    if (updateFields.length > 0) {
      updateParams.push(budgetId);
      await query(`
        UPDATE fin_budgets SET ${updateFields.join(', ')} WHERE id = ?
      `, updateParams);
    }

    // Update lines if provided
    if (body.lines && Array.isArray(body.lines)) {
      // Delete existing lines and recreate
      await query('DELETE FROM fin_budget_lines WHERE budget_id = ?', [budgetId]);

      for (const line of body.lines) {
        if (line.account_id && line.amount) {
          await query(`
            INSERT INTO fin_budget_lines (
              budget_id, account_id, period, amount, notes
            ) VALUES (?, ?, ?, ?, ?)
          `, [
            budgetId,
            line.account_id,
            line.period || 'annual',
            line.amount,
            line.notes || null,
          ]);
        }
      }
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'update',
      entity_type: 'budget',
      entity_id: budgetId,
      old_values: budget,
      new_values: body,
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<FinBudget>(
      'SELECT * FROM fin_budgets WHERE id = ?',
      [budgetId]
    );

    return NextResponse.json({ success: true, budget: updated });
  } catch (error: any) {
    console.error('Update budget error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/finance/budgets/[id] - Delete draft budget
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'delete');
    const { id } = await params;
    const budgetId = parseInt(id);

    const budget = await queryOne<FinBudget>(
      'SELECT * FROM fin_budgets WHERE id = ?',
      [budgetId]
    );

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    if (budget.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft budgets can be deleted' },
        { status: 400 }
      );
    }

    await query('DELETE FROM fin_budget_lines WHERE budget_id = ?', [budgetId]);
    await query('DELETE FROM fin_budgets WHERE id = ?', [budgetId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'delete',
      entity_type: 'budget',
      entity_id: budgetId,
      old_values: budget,
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete budget error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

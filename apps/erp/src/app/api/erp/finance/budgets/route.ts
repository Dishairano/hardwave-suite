import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinBudget } from '@/lib/erp-types';

// GET /api/erp/finance/budgets - List budgets
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const fiscalYear = searchParams.get('fiscal_year');
    const status = searchParams.get('status');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (fiscalYear) {
      whereClause += ' AND b.fiscal_year = ?';
      params.push(parseInt(fiscalYear));
    }

    if (status) {
      whereClause += ' AND b.status = ?';
      params.push(status);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM fin_budgets b ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        b.*,
        u.display_name as created_by_name,
        (SELECT SUM(amount) FROM fin_budget_lines WHERE budget_id = b.id) as total_budget,
        (SELECT COUNT(*) FROM fin_budget_lines WHERE budget_id = b.id) as line_count
      FROM fin_budgets b
      JOIN users u ON b.created_by = u.id
      ${whereClause}
      ORDER BY b.fiscal_year DESC, b.name ASC LIMIT ? OFFSET ?
    `;

    const budgets = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(budgets, total, page, limit));
  } catch (error: any) {
    console.error('Get budgets error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/finance/budgets - Create budget
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const body = await request.json();

    const {
      name,
      fiscal_year,
      start_date,
      end_date,
      description,
      lines = [],
    } = body;

    if (!name || !fiscal_year || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'Name, fiscal year, start date, and end date are required' },
        { status: 400 }
      );
    }

    const result = await query<any>(`
      INSERT INTO fin_budgets (
        name, fiscal_year, start_date, end_date, description,
        status, created_by
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?)
    `, [
      name,
      fiscal_year,
      start_date,
      end_date,
      description || null,
      auth.userId,
    ]);

    const budgetId = result.insertId;

    // Create budget lines if provided
    for (const line of lines) {
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

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'create',
      entity_type: 'budget',
      entity_id: budgetId,
      new_values: { name, fiscal_year },
      ip_address: getClientIP(request),
    });

    const budget = await queryOne<FinBudget>(
      'SELECT * FROM fin_budgets WHERE id = ?',
      [budgetId]
    );

    return NextResponse.json({ success: true, budget }, { status: 201 });
  } catch (error: any) {
    console.error('Create budget error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

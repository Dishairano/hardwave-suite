import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getNextSequence, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinExpense } from '@/lib/erp-types';

// GET /api/erp/finance/expenses - List expenses
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');
    const categoryId = searchParams.get('category_id');
    const userId = searchParams.get('user_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND e.status = ?';
      params.push(status);
    }

    if (categoryId) {
      whereClause += ' AND e.category_id = ?';
      params.push(parseInt(categoryId));
    }

    if (userId) {
      if (userId === 'me') {
        whereClause += ' AND e.user_id = ?';
        params.push(auth.userId);
      } else {
        whereClause += ' AND e.user_id = ?';
        params.push(parseInt(userId));
      }
    }

    if (dateFrom) {
      whereClause += ' AND e.expense_date >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND e.expense_date <= ?';
      params.push(dateTo);
    }

    // Get total count and sum
    const countResult = await queryOne<{ total: number; total_amount: number }>(
      `SELECT COUNT(*) as total, COALESCE(SUM(e.amount), 0) as total_amount
       FROM fin_expenses e ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;
    const totalAmount = countResult?.total_amount || 0;

    const sql = `
      SELECT
        e.*,
        c.name as category_name,
        u.display_name as submitted_by_name,
        a.display_name as approved_by_name,
        prj.name as project_name
      FROM fin_expenses e
      LEFT JOIN fin_expense_categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN users a ON e.approved_by = a.id
      LEFT JOIN prj_projects prj ON e.project_id = prj.id
      ${whereClause}
      ORDER BY e.expense_date DESC, e.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const expenses = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json({
      ...buildPaginationResponse(expenses, total, page, limit),
      summary: { totalAmount },
    });
  } catch (error: any) {
    console.error('Get expenses error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/finance/expenses - Submit expense
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const body = await request.json();

    const {
      expense_date,
      category_id,
      amount,
      currency = 'USD',
      description,
      vendor,
      project_id,
    } = body;

    if (!expense_date || !category_id || !amount) {
      return NextResponse.json(
        { error: 'Expense date, category, and amount are required' },
        { status: 400 }
      );
    }

    const expenseNumber = await getNextSequence('expense');

    const result = await query<any>(`
      INSERT INTO fin_expenses (
        expense_number, expense_date, category_id, amount, currency,
        description, vendor, project_id, user_id, status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NOW())
    `, [
      expenseNumber,
      expense_date,
      category_id,
      amount,
      currency,
      description || null,
      vendor || null,
      project_id || null,
      auth.userId,
    ]);

    const expenseId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'create',
      entity_type: 'expense',
      entity_id: expenseId,
      new_values: { expense_number: expenseNumber, amount, category_id },
      ip_address: getClientIP(request),
    });

    const expense = await queryOne<FinExpense>(`
      SELECT e.*, c.name as category_name
      FROM fin_expenses e
      LEFT JOIN fin_expense_categories c ON e.category_id = c.id
      WHERE e.id = ?
    `, [expenseId]);

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error: any) {
    console.error('Create expense error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

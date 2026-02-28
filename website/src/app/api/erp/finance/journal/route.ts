import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getNextSequence, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinJournalEntry, FinJournalLine } from '@/lib/erp-types';

// GET /api/erp/finance/journal - List journal entries
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND je.status = ?';
      params.push(status);
    }

    if (dateFrom) {
      whereClause += ' AND je.entry_date >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND je.entry_date <= ?';
      params.push(dateTo);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM fin_journal_entries je ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        je.*,
        u.display_name as created_by_name,
        a.display_name as posted_by_name,
        (SELECT SUM(debit) FROM fin_journal_lines WHERE journal_entry_id = je.id) as total_debit,
        (SELECT SUM(credit) FROM fin_journal_lines WHERE journal_entry_id = je.id) as total_credit
      FROM fin_journal_entries je
      JOIN users u ON je.created_by = u.id
      LEFT JOIN users a ON je.posted_by = a.id
      ${whereClause}
      ORDER BY je.entry_date DESC, je.created_at DESC LIMIT ? OFFSET ?
    `;

    const entries = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(entries, total, page, limit));
  } catch (error: any) {
    console.error('Get journal entries error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/finance/journal - Create journal entry
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const body = await request.json();

    const {
      entry_date,
      description,
      reference,
      lines = [],
      auto_post = false,
    } = body;

    if (!entry_date || !description) {
      return NextResponse.json(
        { error: 'Entry date and description are required' },
        { status: 400 }
      );
    }

    if (!lines || lines.length < 2) {
      return NextResponse.json(
        { error: 'At least two journal lines are required' },
        { status: 400 }
      );
    }

    // Validate double-entry: debits must equal credits
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (!line.account_id) {
        return NextResponse.json(
          { error: 'Each line must have an account' },
          { status: 400 }
        );
      }
      totalDebit += parseFloat(line.debit || line.debit_amount || 0);
      totalCredit += parseFloat(line.credit || line.credit_amount || 0);
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        { error: `Journal entry does not balance. Debits: ${totalDebit}, Credits: ${totalCredit}` },
        { status: 400 }
      );
    }

    const entryNumber = await getNextSequence('journal');

    // Create journal entry
    const result = await query<any>(`
      INSERT INTO fin_journal_entries (
        entry_number, entry_date, description, reference,
        status, created_by
      ) VALUES (?, ?, ?, ?, 'draft', ?)
    `, [
      entryNumber,
      entry_date,
      description,
      reference || null,
      auth.userId,
    ]);

    const entryId = result.insertId;

    // Create journal lines
    for (const line of lines) {
      await query(`
        INSERT INTO fin_journal_lines (
          journal_entry_id, account_id, description,
          debit, credit
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        entryId,
        line.account_id,
        line.description || null,
        parseFloat(line.debit || line.debit_amount || 0),
        parseFloat(line.credit || line.credit_amount || 0),
      ]);
    }

    // Auto-post if requested
    if (auto_post) {
      await query(`
        UPDATE fin_journal_entries
        SET status = 'posted', posted_by = ?, posted_at = NOW()
        WHERE id = ?
      `, [auth.userId, entryId]);
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'create',
      entity_type: 'journal_entry',
      entity_id: entryId,
      new_values: { entry_number: entryNumber, description, total: totalDebit },
      ip_address: getClientIP(request),
    });

    // Fetch complete entry with lines
    const entry = await queryOne<FinJournalEntry>(`
      SELECT je.*, u.display_name as created_by_name
      FROM fin_journal_entries je
      JOIN users u ON je.created_by = u.id
      WHERE je.id = ?
    `, [entryId]);

    const entryLines = await query<any[]>(`
      SELECT jl.*, a.code as account_code, a.name as account_name
      FROM fin_journal_lines jl
      JOIN fin_accounts a ON jl.account_id = a.id
      WHERE jl.journal_entry_id = ?
      ORDER BY jl.id
    `, [entryId]);

    return NextResponse.json({
      success: true,
      entry: { ...entry, lines: entryLines }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create journal entry error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

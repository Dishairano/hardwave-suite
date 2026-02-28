import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinAccount } from '@/lib/erp-types';

// GET /api/erp/finance/accounts - List accounts (chart of accounts)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'read');
    const { searchParams } = new URL(request.url);

    const accountType = searchParams.get('type');
    const parentId = searchParams.get('parent_id');
    const isActive = searchParams.get('is_active');

    let sql = `
      SELECT
        a.*,
        p.code as parent_code,
        p.name as parent_name,
        (SELECT COUNT(*) FROM fin_accounts WHERE parent_id = a.id) as children_count,
        (SELECT COALESCE(SUM(
          CASE WHEN a.account_type IN ('asset', 'expense') THEN jl.debit - jl.credit
               ELSE jl.credit - jl.debit END
        ), 0) FROM fin_journal_lines jl
         JOIN fin_journal_entries je ON jl.journal_entry_id = je.id
         WHERE jl.account_id = a.id AND je.status = 'posted') as balance
      FROM fin_accounts a
      LEFT JOIN fin_accounts p ON a.parent_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (accountType) {
      sql += ' AND a.account_type = ?';
      params.push(accountType);
    }

    if (parentId === 'null') {
      sql += ' AND a.parent_id IS NULL';
    } else if (parentId) {
      sql += ' AND a.parent_id = ?';
      params.push(parseInt(parentId));
    }

    if (isActive !== null && isActive !== undefined) {
      sql += ' AND a.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY a.code';

    const accounts = await query<FinAccount[]>(sql, params);

    // Build tree structure if no parent filter
    if (!parentId) {
      const accountMap = new Map<number, any>();
      const rootAccounts: any[] = [];

      accounts.forEach(account => {
        accountMap.set(account.id, { ...account, children: [] });
      });

      accounts.forEach(account => {
        const node = accountMap.get(account.id);
        if (account.parent_id && accountMap.has(account.parent_id)) {
          accountMap.get(account.parent_id).children.push(node);
        } else {
          rootAccounts.push(node);
        }
      });

      return NextResponse.json({ accounts: rootAccounts, flat: accounts });
    }

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error('Get accounts error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/finance/accounts - Create account
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const body = await request.json();

    const {
      code,
      name,
      account_type,
      parent_id,
      description,
      is_active = true,
    } = body;

    if (!code || !name || !account_type) {
      return NextResponse.json(
        { error: 'Account code, name, and type are required' },
        { status: 400 }
      );
    }

    // Check for duplicate account code
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM fin_accounts WHERE code = ?',
      [code]
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Account code already exists' },
        { status: 400 }
      );
    }

    const result = await query<any>(`
      INSERT INTO fin_accounts (
        code, name, account_type, parent_id, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      code,
      name,
      account_type,
      parent_id || null,
      description || null,
      is_active,
    ]);

    const accountId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'create',
      entity_type: 'account',
      entity_id: accountId,
      new_values: { code, name, account_type },
      ip_address: getClientIP(request),
    });

    const account = await queryOne<FinAccount>(
      'SELECT * FROM fin_accounts WHERE id = ?',
      [accountId]
    );

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error: any) {
    console.error('Create account error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

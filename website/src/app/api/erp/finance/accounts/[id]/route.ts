import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinAccount } from '@/lib/erp-types';

// GET /api/erp/finance/accounts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'finance', 'read');
    const { id } = await params;
    const accountId = parseInt(id);

    const account = await queryOne<FinAccount>(`
      SELECT a.*, p.code as parent_code, p.name as parent_name
      FROM fin_accounts a
      LEFT JOIN fin_accounts p ON a.parent_id = p.id
      WHERE a.id = ?
    `, [accountId]);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get child accounts
    const children = await query<FinAccount[]>(
      'SELECT * FROM fin_accounts WHERE parent_id = ? ORDER BY code',
      [accountId]
    );

    return NextResponse.json({ account, children });
  } catch (error: any) {
    console.error('Get account error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/finance/accounts/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const { id } = await params;
    const accountId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<FinAccount>('SELECT * FROM fin_accounts WHERE id = ?', [accountId]);
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const allowedFields = ['code', 'name', 'account_type', 'parent_id', 'description', 'is_active'];
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

    values.push(accountId);
    await query(`UPDATE fin_accounts SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'update',
      entity_type: 'account',
      entity_id: accountId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<FinAccount>('SELECT * FROM fin_accounts WHERE id = ?', [accountId]);
    return NextResponse.json({ success: true, account: updated });
  } catch (error: any) {
    console.error('Update account error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/finance/accounts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'delete');
    const { id } = await params;
    const accountId = parseInt(id);

    const existing = await queryOne<FinAccount>('SELECT * FROM fin_accounts WHERE id = ?', [accountId]);
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Check for child accounts
    const children = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM fin_accounts WHERE parent_id = ?', [accountId]);
    if (children && children.count > 0) {
      return NextResponse.json({ error: 'Cannot delete account with child accounts' }, { status: 400 });
    }

    // Check for journal entries
    const journalEntries = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM fin_journal_lines WHERE account_id = ?', [accountId]);
    if (journalEntries && journalEntries.count > 0) {
      return NextResponse.json({ error: 'Cannot delete account with journal entries' }, { status: 400 });
    }

    await query('DELETE FROM fin_accounts WHERE id = ?', [accountId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'delete',
      entity_type: 'account',
      entity_id: accountId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete account error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

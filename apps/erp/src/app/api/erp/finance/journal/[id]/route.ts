import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { FinJournalEntry } from '@/lib/erp-types';

// GET /api/erp/finance/journal/[id] - Get journal entry with lines
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'finance', 'read');
    const { id } = await params;
    const entryId = parseInt(id);

    const entry = await queryOne<any>(`
      SELECT
        je.*,
        u.display_name as created_by_name,
        p.display_name as posted_by_name
      FROM fin_journal_entries je
      JOIN users u ON je.created_by = u.id
      LEFT JOIN users p ON je.posted_by = p.id
      WHERE je.id = ?
    `, [entryId]);

    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    const lines = await query<any[]>(`
      SELECT
        jl.*,
        a.code as account_code,
        a.name as account_name,
        a.account_type
      FROM fin_journal_lines jl
      JOIN fin_accounts a ON jl.account_id = a.id
      WHERE jl.journal_entry_id = ?
      ORDER BY jl.id
    `, [entryId]);

    return NextResponse.json({ entry: { ...entry, lines } });
  } catch (error: any) {
    console.error('Get journal entry error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/finance/journal/[id] - Update or post/void journal entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'write');
    const { id } = await params;
    const entryId = parseInt(id);
    const body = await request.json();

    const entry = await queryOne<FinJournalEntry>(
      'SELECT * FROM fin_journal_entries WHERE id = ?',
      [entryId]
    );

    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    // Handle posting
    if (body.action === 'post') {
      if (entry.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft entries can be posted' },
          { status: 400 }
        );
      }

      await query(`
        UPDATE fin_journal_entries
        SET status = 'posted', posted_by = ?, posted_at = NOW()
        WHERE id = ?
      `, [auth.userId, entryId]);

      await logERPAction({
        user_id: auth.userId,
        module: 'finance',
        action: 'post',
        entity_type: 'journal_entry',
        entity_id: entryId,
        old_values: { status: 'draft' },
        new_values: { status: 'posted' },
        ip_address: getClientIP(request),
      });

      const updated = await queryOne<FinJournalEntry>(
        'SELECT * FROM fin_journal_entries WHERE id = ?',
        [entryId]
      );

      return NextResponse.json({ success: true, entry: updated });
    }

    // Handle voiding
    if (body.action === 'void') {
      await requireERPPermission(request, 'finance', 'approve');

      if (entry.status === 'reversed') {
        return NextResponse.json(
          { error: 'Entry is already voided' },
          { status: 400 }
        );
      }

      await query(`
        UPDATE fin_journal_entries
        SET status = 'reversed'
        WHERE id = ?
      `, [entryId]);

      await logERPAction({
        user_id: auth.userId,
        module: 'finance',
        action: 'void',
        entity_type: 'journal_entry',
        entity_id: entryId,
        old_values: { status: entry.status },
        new_values: { status: 'reversed' },
        ip_address: getClientIP(request),
      });

      const updated = await queryOne<FinJournalEntry>(
        'SELECT * FROM fin_journal_entries WHERE id = ?',
        [entryId]
      );

      return NextResponse.json({ success: true, entry: updated });
    }

    // Regular update - only allowed for draft entries
    if (entry.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft entries can be edited' },
        { status: 400 }
      );
    }

    const { entry_date, description, reference, lines } = body;

    if (entry_date || description || reference !== undefined) {
      await query(`
        UPDATE fin_journal_entries
        SET entry_date = COALESCE(?, entry_date),
            description = COALESCE(?, description),
            reference = COALESCE(?, reference),
            updated_at = NOW()
        WHERE id = ?
      `, [entry_date, description, reference, entryId]);
    }

    // Update lines if provided
    if (lines && Array.isArray(lines)) {
      // Validate balance
      let totalDebit = 0;
      let totalCredit = 0;

      for (const line of lines) {
        totalDebit += parseFloat(line.debit || line.debit_amount || 0);
        totalCredit += parseFloat(line.credit || line.credit_amount || 0);
      }

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return NextResponse.json(
          { error: `Journal entry does not balance. Debits: ${totalDebit}, Credits: ${totalCredit}` },
          { status: 400 }
        );
      }

      // Delete existing lines and recreate
      await query('DELETE FROM fin_journal_lines WHERE journal_entry_id = ?', [entryId]);

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
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'update',
      entity_type: 'journal_entry',
      entity_id: entryId,
      old_values: entry,
      new_values: body,
      ip_address: getClientIP(request),
    });

    // Fetch updated entry with lines
    const updated = await queryOne<any>(`
      SELECT je.*, u.display_name as created_by_name
      FROM fin_journal_entries je
      JOIN users u ON je.created_by = u.id
      WHERE je.id = ?
    `, [entryId]);

    const updatedLines = await query<any[]>(`
      SELECT jl.*, a.code as account_code, a.name as account_name
      FROM fin_journal_lines jl
      JOIN fin_accounts a ON jl.account_id = a.id
      WHERE jl.journal_entry_id = ?
      ORDER BY jl.id
    `, [entryId]);

    return NextResponse.json({
      success: true,
      entry: { ...updated, lines: updatedLines }
    });
  } catch (error: any) {
    console.error('Update journal entry error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/finance/journal/[id] - Delete draft journal entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'finance', 'delete');
    const { id } = await params;
    const entryId = parseInt(id);

    const entry = await queryOne<FinJournalEntry>(
      'SELECT * FROM fin_journal_entries WHERE id = ?',
      [entryId]
    );

    if (!entry) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    if (entry.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft entries can be deleted. Posted entries must be voided.' },
        { status: 400 }
      );
    }

    // Delete lines first, then entry
    await query('DELETE FROM fin_journal_lines WHERE journal_entry_id = ?', [entryId]);
    await query('DELETE FROM fin_journal_entries WHERE id = ?', [entryId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'finance',
      action: 'delete',
      entity_type: 'journal_entry',
      entity_id: entryId,
      old_values: entry,
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete journal entry error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

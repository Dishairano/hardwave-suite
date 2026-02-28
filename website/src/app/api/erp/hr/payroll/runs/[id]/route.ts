import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRPayrollRun } from '@/lib/erp-types';

// GET /api/erp/hr/payroll/runs/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { id } = await params;
    const runId = parseInt(id);

    const run = await queryOne<HRPayrollRun>(`
      SELECT pr.*, u.display_name as created_by_name, a.display_name as approved_by_name
      FROM hr_payroll_runs pr
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN users a ON pr.approved_by = a.id
      WHERE pr.id = ?
    `, [runId]);

    if (!run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    // Get payroll items
    const items = await query<any[]>(`
      SELECT pi.*, e.employee_number, u.display_name as employee_name
      FROM hr_payroll_items pi
      JOIN hr_employees e ON pi.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE pi.payroll_run_id = ?
      ORDER BY u.display_name
    `, [runId]);

    return NextResponse.json({ run, items });
  } catch (error: any) {
    console.error('Get payroll run error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/hr/payroll/runs/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const runId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<HRPayrollRun>('SELECT * FROM hr_payroll_runs WHERE id = ?', [runId]);
    if (!existing) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    // Only draft and processing runs can be edited
    if (existing.status !== 'draft' && existing.status !== 'processing') {
      return NextResponse.json({
        error: `Cannot modify a ${existing.status} payroll run. Only draft or processing runs can be edited.`
      }, { status: 400 });
    }

    // Handle explicit approve action
    if (body.action === 'approve') {
      if (existing.status === 'approved' || existing.status === 'paid') {
        return NextResponse.json({ error: 'Payroll run is already approved or paid' }, { status: 400 });
      }

      await query(
        'UPDATE hr_payroll_runs SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
        ['approved', auth.userId, runId]
      );

      await logERPAction({
        user_id: auth.userId,
        module: 'hr',
        action: 'approve',
        entity_type: 'payroll_run',
        entity_id: runId,
        old_values: sanitizeForAudit(existing as any),
        new_values: sanitizeForAudit({ status: 'approved', approved_by: auth.userId }),
        ip_address: getClientIP(request),
      });

      const updated = await queryOne<HRPayrollRun>('SELECT * FROM hr_payroll_runs WHERE id = ?', [runId]);
      return NextResponse.json({ success: true, run: updated });
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'draft': ['processing', 'cancelled'],
      'processing': ['approved', 'draft', 'cancelled'],
      'approved': ['paid'],
    };

    if (body.status && body.status !== existing.status) {
      const allowedStatuses = validTransitions[existing.status] || [];
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json({
          error: `Invalid status transition from ${existing.status} to ${body.status}`
        }, { status: 400 });
      }
    }

    const allowedFields = ['pay_period_start', 'pay_period_end', 'payment_date', 'status', 'notes'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Handle approval via status change
    if (body.status === 'approved' && existing.status !== 'approved') {
      updates.push('approved_by = ?', 'approved_at = NOW()');
      values.push(auth.userId);
    }

    // Handle paid status
    if (body.status === 'paid' && existing.status !== 'paid') {
      updates.push('paid_at = NOW()');
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(runId);
    await query(`UPDATE hr_payroll_runs SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'update',
      entity_type: 'payroll_run',
      entity_id: runId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<HRPayrollRun>('SELECT * FROM hr_payroll_runs WHERE id = ?', [runId]);
    return NextResponse.json({ success: true, run: updated });
  } catch (error: any) {
    console.error('Update payroll run error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/hr/payroll/runs/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'delete');
    const { id } = await params;
    const runId = parseInt(id);

    const existing = await queryOne<HRPayrollRun>('SELECT * FROM hr_payroll_runs WHERE id = ?', [runId]);
    if (!existing) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 });
    }

    if (existing.status !== 'draft') {
      return NextResponse.json({ error: 'Can only delete draft payroll runs' }, { status: 400 });
    }

    await query('DELETE FROM hr_payroll_runs WHERE id = ?', [runId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'delete',
      entity_type: 'payroll_run',
      entity_id: runId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete payroll run error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

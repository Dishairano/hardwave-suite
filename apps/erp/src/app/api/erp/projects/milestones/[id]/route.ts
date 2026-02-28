import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/projects/milestones/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'projects', 'read');
    const { id } = await params;

    const milestone = await queryOne<any>(`
      SELECT m.*, p.name as project_name
      FROM prj_milestones m
      JOIN prj_projects p ON m.project_id = p.id
      WHERE m.id = ?
    `, [parseInt(id)]);

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const tasks = await query<any[]>(`
      SELECT t.*, u.display_name as assignee_name
      FROM prj_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.milestone_id = ?
      ORDER BY t.sort_order, t.created_at
    `, [parseInt(id)]);

    return NextResponse.json({ milestone, tasks });
  } catch (error: any) {
    console.error('Get milestone error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/projects/milestones/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const { id } = await params;
    const milestoneId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM prj_milestones WHERE id = ?', [milestoneId]);
    if (!existing) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'description', 'due_date', 'status', 'completed_at'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Auto-set completed_at when status changes to completed
    if (body.status === 'completed' && existing.status !== 'completed') {
      updates.push('completed_at = NOW()');
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(milestoneId);
    await query(`UPDATE prj_milestones SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'update',
      entity_type: 'milestone',
      entity_id: milestoneId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>('SELECT * FROM prj_milestones WHERE id = ?', [milestoneId]);
    return NextResponse.json({ success: true, milestone: updated });
  } catch (error: any) {
    console.error('Update milestone error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/projects/milestones/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'delete');
    const { id } = await params;
    const milestoneId = parseInt(id);

    const existing = await queryOne<any>('SELECT * FROM prj_milestones WHERE id = ?', [milestoneId]);
    if (!existing) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Unlink tasks from milestone
    await query('UPDATE prj_tasks SET milestone_id = NULL WHERE milestone_id = ?', [milestoneId]);

    await query('DELETE FROM prj_milestones WHERE id = ?', [milestoneId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'delete',
      entity_type: 'milestone',
      entity_id: milestoneId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete milestone error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

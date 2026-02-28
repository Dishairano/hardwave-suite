import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { Project, ProjectTeamMember, ProjectMilestone } from '@/lib/erp-types';

// GET /api/erp/projects/[id] - Get project details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'read');
    const { id } = await params;
    const projectId = parseInt(id);

    const project = await queryOne<Project>(`
      SELECT
        p.*,
        c.name as client_name,
        u.display_name as manager_name
      FROM prj_projects p
      LEFT JOIN crm_companies c ON p.client_company_id = c.id
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.id = ?
    `, [projectId]);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get team members
    const teamMembers = await query<ProjectTeamMember[]>(`
      SELECT
        tm.*,
        u.display_name as user_name,
        u.email as user_email
      FROM prj_team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.project_id = ? AND tm.is_active = TRUE
      ORDER BY tm.role DESC, tm.joined_at
    `, [projectId]);

    // Get milestones
    const milestones = await query<ProjectMilestone[]>(`
      SELECT * FROM prj_milestones
      WHERE project_id = ?
      ORDER BY sort_order, due_date
    `, [projectId]);

    // Get task counts by status
    const taskStats = await query<any[]>(`
      SELECT status, COUNT(*) as count
      FROM prj_tasks
      WHERE project_id = ?
      GROUP BY status
    `, [projectId]);

    return NextResponse.json({
      project,
      teamMembers,
      milestones,
      taskStats: taskStats.reduce((acc, stat) => {
        acc[stat.status] = stat.count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error: any) {
    console.error('Get project error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/projects/[id] - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const { id } = await params;
    const projectId = parseInt(id);
    const body = await request.json();

    // Get existing project for audit
    const existing = await queryOne<Project>('SELECT * FROM prj_projects WHERE id = ?', [projectId]);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const allowedFields = [
      'name', 'description', 'client_company_id', 'status', 'priority',
      'project_type', 'start_date', 'target_end_date', 'actual_end_date',
      'budget_amount', 'billable', 'hourly_rate', 'total_hours_estimated',
      'progress_percent', 'manager_id'
    ];

    const updates: string[] = [];
    const values: any[] = [];
    const changes: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
        changes[field] = { old: (existing as any)[field], new: body[field] };
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(projectId);
    await query(`UPDATE prj_projects SET ${updates.join(', ')} WHERE id = ?`, values);

    // Log the action
    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'update',
      entity_type: 'project',
      entity_id: projectId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<Project>(`
      SELECT p.*, u.display_name as manager_name
      FROM prj_projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.id = ?
    `, [projectId]);

    return NextResponse.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('Update project error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'delete');
    const { id } = await params;
    const projectId = parseInt(id);

    const existing = await queryOne<Project>('SELECT * FROM prj_projects WHERE id = ?', [projectId]);
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check for unbilled time entries
    const unbilledTime = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM prj_time_entries
      WHERE project_id = ? AND billable = TRUE AND billed = FALSE
    `, [projectId]);

    if (unbilledTime && unbilledTime.count > 0) {
      return NextResponse.json({
        error: 'Cannot delete project with unbilled time entries',
        unbilled_count: unbilledTime.count,
      }, { status: 400 });
    }

    // Delete project (cascades to tasks, time entries, team members, etc.)
    await query('DELETE FROM prj_projects WHERE id = ?', [projectId]);

    // Log the action
    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'delete',
      entity_type: 'project',
      entity_id: projectId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete project error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

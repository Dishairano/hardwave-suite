import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/projects/team
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'projects', 'read');
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const members = await query<any[]>(`
      SELECT tm.*, u.display_name, u.email,
        (SELECT COUNT(*) FROM prj_tasks WHERE project_id = tm.project_id AND assignee_id = tm.user_id) as task_count,
        (SELECT COALESCE(SUM(hours), 0) FROM prj_time_entries WHERE project_id = tm.project_id AND user_id = tm.user_id) as total_hours
      FROM prj_team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.project_id = ?
      ORDER BY tm.role DESC, u.display_name
    `, [parseInt(projectId)]);

    return NextResponse.json({ members });
  } catch (error: any) {
    console.error('Get team members error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/projects/team
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const body = await request.json();

    const { project_id, user_id, role = 'member', hourly_rate } = body;

    if (!project_id || !user_id) {
      return NextResponse.json({ error: 'project_id and user_id are required' }, { status: 400 });
    }

    // Check for existing membership
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM prj_team_members WHERE project_id = ? AND user_id = ?',
      [project_id, user_id]
    );
    if (existing) {
      return NextResponse.json({ error: 'User is already a team member' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO prj_team_members (project_id, user_id, role, hourly_rate, joined_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [project_id, user_id, role, hourly_rate || null]);

    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'add_team_member',
      entity_type: 'team_member',
      entity_id: result.insertId,
      new_values: { project_id, user_id, role },
      ip_address: getClientIP(request),
    });

    const member = await queryOne<any>(`
      SELECT tm.*, u.display_name, u.email
      FROM prj_team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `, [result.insertId]);

    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (error: any) {
    console.error('Add team member error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

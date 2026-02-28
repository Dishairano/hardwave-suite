import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/projects/milestones
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'projects', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (projectId) {
      whereClause += ' AND m.project_id = ?';
      params.push(parseInt(projectId));
    }

    if (status) {
      whereClause += ' AND m.status = ?';
      params.push(status);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM prj_milestones m
      JOIN prj_projects p ON m.project_id = p.id
      ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Main query with ordering and pagination
    const sql = `
      SELECT m.*, p.name as project_name,
        (SELECT COUNT(*) FROM prj_tasks WHERE milestone_id = m.id) as task_count,
        (SELECT COUNT(*) FROM prj_tasks WHERE milestone_id = m.id AND status = 'completed') as completed_tasks
      FROM prj_milestones m
      JOIN prj_projects p ON m.project_id = p.id
      ${whereClause} ORDER BY m.due_date ASC LIMIT ? OFFSET ?
    `;

    const milestones = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(milestones, total, page, limit));
  } catch (error: any) {
    console.error('Get milestones error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/projects/milestones
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const body = await request.json();

    const { project_id, name, description, due_date, status = 'pending' } = body;

    if (!project_id || !name) {
      return NextResponse.json({ error: 'project_id and name are required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO prj_milestones (project_id, name, description, due_date, status)
      VALUES (?, ?, ?, ?, ?)
    `, [project_id, name, description || null, due_date || null, status]);

    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'create',
      entity_type: 'milestone',
      entity_id: result.insertId,
      new_values: { project_id, name },
      ip_address: getClientIP(request),
    });

    const milestone = await queryOne<any>('SELECT * FROM prj_milestones WHERE id = ?', [result.insertId]);

    return NextResponse.json({ success: true, milestone }, { status: 201 });
  } catch (error: any) {
    console.error('Create milestone error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

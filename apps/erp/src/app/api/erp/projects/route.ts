import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getNextSequence, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { Project } from '@/lib/erp-types';

// GET /api/erp/projects - List projects with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const managerId = searchParams.get('manager_id') || '';

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.project_code LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    if (managerId) {
      whereClause += ' AND p.manager_id = ?';
      params.push(parseInt(managerId));
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM prj_projects p
      LEFT JOIN crm_companies c ON p.client_company_id = c.id
      LEFT JOIN users u ON p.manager_id = u.id
      ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Main query with ordering and pagination
    const sql = `
      SELECT
        p.*,
        c.name as client_name,
        u.display_name as manager_name,
        (SELECT COUNT(*) FROM prj_team_members WHERE project_id = p.id AND is_active = TRUE) as team_size,
        (SELECT COUNT(*) FROM prj_tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM prj_tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
      FROM prj_projects p
      LEFT JOIN crm_companies c ON p.client_company_id = c.id
      LEFT JOIN users u ON p.manager_id = u.id
      ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `;

    const projects = await query<Project[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(projects, total, page, limit));
  } catch (error: any) {
    console.error('Get projects error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const body = await request.json();

    const {
      name,
      description,
      client_company_id,
      status = 'draft',
      priority = 'medium',
      project_type = 'internal',
      start_date,
      target_end_date,
      budget_amount,
      billable,
      hourly_rate,
      total_hours_estimated,
      manager_id,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Generate project code
    const projectCode = await getNextSequence('project');

    const result = await query<any>(`
      INSERT INTO prj_projects (
        project_code, name, description, client_company_id, status, priority,
        project_type, start_date, target_end_date, budget_amount, billable,
        hourly_rate, total_hours_estimated, manager_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      projectCode,
      name,
      description || null,
      client_company_id || null,
      status,
      priority,
      project_type,
      start_date || null,
      target_end_date || null,
      budget_amount || 0,
      billable || false,
      hourly_rate || 0,
      total_hours_estimated || 0,
      manager_id || auth.userId,
      auth.userId,
    ]);

    const projectId = result.insertId;

    // Add creator as team member if manager
    if (manager_id === auth.userId || !manager_id) {
      await query(`
        INSERT INTO prj_team_members (project_id, user_id, role)
        VALUES (?, ?, 'manager')
      `, [projectId, auth.userId]);
    }

    // Log the action
    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'create',
      entity_type: 'project',
      entity_id: projectId,
      new_values: { project_code: projectCode, name },
      ip_address: getClientIP(request),
    });

    const project = await queryOne<Project>(`
      SELECT p.*, u.display_name as manager_name
      FROM prj_projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE p.id = ?
    `, [projectId]);

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: any) {
    console.error('Create project error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

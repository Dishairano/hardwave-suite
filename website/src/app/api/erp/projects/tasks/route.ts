import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getNextSequence, getClientIP, buildPaginationResponse, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { Task } from '@/lib/erp-types';

// GET /api/erp/projects/tasks - List tasks with filters
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status');
    const assigneeId = searchParams.get('assignee_id');
    const milestoneId = searchParams.get('milestone_id');
    const search = searchParams.get('search') || '';

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (projectId) {
      whereClause += ' AND t.project_id = ?';
      params.push(parseInt(projectId));
    }

    if (status) {
      const statuses = status.split(',');
      whereClause += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    if (assigneeId) {
      if (assigneeId === 'me') {
        whereClause += ' AND t.assignee_id = ?';
        params.push(auth.userId);
      } else if (assigneeId === 'unassigned') {
        whereClause += ' AND t.assignee_id IS NULL';
      } else {
        whereClause += ' AND t.assignee_id = ?';
        params.push(parseInt(assigneeId));
      }
    }

    if (milestoneId) {
      whereClause += ' AND t.milestone_id = ?';
      params.push(parseInt(milestoneId));
    }

    if (search) {
      whereClause += ' AND (t.title LIKE ? OR t.task_number LIKE ? OR t.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM prj_tasks t
      JOIN prj_projects p ON t.project_id = p.id
      ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Main query with ordering and pagination
    const sql = `
      SELECT
        t.*,
        p.name as project_name,
        p.project_code,
        u1.display_name as assignee_name,
        u2.display_name as reporter_name
      FROM prj_tasks t
      JOIN prj_projects p ON t.project_id = p.id
      LEFT JOIN users u1 ON t.assignee_id = u1.id
      LEFT JOIN users u2 ON t.reporter_id = u2.id
      ${whereClause} ORDER BY t.sort_order, t.created_at DESC LIMIT ? OFFSET ?
    `;

    const tasks = await query<any[]>(sql, [...params, limit, offset]);

    // Parse JSON fields
    const parsedTasks = tasks.map(task => ({
      ...task,
      tags: parseJsonField(task.tags, []),
    }));

    return NextResponse.json(buildPaginationResponse(parsedTasks, total, page, limit));
  } catch (error: any) {
    console.error('Get tasks error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/projects/tasks - Create new task
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const body = await request.json();

    const {
      project_id,
      milestone_id,
      parent_task_id,
      title,
      description,
      status = 'todo',
      priority = 'medium',
      task_type = 'task',
      assignee_id,
      estimated_hours,
      due_date,
      tags = [],
    } = body;

    if (!project_id || !title) {
      return NextResponse.json({ error: 'Project ID and title are required' }, { status: 400 });
    }

    // Verify project exists
    const project = await queryOne<any>('SELECT id FROM prj_projects WHERE id = ?', [project_id]);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate task number
    const taskNumber = await getNextSequence('task');

    // Get max sort order for this project/status
    const maxOrder = await queryOne<{ max_order: number }>(`
      SELECT COALESCE(MAX(sort_order), 0) as max_order
      FROM prj_tasks WHERE project_id = ? AND status = ?
    `, [project_id, status]);

    const result = await query<any>(`
      INSERT INTO prj_tasks (
        project_id, milestone_id, parent_task_id, task_number, title,
        description, status, priority, task_type, assignee_id, reporter_id,
        estimated_hours, due_date, tags, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      project_id,
      milestone_id || null,
      parent_task_id || null,
      taskNumber,
      title,
      description || null,
      status,
      priority,
      task_type,
      assignee_id || null,
      auth.userId,
      estimated_hours || 0,
      due_date || null,
      JSON.stringify(tags),
      (maxOrder?.max_order || 0) + 1,
    ]);

    const taskId = result.insertId;

    // Log the action
    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'create',
      entity_type: 'task',
      entity_id: taskId,
      new_values: { task_number: taskNumber, title, project_id },
      ip_address: getClientIP(request),
    });

    const task = await queryOne<Task>(`
      SELECT t.*, p.name as project_name, u.display_name as assignee_name
      FROM prj_tasks t
      JOIN prj_projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?
    `, [taskId]);

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error: any) {
    console.error('Create task error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

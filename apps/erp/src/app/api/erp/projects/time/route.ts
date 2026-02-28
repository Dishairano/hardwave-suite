import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { TimeEntry } from '@/lib/erp-types';

// GET /api/erp/projects/time - List time entries
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const projectId = searchParams.get('project_id');
    const taskId = searchParams.get('task_id');
    const userId = searchParams.get('user_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const billable = searchParams.get('billable');
    const billed = searchParams.get('billed');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (projectId) {
      whereClause += ' AND te.project_id = ?';
      params.push(parseInt(projectId));
    }

    if (taskId) {
      whereClause += ' AND te.task_id = ?';
      params.push(parseInt(taskId));
    }

    if (userId) {
      if (userId === 'me') {
        whereClause += ' AND te.user_id = ?';
        params.push(auth.userId);
      } else {
        whereClause += ' AND te.user_id = ?';
        params.push(parseInt(userId));
      }
    }

    if (startDate) {
      whereClause += ' AND DATE(te.start_time) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND DATE(te.start_time) <= ?';
      params.push(endDate);
    }

    if (billable !== null && billable !== undefined) {
      whereClause += ' AND te.billable = ?';
      params.push(billable === 'true');
    }

    if (billed !== null && billed !== undefined) {
      whereClause += ' AND te.billed = ?';
      params.push(billed === 'true');
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM prj_time_entries te
      JOIN prj_projects p ON te.project_id = p.id
      LEFT JOIN prj_tasks t ON te.task_id = t.id
      JOIN users u ON te.user_id = u.id
      ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Get sum of hours
    const sumResult = await queryOne<{ total_minutes: number }>(
      `SELECT SUM(te.duration_minutes) as total_minutes FROM prj_time_entries te
      JOIN prj_projects p ON te.project_id = p.id
      LEFT JOIN prj_tasks t ON te.task_id = t.id
      JOIN users u ON te.user_id = u.id
      ${whereClause}`, params
    );
    const totalMinutes = sumResult?.total_minutes || 0;

    // Main query with ordering and pagination
    const sql = `
      SELECT
        te.*,
        p.name as project_name,
        p.project_code,
        t.title as task_title,
        t.task_number,
        u.display_name as user_name
      FROM prj_time_entries te
      JOIN prj_projects p ON te.project_id = p.id
      LEFT JOIN prj_tasks t ON te.task_id = t.id
      JOIN users u ON te.user_id = u.id
      ${whereClause} ORDER BY te.start_time DESC LIMIT ? OFFSET ?
    `;

    const entries = await query<TimeEntry[]>(sql, [...params, limit, offset]);

    return NextResponse.json({
      ...buildPaginationResponse(entries, total, page, limit),
      summary: {
        totalHours: Math.round(totalMinutes / 60 * 100) / 100,
        totalMinutes,
      },
    });
  } catch (error: any) {
    console.error('Get time entries error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/projects/time - Create time entry (start timer or log time)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const body = await request.json();

    const {
      project_id,
      task_id,
      description,
      start_time,
      end_time,
      duration_minutes,
      billable = true,
      start_timer = false,
    } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Verify project exists
    const project = await queryOne<any>('SELECT id, hourly_rate FROM prj_projects WHERE id = ?', [project_id]);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user already has a running timer
    if (start_timer) {
      const running = await queryOne<any>(`
        SELECT id FROM prj_time_entries WHERE user_id = ? AND is_running = TRUE
      `, [auth.userId]);

      if (running) {
        return NextResponse.json({ error: 'You already have a running timer' }, { status: 400 });
      }
    }

    const entryStartTime = start_timer ? new Date() : new Date(start_time);
    const entryEndTime = start_timer ? null : (end_time ? new Date(end_time) : null);

    let calculatedDuration = duration_minutes || 0;
    if (!start_timer && entryEndTime) {
      calculatedDuration = Math.round((entryEndTime.getTime() - entryStartTime.getTime()) / 60000);
    }

    const result = await query<any>(`
      INSERT INTO prj_time_entries (
        project_id, task_id, user_id, description, start_time, end_time,
        duration_minutes, billable, hourly_rate, is_running
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      project_id,
      task_id || null,
      auth.userId,
      description || null,
      entryStartTime,
      entryEndTime,
      calculatedDuration,
      billable,
      project.hourly_rate || 0,
      start_timer,
    ]);

    const entryId = result.insertId;

    // Update task actual_hours if task_id provided
    if (task_id && calculatedDuration > 0) {
      await query(`
        UPDATE prj_tasks
        SET actual_hours = actual_hours + ?
        WHERE id = ?
      `, [calculatedDuration / 60, task_id]);
    }

    // Log the action
    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: start_timer ? 'start_timer' : 'log_time',
      entity_type: 'time_entry',
      entity_id: entryId,
      new_values: { project_id, task_id, duration_minutes: calculatedDuration },
      ip_address: getClientIP(request),
    });

    const entry = await queryOne<TimeEntry>(`
      SELECT te.*, p.name as project_name, t.title as task_title
      FROM prj_time_entries te
      JOIN prj_projects p ON te.project_id = p.id
      LEFT JOIN prj_tasks t ON te.task_id = t.id
      WHERE te.id = ?
    `, [entryId]);

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error: any) {
    console.error('Create time entry error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

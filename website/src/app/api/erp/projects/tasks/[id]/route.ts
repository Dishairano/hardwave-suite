import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { Task, TaskComment } from '@/lib/erp-types';

// GET /api/erp/projects/tasks/[id] - Get task details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'read');
    const { id } = await params;
    const taskId = parseInt(id);

    const task = await queryOne<any>(`
      SELECT
        t.*,
        p.name as project_name,
        p.project_code,
        m.name as milestone_name,
        u1.display_name as assignee_name,
        u1.email as assignee_email,
        u2.display_name as reporter_name
      FROM prj_tasks t
      JOIN prj_projects p ON t.project_id = p.id
      LEFT JOIN prj_milestones m ON t.milestone_id = m.id
      LEFT JOIN users u1 ON t.assignee_id = u1.id
      LEFT JOIN users u2 ON t.reporter_id = u2.id
      WHERE t.id = ?
    `, [taskId]);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Parse JSON fields
    task.tags = parseJsonField(task.tags, []);

    // Get comments
    const comments = await query<TaskComment[]>(`
      SELECT c.*, u.display_name as user_name
      FROM prj_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `, [taskId]);

    // Get subtasks
    const subtasks = await query<Task[]>(`
      SELECT t.*, u.display_name as assignee_name
      FROM prj_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.parent_task_id = ?
      ORDER BY t.sort_order
    `, [taskId]);

    // Get time entries for this task
    const timeEntries = await query<any[]>(`
      SELECT te.*, u.display_name as user_name
      FROM prj_time_entries te
      JOIN users u ON te.user_id = u.id
      WHERE te.task_id = ?
      ORDER BY te.start_time DESC
      LIMIT 10
    `, [taskId]);

    return NextResponse.json({
      task,
      comments,
      subtasks,
      timeEntries,
    });
  } catch (error: any) {
    console.error('Get task error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/projects/tasks/[id] - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const { id } = await params;
    const taskId = parseInt(id);
    const body = await request.json();

    // Get existing task
    const existing = await queryOne<Task>('SELECT * FROM prj_tasks WHERE id = ?', [taskId]);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const allowedFields = [
      'milestone_id', 'parent_task_id', 'title', 'description',
      'status', 'priority', 'task_type', 'assignee_id',
      'estimated_hours', 'due_date', 'tags', 'sort_order'
    ];

    const updates: string[] = [];
    const values: any[] = [];
    const changes: Record<string, any> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        let value = body[field];

        // Handle special fields
        if (field === 'tags') {
          value = JSON.stringify(value);
        }

        updates.push(`${field} = ?`);
        values.push(value);
        changes[field] = { old: (existing as any)[field], new: body[field] };
      }
    }

    // Handle status changes with timestamps
    if (body.status && body.status !== existing.status) {
      if (body.status === 'in_progress' && !existing.started_at) {
        updates.push('started_at = NOW()');
      }
      if (body.status === 'done' || body.status === 'cancelled') {
        updates.push('completed_at = NOW()');
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(taskId);
    await query(`UPDATE prj_tasks SET ${updates.join(', ')} WHERE id = ?`, values);

    // Log the action
    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'update',
      entity_type: 'task',
      entity_id: taskId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<Task>(`
      SELECT t.*, p.name as project_name, u.display_name as assignee_name
      FROM prj_tasks t
      JOIN prj_projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?
    `, [taskId]);

    return NextResponse.json({ success: true, task: updated });
  } catch (error: any) {
    console.error('Update task error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/projects/tasks/[id] - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'delete');
    const { id } = await params;
    const taskId = parseInt(id);

    const existing = await queryOne<Task>('SELECT * FROM prj_tasks WHERE id = ?', [taskId]);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Delete the task (subtasks will be orphaned - their parent_task_id set to null)
    await query('DELETE FROM prj_tasks WHERE id = ?', [taskId]);

    // Log the action
    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'delete',
      entity_type: 'task',
      entity_id: taskId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete task error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

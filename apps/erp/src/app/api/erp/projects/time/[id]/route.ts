import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { TimeEntry } from '@/lib/erp-types';

// GET /api/erp/projects/time/[id] - Get time entry details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'read');
    const { id } = await params;
    const entryId = parseInt(id);

    const entry = await queryOne<TimeEntry>(`
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
      WHERE te.id = ?
    `, [entryId]);

    if (!entry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error: any) {
    console.error('Get time entry error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/projects/time/[id] - Update time entry or stop timer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const { id } = await params;
    const entryId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<TimeEntry>('SELECT * FROM prj_time_entries WHERE id = ?', [entryId]);
    if (!existing) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }

    // Only allow editing own entries unless admin
    if (existing.user_id !== auth.userId && !auth.isAdmin) {
      return NextResponse.json({ error: 'Not authorized to edit this time entry' }, { status: 403 });
    }

    // Handle stop timer action
    if (body.stop_timer && existing.is_running) {
      const endTime = new Date();
      const startTime = new Date(existing.start_time);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      await query(`
        UPDATE prj_time_entries
        SET end_time = ?, duration_minutes = ?, is_running = FALSE, description = COALESCE(?, description)
        WHERE id = ?
      `, [endTime, durationMinutes, body.description || null, entryId]);

      // Update task actual_hours
      if (existing.task_id) {
        await query(`
          UPDATE prj_tasks
          SET actual_hours = actual_hours + ?
          WHERE id = ?
        `, [durationMinutes / 60, existing.task_id]);
      }

      // Log the action
      await logERPAction({
        user_id: auth.userId,
        module: 'projects',
        action: 'stop_timer',
        entity_type: 'time_entry',
        entity_id: entryId,
        new_values: { duration_minutes: durationMinutes },
        ip_address: getClientIP(request),
      });

      const updated = await queryOne<TimeEntry>(`
        SELECT te.*, p.name as project_name, t.title as task_title
        FROM prj_time_entries te
        JOIN prj_projects p ON te.project_id = p.id
        LEFT JOIN prj_tasks t ON te.task_id = t.id
        WHERE te.id = ?
      `, [entryId]);

      return NextResponse.json({ success: true, entry: updated });
    }

    // Regular update
    const allowedFields = ['task_id', 'description', 'start_time', 'end_time', 'duration_minutes', 'billable'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Recalculate duration if start/end changed
    if (body.start_time || body.end_time) {
      const startTime = new Date(body.start_time || existing.start_time);
      const endTime = body.end_time ? new Date(body.end_time) : (existing.end_time ? new Date(existing.end_time) : null);

      if (endTime) {
        const newDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
        updates.push('duration_minutes = ?');
        values.push(newDuration);

        // Update task hours if changed
        if (existing.task_id) {
          const hoursDiff = (newDuration - (existing.duration_minutes || 0)) / 60;
          await query(`
            UPDATE prj_tasks SET actual_hours = actual_hours + ? WHERE id = ?
          `, [hoursDiff, existing.task_id]);
        }
      }
    }

    if (updates.length > 0) {
      values.push(entryId);
      await query(`UPDATE prj_time_entries SET ${updates.join(', ')} WHERE id = ?`, values);

      await logERPAction({
        user_id: auth.userId,
        module: 'projects',
        action: 'update',
        entity_type: 'time_entry',
        entity_id: entryId,
        old_values: sanitizeForAudit(existing as any),
        new_values: sanitizeForAudit(body),
        ip_address: getClientIP(request),
      });
    }

    const updated = await queryOne<TimeEntry>(`
      SELECT te.*, p.name as project_name, t.title as task_title
      FROM prj_time_entries te
      JOIN prj_projects p ON te.project_id = p.id
      LEFT JOIN prj_tasks t ON te.task_id = t.id
      WHERE te.id = ?
    `, [entryId]);

    return NextResponse.json({ success: true, entry: updated });
  } catch (error: any) {
    console.error('Update time entry error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/projects/time/[id] - Delete time entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'delete');
    const { id } = await params;
    const entryId = parseInt(id);

    const existing = await queryOne<TimeEntry>('SELECT * FROM prj_time_entries WHERE id = ?', [entryId]);
    if (!existing) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
    }

    // Check if billed
    if (existing.billed) {
      return NextResponse.json({ error: 'Cannot delete billed time entries' }, { status: 400 });
    }

    // Revert task hours
    if (existing.task_id && existing.duration_minutes) {
      await query(`
        UPDATE prj_tasks SET actual_hours = actual_hours - ? WHERE id = ?
      `, [existing.duration_minutes / 60, existing.task_id]);
    }

    await query('DELETE FROM prj_time_entries WHERE id = ?', [entryId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'delete',
      entity_type: 'time_entry',
      entity_id: entryId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete time entry error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

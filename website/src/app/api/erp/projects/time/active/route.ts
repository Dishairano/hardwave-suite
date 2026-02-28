import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission } from '@/lib/erp';
import { queryOne } from '@/lib/db';
import type { TimeEntry } from '@/lib/erp-types';

// GET /api/erp/projects/time/active - Get user's active timer
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'read');

    const activeEntry = await queryOne<TimeEntry>(`
      SELECT
        te.*,
        p.name as project_name,
        p.project_code,
        t.title as task_title,
        t.task_number
      FROM prj_time_entries te
      JOIN prj_projects p ON te.project_id = p.id
      LEFT JOIN prj_tasks t ON te.task_id = t.id
      WHERE te.user_id = ? AND te.is_running = TRUE
    `, [auth.userId]);

    return NextResponse.json({
      isRunning: !!activeEntry,
      entry: activeEntry || null,
    });
  } catch (error: any) {
    console.error('Get active timer error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

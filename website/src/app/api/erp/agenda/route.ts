import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { AgendaEvent } from '@/lib/erp-types';

// GET /api/erp/agenda - List events with date range filter
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'read');
    const { searchParams } = new URL(request.url);

    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const module = searchParams.get('module');
    const userId = searchParams.get('user_id');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (start) {
      whereClause += ' AND e.start_datetime >= ?';
      params.push(start);
    }

    if (end) {
      whereClause += ' AND e.start_datetime <= ?';
      params.push(end);
    }

    if (module) {
      whereClause += ' AND e.module = ?';
      params.push(module);
    }

    if (userId) {
      whereClause += ' AND (e.created_by = ? OR e.assigned_to = ?)';
      params.push(parseInt(userId), parseInt(userId));
    }

    const events = await query<AgendaEvent[]>(`
      SELECT
        e.*,
        u1.display_name as created_by_name,
        u2.display_name as assigned_to_name
      FROM erp_agenda_events e
      LEFT JOIN users u1 ON e.created_by = u1.id
      LEFT JOIN users u2 ON e.assigned_to = u2.id
      ${whereClause}
      ORDER BY e.start_datetime ASC
    `, params);

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('List agenda events error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/agenda - Create event
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const {
      title,
      description,
      start_datetime,
      end_datetime,
      all_day,
      color,
      module: eventModule,
      entity_type,
      entity_id,
      assigned_to,
    } = body;

    if (!title || !start_datetime) {
      return NextResponse.json(
        { error: 'Title and start_datetime are required' },
        { status: 400 }
      );
    }

    const result = await queryOne<{ insertId: number }>(`
      INSERT INTO erp_agenda_events
        (title, description, start_datetime, end_datetime, all_day, color, module, entity_type, entity_id, created_by, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description || null,
      start_datetime,
      end_datetime || null,
      all_day ? 1 : 0,
      color || '#40E0D0',
      eventModule || null,
      entity_type || null,
      entity_id || null,
      auth.userId,
      assigned_to || null,
    ]);

    const insertId = (result as any)?.insertId ?? (result as any)?.id;

    await logERPAction({
      userId: auth.userId,
      action: 'create',
      module: 'settings',
      entity: 'agenda_event',
      entityId: insertId,
      details: { title, start_datetime },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ id: insertId, message: 'Event created' }, { status: 201 });
  } catch (error: any) {
    console.error('Create agenda event error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

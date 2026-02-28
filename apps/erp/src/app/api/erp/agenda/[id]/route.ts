import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { AgendaEvent } from '@/lib/erp-types';

// GET /api/erp/agenda/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { id } = await params;
    const eventId = parseInt(id);

    const event = await queryOne<AgendaEvent>(`
      SELECT
        e.*,
        u1.display_name as created_by_name,
        u2.display_name as assigned_to_name
      FROM erp_agenda_events e
      LEFT JOIN users u1 ON e.created_by = u1.id
      LEFT JOIN users u2 ON e.assigned_to = u2.id
      WHERE e.id = ?
    `, [eventId]);

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error: any) {
    console.error('Get agenda event error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/agenda/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const { id } = await params;
    const eventId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<AgendaEvent>(
      'SELECT * FROM erp_agenda_events WHERE id = ?',
      [eventId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const fields: string[] = [];
    const values: any[] = [];

    const updatable = [
      'title', 'description', 'start_datetime', 'end_datetime',
      'all_day', 'color', 'module', 'entity_type', 'entity_id', 'assigned_to',
    ];

    for (const field of updatable) {
      if (field in body) {
        fields.push(`${field} = ?`);
        if (field === 'all_day') {
          values.push(body[field] ? 1 : 0);
        } else {
          values.push(body[field] ?? null);
        }
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(eventId);
    await query(
      `UPDATE erp_agenda_events SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    await logERPAction({
      userId: auth.userId,
      action: 'update',
      module: 'settings',
      entity: 'agenda_event',
      entityId: eventId,
      details: body,
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ message: 'Event updated' });
  } catch (error: any) {
    console.error('Update agenda event error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/agenda/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const { id } = await params;
    const eventId = parseInt(id);

    const existing = await queryOne<AgendaEvent>(
      'SELECT * FROM erp_agenda_events WHERE id = ?',
      [eventId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await query('DELETE FROM erp_agenda_events WHERE id = ?', [eventId]);

    await logERPAction({
      userId: auth.userId,
      action: 'delete',
      module: 'settings',
      entity: 'agenda_event',
      entityId: eventId,
      details: { title: existing.title },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ message: 'Event deleted' });
  } catch (error: any) {
    console.error('Delete agenda event error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

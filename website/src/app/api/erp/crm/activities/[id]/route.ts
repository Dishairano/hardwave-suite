import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/crm/activities/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'crm', 'read');
    const { id } = await params;

    const activity = await queryOne<any>(`
      SELECT a.*,
        u.display_name as user_name,
        c.first_name as contact_first_name, c.last_name as contact_last_name,
        comp.name as company_name,
        d.name as deal_name
      FROM crm_activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN crm_contacts c ON a.contact_id = c.id
      LEFT JOIN crm_companies comp ON a.company_id = comp.id
      LEFT JOIN crm_deals d ON a.deal_id = d.id
      WHERE a.id = ?
    `, [parseInt(id)]);

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json({ activity });
  } catch (error: any) {
    console.error('Get activity error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/crm/activities/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const { id } = await params;
    const activityId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM crm_activities WHERE id = ?', [activityId]);
    if (!existing) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    const allowedFields = [
      'activity_type', 'subject', 'description', 'contact_id', 'company_id', 'deal_id',
      'assigned_to', 'due_date', 'completed_at', 'duration_minutes', 'outcome',
      'priority', 'is_completed', 'reminder_at', 'location', 'meeting_link',
      'call_recording_url', 'email_message_id'
    ];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(activityId);
    await query(`UPDATE crm_activities SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'update',
      entity_type: 'activity',
      entity_id: activityId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>('SELECT * FROM crm_activities WHERE id = ?', [activityId]);
    return NextResponse.json({ success: true, activity: updated });
  } catch (error: any) {
    console.error('Update activity error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/crm/activities/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'delete');
    const { id } = await params;
    const activityId = parseInt(id);

    const existing = await queryOne<any>('SELECT * FROM crm_activities WHERE id = ?', [activityId]);
    if (!existing) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    await query('DELETE FROM crm_activities WHERE id = ?', [activityId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'delete',
      entity_type: 'activity',
      entity_id: activityId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete activity error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/projects/team/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'projects', 'read');
    const { id } = await params;

    const member = await queryOne<any>(`
      SELECT tm.*, u.display_name, u.email, p.name as project_name
      FROM prj_team_members tm
      JOIN users u ON tm.user_id = u.id
      JOIN prj_projects p ON tm.project_id = p.id
      WHERE tm.id = ?
    `, [parseInt(id)]);

    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    return NextResponse.json({ member });
  } catch (error: any) {
    console.error('Get team member error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/projects/team/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'write');
    const { id } = await params;
    const memberId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM prj_team_members WHERE id = ?', [memberId]);
    if (!existing) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    const allowedFields = ['role', 'hourly_rate', 'is_active'];
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

    values.push(memberId);
    await query(`UPDATE prj_team_members SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'update_team_member',
      entity_type: 'team_member',
      entity_id: memberId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>(`
      SELECT tm.*, u.display_name, u.email
      FROM prj_team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.id = ?
    `, [memberId]);

    return NextResponse.json({ success: true, member: updated });
  } catch (error: any) {
    console.error('Update team member error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/projects/team/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'projects', 'delete');
    const { id } = await params;
    const memberId = parseInt(id);

    const existing = await queryOne<any>('SELECT * FROM prj_team_members WHERE id = ?', [memberId]);
    if (!existing) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    await query('DELETE FROM prj_team_members WHERE id = ?', [memberId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'projects',
      action: 'remove_team_member',
      entity_type: 'team_member',
      entity_id: memberId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove team member error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

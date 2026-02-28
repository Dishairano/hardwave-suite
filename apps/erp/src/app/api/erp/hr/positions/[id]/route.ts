import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/hr/positions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { id } = await params;

    const position = await queryOne<any>(`
      SELECT p.*, d.name as department_name
      FROM hr_positions p
      LEFT JOIN hr_departments d ON p.department_id = d.id
      WHERE p.id = ?
    `, [parseInt(id)]);

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    const employees = await query<any[]>(`
      SELECT e.id, e.first_name, e.last_name, e.email, e.employment_status
      FROM hr_employees e
      WHERE e.position_id = ?
      ORDER BY e.last_name, e.first_name
    `, [parseInt(id)]);

    return NextResponse.json({ position, employees });
  } catch (error: any) {
    console.error('Get position error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/hr/positions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const positionId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM hr_positions WHERE id = ?', [positionId]);
    if (!existing) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    const allowedFields = ['title', 'level', 'department_id', 'description', 'min_salary', 'max_salary', 'is_active'];
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

    values.push(positionId);
    await query(`UPDATE hr_positions SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'update',
      entity_type: 'position',
      entity_id: positionId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>('SELECT * FROM hr_positions WHERE id = ?', [positionId]);
    return NextResponse.json({ success: true, position: updated });
  } catch (error: any) {
    console.error('Update position error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/hr/positions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'delete');
    const { id } = await params;
    const positionId = parseInt(id);

    const existing = await queryOne<any>('SELECT * FROM hr_positions WHERE id = ?', [positionId]);
    if (!existing) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    const employees = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM hr_employees WHERE position_id = ?', [positionId]);
    if (employees && employees.count > 0) {
      return NextResponse.json({ error: 'Cannot delete position with employees' }, { status: 400 });
    }

    await query('DELETE FROM hr_positions WHERE id = ?', [positionId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'delete',
      entity_type: 'position',
      entity_id: positionId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete position error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

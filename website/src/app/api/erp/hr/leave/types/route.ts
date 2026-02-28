import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/hr/leave/types
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'hr', 'read');

    const types = await query<any[]>(`
      SELECT lt.*,
        (SELECT COUNT(*) FROM hr_leave_requests WHERE leave_type_id = lt.id) as request_count
      FROM hr_leave_types lt
      ORDER BY lt.name
    `);

    return NextResponse.json({ types });
  } catch (error: any) {
    console.error('Get leave types error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/leave/types
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const body = await request.json();

    const { name, description, default_days, is_paid = true, requires_approval = true, is_active = true } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO hr_leave_types (name, description, default_days, is_paid, requires_approval, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, description || null, default_days || 0, is_paid, requires_approval, is_active]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'create',
      entity_type: 'leave_type',
      entity_id: result.insertId,
      new_values: { name, default_days },
      ip_address: getClientIP(request),
    });

    const leaveType = await queryOne<any>('SELECT * FROM hr_leave_types WHERE id = ?', [result.insertId]);

    return NextResponse.json({ success: true, type: leaveType }, { status: 201 });
  } catch (error: any) {
    console.error('Create leave type error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

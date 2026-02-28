import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/hr/positions
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const departmentId = searchParams.get('department_id');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (departmentId) {
      whereClause += ' AND p.department_id = ?';
      params.push(parseInt(departmentId));
    }

    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM hr_positions p ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT p.*, d.name as department_name,
        (SELECT COUNT(*) FROM hr_employees WHERE position_id = p.id AND employment_status = 'active') as employee_count
      FROM hr_positions p
      LEFT JOIN hr_departments d ON p.department_id = d.id
      ${whereClause}
      ORDER BY p.title ASC LIMIT ? OFFSET ?
    `;

    const positions = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(positions, total, page, limit));
  } catch (error: any) {
    console.error('Get positions error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/positions
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const body = await request.json();

    const { title, department_id, description, min_salary, max_salary, is_active = true } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO hr_positions (title, department_id, description, min_salary, max_salary, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, department_id || null, description || null, min_salary || null, max_salary || null, is_active]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'create',
      entity_type: 'position',
      entity_id: result.insertId,
      new_values: { title, department_id },
      ip_address: getClientIP(request),
    });

    const position = await queryOne<any>('SELECT * FROM hr_positions WHERE id = ?', [result.insertId]);

    return NextResponse.json({ success: true, position }, { status: 201 });
  } catch (error: any) {
    console.error('Create position error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

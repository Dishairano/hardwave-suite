import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRDepartment } from '@/lib/erp-types';

// GET /api/erp/hr/departments - List departments
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const parentId = searchParams.get('parent_id');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (parentId === 'null' || parentId === '') {
      whereClause += ' AND d.parent_id IS NULL';
    } else if (parentId) {
      whereClause += ' AND d.parent_id = ?';
      params.push(parseInt(parentId));
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM hr_departments d ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        d.*,
        p.name as parent_name,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name,
        (SELECT COUNT(*) FROM hr_employees WHERE department_id = d.id AND employment_status = 'active') as employee_count,
        (SELECT COUNT(*) FROM hr_departments WHERE parent_id = d.id) as subdepartment_count
      FROM hr_departments d
      LEFT JOIN hr_departments p ON d.parent_id = p.id
      LEFT JOIN hr_employees m ON d.manager_id = m.id
      ${whereClause}
      ORDER BY d.name ASC LIMIT ? OFFSET ?
    `;

    const departments = await query<HRDepartment[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(departments, total, page, limit));
  } catch (error: any) {
    console.error('Get departments error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/departments - Create department
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const body = await request.json();

    const {
      name,
      code,
      parent_id,
      manager_id,
      description,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    // Check for duplicate code
    if (code) {
      const existing = await queryOne<{ id: number }>(
        'SELECT id FROM hr_departments WHERE code = ?',
        [code]
      );
      if (existing) {
        return NextResponse.json({ error: 'Department code already exists' }, { status: 400 });
      }
    }

    const result = await query<any>(`
      INSERT INTO hr_departments (name, code, parent_id, manager_id, description)
      VALUES (?, ?, ?, ?, ?)
    `, [
      name,
      code || null,
      parent_id || null,
      manager_id || null,
      description || null,
    ]);

    const departmentId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'create',
      entity_type: 'department',
      entity_id: departmentId,
      new_values: { name, code },
      ip_address: getClientIP(request),
    });

    const department = await queryOne<HRDepartment>(
      'SELECT * FROM hr_departments WHERE id = ?',
      [departmentId]
    );

    return NextResponse.json({ success: true, department }, { status: 201 });
  } catch (error: any) {
    console.error('Create department error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

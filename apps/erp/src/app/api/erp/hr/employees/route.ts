import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HREmployee } from '@/lib/erp-types';

// GET /api/erp/hr/employees - List employees
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const departmentId = searchParams.get('department_id');
    const status = searchParams.get('status');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (
        e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?
        OR e.employee_number LIKE ? OR p.title LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (departmentId) {
      whereClause += ' AND e.department_id = ?';
      params.push(parseInt(departmentId));
    }

    if (status) {
      whereClause += ' AND e.employment_status = ?';
      params.push(status);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM hr_employees e
       LEFT JOIN hr_positions p ON e.position_id = p.id
       ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        e.*,
        d.name as department_name,
        p.title as position_title,
        u.email as user_email,
        m.first_name as manager_first_name,
        m.last_name as manager_last_name
      FROM hr_employees e
      LEFT JOIN hr_departments d ON e.department_id = d.id
      LEFT JOIN hr_positions p ON e.position_id = p.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN hr_employees m ON e.manager_id = m.id
      ${whereClause}
      ORDER BY e.last_name, e.first_name ASC LIMIT ? OFFSET ?
    `;

    const employees = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(employees, total, page, limit));
  } catch (error: any) {
    console.error('Get employees error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/employees - Create employee
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const body = await request.json();

    const {
      user_id,
      employee_number,
      first_name,
      last_name,
      email,
      phone,
      department_id,
      position_id,
      manager_id,
      hire_date,
      employment_type = 'full_time',
      salary,
      currency = 'USD',
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      date_of_birth,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relation,
    } = body;

    if (!first_name || !last_name || !hire_date) {
      return NextResponse.json(
        { error: 'First name, last name, and hire date are required' },
        { status: 400 }
      );
    }

    // Generate employee number if not provided
    let empNumber = employee_number;
    if (!empNumber) {
      const lastEmployee = await queryOne<{ employee_number: string }>(
        `SELECT employee_number FROM hr_employees ORDER BY id DESC LIMIT 1`
      );
      const lastNum = lastEmployee?.employee_number
        ? parseInt(lastEmployee.employee_number.replace('EMP', ''))
        : 0;
      empNumber = `EMP${String(lastNum + 1).padStart(5, '0')}`;
    }

    const result = await query<any>(`
      INSERT INTO hr_employees (
        user_id, employee_number, first_name, last_name, email, phone,
        department_id, position_id, manager_id, hire_date, employment_type,
        salary, currency, address_line1, address_line2, city,
        state, postal_code, country, date_of_birth,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        employment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `, [
      user_id || null,
      empNumber,
      first_name,
      last_name,
      email || null,
      phone || null,
      department_id || null,
      position_id || null,
      manager_id || null,
      hire_date,
      employment_type,
      salary || null,
      currency,
      address_line1 || null,
      address_line2 || null,
      city || null,
      state || null,
      postal_code || null,
      country || null,
      date_of_birth || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      emergency_contact_relation || null,
    ]);

    const employeeId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'create',
      entity_type: 'employee',
      entity_id: employeeId,
      new_values: { employee_number: empNumber, first_name, last_name },
      ip_address: getClientIP(request),
    });

    const employee = await queryOne<HREmployee>(`
      SELECT e.*, d.name as department_name, p.title as position_title
      FROM hr_employees e
      LEFT JOIN hr_departments d ON e.department_id = d.id
      LEFT JOIN hr_positions p ON e.position_id = p.id
      WHERE e.id = ?
    `, [employeeId]);

    return NextResponse.json({ success: true, employee }, { status: 201 });
  } catch (error: any) {
    console.error('Create employee error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

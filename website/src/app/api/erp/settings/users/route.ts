import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/erp/settings/users - List users
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role');
    const status = searchParams.get('status');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (u.display_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      whereClause += ' AND u.role = ?';
      params.push(role);
    }

    if (status === 'active') {
      whereClause += ' AND u.is_active = TRUE';
    } else if (status === 'inactive') {
      whereClause += ' AND u.is_active = FALSE';
    }

    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        u.id,
        u.display_name,
        u.email,
        u.phone,
        u.address_line1,
        u.address_line2,
        u.city,
        u.state,
        u.postal_code,
        u.country,
        u.notes,
        u.role as system_role,
        u.is_active,
        u.created_at,
        u.last_login,
        (SELECT COUNT(*) FROM erp_user_roles WHERE user_id = u.id AND is_active = TRUE) as erp_role_count
      FROM users u
      ${whereClause}
      ORDER BY u.display_name ASC LIMIT ? OFFSET ?
    `;

    const users = await query<any[]>(sql, [...params, limit, offset]);

    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roles = await query<any[]>(`
          SELECT ur.id, ur.module, r.name as role_name
          FROM erp_user_roles ur
          JOIN erp_roles r ON ur.role_id = r.id
          WHERE ur.user_id = ? AND ur.is_active = TRUE
          ORDER BY ur.module
        `, [user.id]);

        return { ...user, erp_roles: roles };
      })
    );

    return NextResponse.json(buildPaginationResponse(usersWithRoles, total, page, limit));
  } catch (error: any) {
    console.error('Get users error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/settings/users - Create user
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const {
      display_name, email, password, role = 'user', is_active = true,
      phone, address_line1, address_line2, city, state, postal_code, country, notes,
    } = body;

    if (!display_name || !email || !password) {
      return NextResponse.json(
        { error: 'display_name, email, and password are required' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existing = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query<any>(`
      INSERT INTO users (display_name, email, password_hash, role, is_active, phone, address_line1, address_line2, city, state, postal_code, country, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [display_name, email, passwordHash, role, is_active, phone || null, address_line1 || null, address_line2 || null, city || null, state || null, postal_code || null, country || null, notes || null]);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'create',
      entity_type: 'user',
      entity_id: result.insertId,
      new_values: sanitizeForAudit({ display_name, email, role, phone, city, country }),
      ip_address: getClientIP(request),
    });

    const user = await queryOne<any>(
      'SELECT id, display_name, email, role, is_active, phone, city, country, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error: any) {
    console.error('Create user error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

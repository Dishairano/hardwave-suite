import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/settings/roles - List all ERP roles
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'settings', 'read');

    const roles = await query<any[]>(`
      SELECT
        r.*,
        (SELECT COUNT(*) FROM erp_user_roles WHERE role_id = r.id) as user_count
      FROM erp_roles r
      ORDER BY r.name ASC
    `);

    // Parse permissions JSON
    const parsedRoles = roles.map(role => ({
      ...role,
      permissions: typeof role.permissions === 'string'
        ? JSON.parse(role.permissions)
        : role.permissions,
    }));

    return NextResponse.json({ roles: parsedRoles });
  } catch (error: any) {
    console.error('Get roles error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/settings/roles - Create new role
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const { name, description, permissions = {} } = body;

    if (!name) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Check for duplicate name
    const existing = await queryOne<any>('SELECT id FROM erp_roles WHERE name = ?', [name]);
    if (existing) {
      return NextResponse.json({ error: 'Role name already exists' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO erp_roles (name, description, permissions)
      VALUES (?, ?, ?)
    `, [name, description || null, JSON.stringify(permissions)]);

    const roleId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'create',
      entity_type: 'role',
      entity_id: roleId,
      new_values: { name, permissions },
      ip_address: getClientIP(request),
    });

    const role = await queryOne<any>('SELECT * FROM erp_roles WHERE id = ?', [roleId]);

    return NextResponse.json({
      success: true,
      role: {
        ...role,
        permissions: typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions,
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create role error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

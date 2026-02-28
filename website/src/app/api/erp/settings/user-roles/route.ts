import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/settings/user-roles - List user role assignments
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const userId = searchParams.get('user_id');
    const roleId = searchParams.get('role_id');
    const module = searchParams.get('module');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND ur.user_id = ?';
      params.push(parseInt(userId));
    }

    if (roleId) {
      whereClause += ' AND ur.role_id = ?';
      params.push(parseInt(roleId));
    }

    if (module) {
      whereClause += ' AND ur.module = ?';
      params.push(module);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM erp_user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN erp_roles r ON ur.role_id = r.id
      LEFT JOIN users g ON ur.granted_by = g.id
      ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Main query with ordering and pagination
    const sql = `
      SELECT
        ur.*,
        u.display_name as user_name,
        u.email as user_email,
        r.name as role_name,
        r.description as role_description,
        g.display_name as granted_by_name
      FROM erp_user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN erp_roles r ON ur.role_id = r.id
      LEFT JOIN users g ON ur.granted_by = g.id
      ${whereClause} ORDER BY u.display_name ASC, ur.module ASC LIMIT ? OFFSET ?
    `;

    const assignments = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(assignments, total, page, limit));
  } catch (error: any) {
    console.error('Get user roles error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/settings/user-roles - Assign role to user
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const { user_id, role_id, module } = body;

    if (!user_id || !role_id || !module) {
      return NextResponse.json(
        { error: 'user_id, role_id, and module are required' },
        { status: 400 }
      );
    }

    // Validate user exists
    const user = await queryOne<any>('SELECT id, display_name FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate role exists
    const role = await queryOne<any>('SELECT id, name FROM erp_roles WHERE id = ?', [role_id]);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Check for duplicate assignment
    const existing = await queryOne<any>(
      'SELECT id FROM erp_user_roles WHERE user_id = ? AND role_id = ? AND module = ?',
      [user_id, role_id, module]
    );
    if (existing) {
      return NextResponse.json(
        { error: 'This role is already assigned to this user for this module' },
        { status: 400 }
      );
    }

    const result = await query<any>(`
      INSERT INTO erp_user_roles (user_id, role_id, module, granted_by)
      VALUES (?, ?, ?, ?)
    `, [user_id, role_id, module, auth.userId]);

    const assignmentId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'assign_role',
      entity_type: 'user_role',
      entity_id: assignmentId,
      new_values: {
        user_id,
        user_name: user.display_name,
        role_id,
        role_name: role.name,
        module
      },
      ip_address: getClientIP(request),
    });

    const assignment = await queryOne<any>(`
      SELECT
        ur.*,
        u.display_name as user_name,
        u.email as user_email,
        r.name as role_name,
        g.display_name as granted_by_name
      FROM erp_user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN erp_roles r ON ur.role_id = r.id
      LEFT JOIN users g ON ur.granted_by = g.id
      WHERE ur.id = ?
    `, [assignmentId]);

    return NextResponse.json({ success: true, assignment }, { status: 201 });
  } catch (error: any) {
    console.error('Assign role error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/settings/user-roles - Update role assignment
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const { id, role_id, module } = body;

    if (!id) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
    }

    const existing = await queryOne<any>(`
      SELECT
        ur.*,
        u.display_name as user_name,
        r.name as role_name
      FROM erp_user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN erp_roles r ON ur.role_id = r.id
      WHERE ur.id = ?
    `, [id]);

    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (role_id !== undefined) {
      const role = await queryOne<any>('SELECT id, name FROM erp_roles WHERE id = ?', [role_id]);
      if (!role) {
        return NextResponse.json({ error: 'Role not found' }, { status: 404 });
      }
      updates.push('role_id = ?');
      values.push(role_id);
    }

    if (module !== undefined) {
      updates.push('module = ?');
      values.push(module);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Check for duplicate assignment
    const duplicate = await queryOne<any>(
      'SELECT id FROM erp_user_roles WHERE user_id = ? AND role_id = ? AND module = ? AND id != ?',
      [existing.user_id, role_id || existing.role_id, module || existing.module, id]
    );
    if (duplicate) {
      return NextResponse.json(
        { error: 'This role is already assigned to this user for this module' },
        { status: 400 }
      );
    }

    values.push(id);
    await query(`UPDATE erp_user_roles SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'update_role',
      entity_type: 'user_role',
      entity_id: id,
      old_values: {
        role_id: existing.role_id,
        role_name: existing.role_name,
        module: existing.module,
      },
      new_values: { role_id, module },
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>(`
      SELECT
        ur.*,
        u.display_name as user_name,
        u.email as user_email,
        r.name as role_name,
        g.display_name as granted_by_name
      FROM erp_user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN erp_roles r ON ur.role_id = r.id
      LEFT JOIN users g ON ur.granted_by = g.id
      WHERE ur.id = ?
    `, [id]);

    return NextResponse.json({ success: true, assignment: updated });
  } catch (error: any) {
    console.error('Update role assignment error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/settings/user-roles - Revoke role from user
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const { searchParams } = new URL(request.url);

    const assignmentId = searchParams.get('id');
    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 });
    }

    const assignment = await queryOne<any>(`
      SELECT
        ur.*,
        u.display_name as user_name,
        r.name as role_name
      FROM erp_user_roles ur
      JOIN users u ON ur.user_id = u.id
      JOIN erp_roles r ON ur.role_id = r.id
      WHERE ur.id = ?
    `, [parseInt(assignmentId)]);

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    await query('DELETE FROM erp_user_roles WHERE id = ?', [parseInt(assignmentId)]);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'revoke_role',
      entity_type: 'user_role',
      entity_id: parseInt(assignmentId),
      old_values: {
        user_id: assignment.user_id,
        user_name: assignment.user_name,
        role_id: assignment.role_id,
        role_name: assignment.role_name,
        module: assignment.module,
      },
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Revoke role error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

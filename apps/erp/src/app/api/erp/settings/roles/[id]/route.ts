import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/settings/roles/[id] - Get single role
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { id } = await params;

    const role = await queryOne<any>(`
      SELECT
        r.*,
        (SELECT COUNT(*) FROM erp_user_roles WHERE role_id = r.id) as user_count
      FROM erp_roles r
      WHERE r.id = ?
    `, [parseInt(id)]);

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Get users with this role
    const users = await query<any[]>(`
      SELECT
        ur.id as assignment_id,
        ur.module,
        ur.created_at as assigned_at,
        u.id as user_id,
        u.display_name,
        u.email,
        g.display_name as granted_by_name
      FROM erp_user_roles ur
      JOIN users u ON ur.user_id = u.id
      LEFT JOIN users g ON ur.granted_by = g.id
      WHERE ur.role_id = ?
      ORDER BY u.display_name ASC
    `, [parseInt(id)]);

    return NextResponse.json({
      role: {
        ...role,
        permissions: typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions,
      },
      users,
    });
  } catch (error: any) {
    console.error('Get role error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/settings/roles/[id] - Update role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const { id } = await params;
    const body = await request.json();

    const roleId = parseInt(id);

    // Get existing role
    const existing = await queryOne<any>('SELECT * FROM erp_roles WHERE id = ?', [roleId]);
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Prevent modifying system roles
    if (['settings', 'manager', 'user', 'viewer'].includes(existing.name)) {
      if (body.name && body.name !== existing.name) {
        return NextResponse.json({ error: 'Cannot rename system roles' }, { status: 400 });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    const oldValues: any = {};
    const newValues: any = {};

    if (body.name !== undefined) {
      // Check for duplicate name
      const duplicate = await queryOne<any>(
        'SELECT id FROM erp_roles WHERE name = ? AND id != ?',
        [body.name, roleId]
      );
      if (duplicate) {
        return NextResponse.json({ error: 'Role name already exists' }, { status: 400 });
      }
      updates.push('name = ?');
      values.push(body.name);
      oldValues.name = existing.name;
      newValues.name = body.name;
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
      oldValues.description = existing.description;
      newValues.description = body.description;
    }

    if (body.permissions !== undefined) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(body.permissions));
      oldValues.permissions = existing.permissions;
      newValues.permissions = body.permissions;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(roleId);
    await query(`UPDATE erp_roles SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'update',
      entity_type: 'role',
      entity_id: roleId,
      old_values: oldValues,
      new_values: newValues,
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
      },
    });
  } catch (error: any) {
    console.error('Update role error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/settings/roles/[id] - Delete role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const { id } = await params;

    const roleId = parseInt(id);

    const role = await queryOne<any>('SELECT * FROM erp_roles WHERE id = ?', [roleId]);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Prevent deleting system roles
    if (['settings', 'manager', 'user', 'viewer'].includes(role.name)) {
      return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 400 });
    }

    // Check if role is in use
    const userCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM erp_user_roles WHERE role_id = ?',
      [roleId]
    );
    if (userCount && userCount.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete role: ${userCount.count} users have this role assigned` },
        { status: 400 }
      );
    }

    await query('DELETE FROM erp_roles WHERE id = ?', [roleId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'delete',
      entity_type: 'role',
      entity_id: roleId,
      old_values: { name: role.name },
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete role error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

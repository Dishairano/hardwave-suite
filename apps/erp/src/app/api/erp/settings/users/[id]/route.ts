import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/erp/settings/users/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { id } = await params;
    const userId = parseInt(id);

    const user = await queryOne<any>(`
      SELECT id, display_name, email, role, is_active, created_at, last_login,
             phone, address_line1, address_line2, city, state, postal_code, country, notes
      FROM users WHERE id = ?
    `, [userId]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const erpRoles = await query<any[]>(`
      SELECT ur.id, ur.module, ur.granted_at, r.id as role_id, r.name as role_name
      FROM erp_user_roles ur
      JOIN erp_roles r ON ur.role_id = r.id
      WHERE ur.user_id = ? AND ur.is_active = TRUE
      ORDER BY ur.module
    `, [userId]);

    return NextResponse.json({ user: { ...user, erp_roles: erpRoles } });
  } catch (error: any) {
    console.error('Get user error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/settings/users/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const { id } = await params;
    const userId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const allowedFields = [
      'display_name', 'email', 'role', 'is_active',
      'phone', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'notes',
    ];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    // Handle password update separately
    if (body.password) {
      const passwordHash = await bcrypt.hash(body.password, 12);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Check for duplicate email
    if (body.email && body.email !== existing.email) {
      const duplicate = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = ? AND id != ?', [body.email, userId]);
      if (duplicate) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
    }

    values.push(userId);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'update',
      entity_type: 'user',
      entity_id: userId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>(
      `SELECT id, display_name, email, role, is_active, phone, address_line1, address_line2,
              city, state, postal_code, country, notes, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('Update user error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/settings/users/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'delete');
    const { id } = await params;
    const userId = parseInt(id);

    if (userId === auth.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const existing = await queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete - just deactivate
    await query('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'delete',
      entity_type: 'user',
      entity_id: userId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete user error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

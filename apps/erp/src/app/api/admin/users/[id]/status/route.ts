import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

    const users = await query<any[]>(
      'SELECT id, is_admin FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].is_admin) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { active } = await request.json();

    await query(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );

    // Log the action
    await query(
      'INSERT INTO audit_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [admin.userId, active ? 'activate_user' : 'deactivate_user', 'user', id, JSON.stringify({ active })]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user status' }, { status: 500 });
  }
}

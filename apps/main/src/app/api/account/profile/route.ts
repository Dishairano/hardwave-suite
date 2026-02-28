import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { display_name, email } = body;

    if (!display_name && !email) {
      return NextResponse.json(
        { success: false, error: 'Nothing to update' },
        { status: 400 }
      );
    }

    // Check email isn't already taken by another user
    if (email) {
      const existing = await queryOne<any>(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, auth.userId]
      );
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Email already in use' },
          { status: 409 }
        );
      }
    }

    await query(
      `UPDATE users SET
        display_name = COALESCE(?, display_name),
        email = COALESCE(?, email)
       WHERE id = ?`,
      [display_name || null, email || null, auth.userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

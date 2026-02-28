import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    let decoded: { userId: number; email: string; isAdmin: boolean };
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your_secret_key'
      ) as typeof decoded;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const user = await queryOne<any>(
      `SELECT id, email, display_name, avatar_url, is_admin, role, is_active
       FROM users WHERE id = ?`,
      [decoded.userId]
    );

    if (!user || !user.is_active) {
      return NextResponse.json({ error: 'User not found or deactivated' }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: decoded.isAdmin,
      role: user.role,
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

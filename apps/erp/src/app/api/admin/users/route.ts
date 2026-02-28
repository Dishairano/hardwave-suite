import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (search) {
      whereClause = 'WHERE u.email LIKE ? OR u.display_name LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    const users = await query<any[]>(`
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.is_active,
        u.created_at,
        u.last_login_at,
        s.status as subscription_status,
        s.current_period_end,
        l.license_key
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status IN ('active', 'trialing', 'past_due')
      LEFT JOIN licenses l ON l.user_id = u.id AND l.status = 'active'
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const totalResult = await queryOne<any>(`
      SELECT COUNT(*) as count FROM users u ${whereClause}
    `, params);

    return NextResponse.json({
      success: true,
      users: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        isActive: u.is_active,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
        subscription: u.subscription_status ? {
          status: u.subscription_status,
          periodEnd: u.current_period_end,
        } : null,
        licenseKey: u.license_key,
      })),
      pagination: {
        page,
        limit,
        total: totalResult?.count || 0,
        totalPages: Math.ceil((totalResult?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

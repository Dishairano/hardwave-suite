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
    const status = searchParams.get('status') || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE s.status = ?';
      params.push(status);
    }

    const subscriptions = await query<any[]>(`
      SELECT
        s.*,
        u.email,
        u.display_name,
        l.license_key
      FROM subscriptions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN licenses l ON l.subscription_id = s.id AND l.status = 'active'
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const totalResult = await queryOne<any>(`
      SELECT COUNT(*) as count FROM subscriptions s ${whereClause}
    `, params);

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.map((s: any) => ({
        id: s.id,
        userId: s.user_id,
        userEmail: s.email,
        userName: s.display_name,
        stripeSubscriptionId: s.stripe_subscription_id,
        status: s.status,
        planName: s.plan_name,
        price: s.price_cents / 100,
        currency: s.currency,
        currentPeriodStart: s.current_period_start,
        currentPeriodEnd: s.current_period_end,
        cancelAtPeriodEnd: s.cancel_at_period_end,
        createdAt: s.created_at,
        licenseKey: s.license_key,
      })),
      pagination: {
        page,
        limit,
        total: totalResult?.count || 0,
        totalPages: Math.ceil((totalResult?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Admin subscriptions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

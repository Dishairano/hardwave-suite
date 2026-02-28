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

    // Get various stats
    const [
      totalUsers,
      activeSubscriptions,
      totalRevenue,
      recentSignups,
      monthlyRevenue,
    ] = await Promise.all([
      queryOne<any>('SELECT COUNT(*) as count FROM users'),
      queryOne<any>(`SELECT COUNT(*) as count FROM subscriptions WHERE status IN ('active', 'trialing')`),
      queryOne<any>(`SELECT COALESCE(SUM(amount_cents), 0) as total FROM invoices WHERE status = 'paid'`),
      query<any[]>('SELECT COUNT(*) as count FROM users WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)'),
      queryOne<any>(`
        SELECT COALESCE(SUM(amount_cents), 0) as total
        FROM invoices
        WHERE status = 'paid' AND paid_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
      `),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: totalUsers?.count || 0,
        activeSubscriptions: activeSubscriptions?.count || 0,
        totalRevenue: (totalRevenue?.total || 0) / 100,
        recentSignups: recentSignups?.[0]?.count || 0,
        monthlyRevenue: (monthlyRevenue?.total || 0) / 100,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

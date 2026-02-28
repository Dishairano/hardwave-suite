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

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // days

    // User signups over time (last N days)
    const userGrowth = await query<any[]>(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM users
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [parseInt(period)]);

    // Revenue over time (from invoices)
    const revenueData = await query<any[]>(`
      SELECT
        DATE(created_at) as date,
        SUM(amount_cents) / 100 as revenue,
        COUNT(*) as count
      FROM invoices
      WHERE status = 'paid' AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [parseInt(period)]);

    // Subscription status distribution
    const subscriptionStats = await query<any[]>(`
      SELECT
        status,
        COUNT(*) as count
      FROM subscriptions
      GROUP BY status
    `);

    // Monthly recurring revenue trend
    const mrrTrend = await query<any[]>(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(CASE WHEN status IN ('active', 'trialing') THEN price_cents / 100 ELSE 0 END) as mrr,
        COUNT(CASE WHEN status IN ('active', 'trialing') THEN 1 END) as active_subs
      FROM subscriptions
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    // User retention (users who logged in last 7/30 days)
    const retention = await query<any[]>(`
      SELECT
        COUNT(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as active_7d,
        COUNT(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as active_30d,
        COUNT(*) as total
      FROM users
    `);

    // Top subscription plans
    const topPlans = await query<any[]>(`
      SELECT
        plan_name,
        COUNT(*) as count,
        SUM(price_cents) / 100 as total_revenue
      FROM subscriptions
      WHERE status IN ('active', 'trialing')
      GROUP BY plan_name
      ORDER BY count DESC
      LIMIT 5
    `);

    // Daily active users (based on last_login_at)
    const dailyActiveUsers = await query<any[]>(`
      SELECT
        DATE(last_login_at) as date,
        COUNT(DISTINCT id) as count
      FROM users
      WHERE last_login_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(last_login_at)
      ORDER BY date ASC
    `, [parseInt(period)]);

    // Fill in missing dates with zeros for user growth
    const filledUserGrowth = fillMissingDates(userGrowth, parseInt(period));
    const filledRevenueData = fillMissingDates(revenueData, parseInt(period), true);
    const filledDailyActive = fillMissingDates(dailyActiveUsers, parseInt(period));

    return NextResponse.json({
      success: true,
      analytics: {
        userGrowth: filledUserGrowth,
        revenueData: filledRevenueData,
        subscriptionStats,
        mrrTrend,
        retention: retention[0] || { active_7d: 0, active_30d: 0, total: 0 },
        topPlans,
        dailyActiveUsers: filledDailyActive,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  }
}

function fillMissingDates(data: any[], days: number, includeRevenue = false) {
  const result = [];
  const dataMap = new Map(data.map(d => [d.date?.toISOString?.()?.split('T')[0] || d.date, d]));

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    if (dataMap.has(dateStr)) {
      const item = dataMap.get(dateStr);
      result.push({
        date: dateStr,
        count: parseInt(item.count) || 0,
        ...(includeRevenue ? { revenue: parseFloat(item.revenue) || 0 } : {}),
      });
    } else {
      result.push({
        date: dateStr,
        count: 0,
        ...(includeRevenue ? { revenue: 0 } : {}),
      });
    }
  }

  return result;
}

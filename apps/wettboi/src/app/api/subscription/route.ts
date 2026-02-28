import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's subscription with license info
    const subscription = await queryOne<any>(
      `SELECT
        s.*,
        l.license_key,
        l.activations,
        l.max_activations,
        l.status as license_status
       FROM subscriptions s
       LEFT JOIN licenses l ON l.subscription_id = s.id AND l.product = 'all'
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [auth.userId]
    );

    if (!subscription) {
      return NextResponse.json({
        success: true,
        hasSubscription: false,
        subscription: null,
      });
    }

    return NextResponse.json({
      success: true,
      hasSubscription: subscription.status === 'active' || subscription.status === 'trialing',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planName: subscription.plan_name,
        price: subscription.price_cents / 100,
        currency: subscription.currency,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        license: subscription.license_key ? {
          key: subscription.license_key,
          activations: subscription.activations,
          maxActivations: subscription.max_activations,
          status: subscription.license_status,
        } : null,
      },
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

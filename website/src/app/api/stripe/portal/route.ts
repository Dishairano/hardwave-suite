import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { verifyAuth } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's Stripe customer ID
    const subscription = await queryOne<any>(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [auth.userId]
    );

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { success: false, error: 'No subscription found' },
        { status: 404 }
      );
    }

    // Create Stripe billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/subscription`,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}

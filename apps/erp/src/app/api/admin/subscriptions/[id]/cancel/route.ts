import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get the subscription
    const subscriptions = await query<any[]>(
      'SELECT * FROM subscriptions WHERE id = ?',
      [id]
    );

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    }

    const subscription = subscriptions[0];

    // Cancel in Stripe if there's a stripe_subscription_id
    if (subscription.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (stripeError) {
        console.error('Stripe cancellation error:', stripeError);
        // Continue with local cancellation even if Stripe fails
      }
    }

    // Update local database
    await query(
      'UPDATE subscriptions SET status = ?, canceled_at = NOW() WHERE id = ?',
      ['canceled', id]
    );

    // Log the action
    await query(
      'INSERT INTO audit_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [admin.userId, 'cancel_subscription', 'subscription', id, JSON.stringify({ subscriptionId: id, userId: subscription.user_id })]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json({ success: false, error: 'Failed to cancel subscription' }, { status: 500 });
  }
}

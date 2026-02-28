import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe';
import { verifyAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has an active subscription
    const existingSub = await queryOne<any>(
      `SELECT * FROM subscriptions WHERE user_id = ? AND status IN ('active', 'trialing')`,
      [auth.userId]
    );

    if (existingSub) {
      return NextResponse.json(
        { success: false, error: 'You already have an active subscription' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let stripeCustomerId: string;

    const existingCustomer = await queryOne<any>(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [auth.userId]
    );

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: auth.email,
        metadata: {
          userId: auth.userId.toString(),
        },
      });
      stripeCustomerId = customer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card', 'ideal', 'bancontact'],
      mode: 'subscription',
      line_items: [
        {
          price: STRIPE_CONFIG.priceId,
          quantity: 1,
        },
      ],
      success_url: STRIPE_CONFIG.successUrl,
      cancel_url: STRIPE_CONFIG.cancelUrl,
      metadata: {
        userId: auth.userId.toString(),
      },
      subscription_data: {
        metadata: {
          userId: auth.userId.toString(),
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: {
        enabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

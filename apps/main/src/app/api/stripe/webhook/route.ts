import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe';
import { query, queryOne } from '@/lib/db';
import { generateLicenseKey } from '@/lib/auth';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_CONFIG.webhookSecret
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId || !session.subscription || !session.customer) {
    console.error('Missing data in checkout session');
    return;
  }

  // Get subscription details from Stripe
  const subscriptionResponse = await stripe.subscriptions.retrieve(
    session.subscription as string
  );
  const subscription = subscriptionResponse as Stripe.Subscription;

  // Create or update subscription in database
  const existingSub = await queryOne<any>(
    'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?',
    [subscription.id]
  );

  if (!existingSub) {
    await query(
      `INSERT INTO subscriptions
       (user_id, stripe_subscription_id, stripe_customer_id, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
      [
        userId,
        subscription.id,
        session.customer,
        subscription.status,
        (subscription as any).current_period_start,
        (subscription as any).current_period_end,
      ]
    );

    // Get the new subscription ID
    const newSub = await queryOne<any>(
      'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?',
      [subscription.id]
    );

    // Generate license key for the user
    if (newSub) {
      const licenseKey = generateLicenseKey();
      await query(
        `INSERT INTO licenses (user_id, subscription_id, license_key, product, status)
         VALUES (?, ?, ?, 'all', 'active')`,
        [userId, newSub.id, licenseKey]
      );
    }
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const sub = subscription as any;

  await query(
    `UPDATE subscriptions SET
     status = ?,
     current_period_start = FROM_UNIXTIME(?),
     current_period_end = FROM_UNIXTIME(?),
     cancel_at_period_end = ?,
     canceled_at = ?
     WHERE stripe_subscription_id = ?`,
    [
      sub.status,
      sub.current_period_start,
      sub.current_period_end,
      sub.cancel_at_period_end,
      sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      sub.id,
    ]
  );

  // Update license status based on subscription
  if (sub.status === 'active') {
    await query(
      `UPDATE licenses l
       JOIN subscriptions s ON l.subscription_id = s.id
       SET l.status = 'active', l.expires_at = FROM_UNIXTIME(?)
       WHERE s.stripe_subscription_id = ?`,
      [sub.current_period_end, sub.id]
    );
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await query(
    `UPDATE subscriptions SET status = 'canceled', canceled_at = NOW()
     WHERE stripe_subscription_id = ?`,
    [subscription.id]
  );

  // Revoke licenses
  await query(
    `UPDATE licenses l
     JOIN subscriptions s ON l.subscription_id = s.id
     SET l.status = 'expired'
     WHERE s.stripe_subscription_id = ?`,
    [subscription.id]
  );
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const inv = invoice as any;
  if (!inv.subscription) return;

  const subscription = await queryOne<any>(
    'SELECT id, user_id FROM subscriptions WHERE stripe_subscription_id = ?',
    [inv.subscription]
  );

  if (!subscription) return;

  // Check if invoice already exists
  const existingInvoice = await queryOne<any>(
    'SELECT id FROM invoices WHERE stripe_invoice_id = ?',
    [inv.id]
  );

  if (!existingInvoice) {
    await query(
      `INSERT INTO invoices
       (user_id, subscription_id, stripe_invoice_id, stripe_payment_intent_id, invoice_number,
        status, amount_cents, currency, description, invoice_pdf_url, hosted_invoice_url,
        paid_at, period_start, period_end)
       VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, NOW(), FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
      [
        subscription.user_id,
        subscription.id,
        inv.id,
        inv.payment_intent,
        inv.number,
        inv.amount_paid,
        inv.currency,
        inv.description || 'Hardwave Pro Subscription',
        inv.invoice_pdf,
        inv.hosted_invoice_url,
        inv.period_start,
        inv.period_end,
      ]
    );
  } else {
    await query(
      `UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE stripe_invoice_id = ?`,
      [inv.id]
    );
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const inv = invoice as any;
  if (!inv.subscription) return;

  const subscription = await queryOne<any>(
    'SELECT id, user_id FROM subscriptions WHERE stripe_subscription_id = ?',
    [inv.subscription]
  );

  if (!subscription) return;

  await query(
    `INSERT INTO invoices
     (user_id, subscription_id, stripe_invoice_id, invoice_number, status, amount_cents, currency)
     VALUES (?, ?, ?, ?, 'open', ?, ?)
     ON DUPLICATE KEY UPDATE status = 'open'`,
    [
      subscription.user_id,
      subscription.id,
      inv.id,
      inv.number,
      inv.amount_due,
      inv.currency,
    ]
  );
}

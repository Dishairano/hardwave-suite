import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });
  }
  return stripeInstance;
}

// For backwards compatibility
export const stripe = {
  get customers() { return getStripe().customers; },
  get subscriptions() { return getStripe().subscriptions; },
  get checkout() { return getStripe().checkout; },
  get billingPortal() { return getStripe().billingPortal; },
  get webhooks() { return getStripe().webhooks; },
};

export const STRIPE_CONFIG = {
  priceId: process.env.STRIPE_PRICE_ID || '',
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/subscription?success=true`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/subscription?canceled=true`,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};

export const PLAN_DETAILS = {
  name: 'Hardwave Pro',
  price: 10,
  currency: 'EUR',
  interval: 'month' as const,
  features: [
    'Kickforge - Professional Kick Designer',
    'Sample Library - AI-powered Organization',
    'Unlimited exports',
    'All presets & updates',
    'Priority support',
    'Early access to new tools',
  ],
};

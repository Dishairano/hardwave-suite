// Client-side stripe config (no secrets)
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

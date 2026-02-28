'use client';

import { Card } from '@/components/erp';

export default function RecurringInvoicesPage() {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', margin: 0 }}>
          Recurring Invoices
        </h1>
        <p style={{ fontSize: 14, color: '#71717a', margin: '4px 0 0' }}>
          Set up automated recurring billing
        </p>
      </div>

      <Card>
        <div style={{ padding: 64, textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#a1a1aa', margin: '0 0 8px' }}>
            Coming Soon
          </h2>
          <p style={{ fontSize: 14, color: '#71717a', maxWidth: 400, margin: '0 auto' }}>
            Automated recurring invoices with configurable schedules, Stripe integration, and auto-send are under development.
          </p>
        </div>
      </Card>
    </div>
  );
}

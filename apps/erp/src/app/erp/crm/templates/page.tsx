'use client';

import { Card } from '@/components/erp';

export default function EmailTemplatesPage() {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', margin: 0 }}>
          Email Templates
        </h1>
        <p style={{ fontSize: 14, color: '#71717a', margin: '4px 0 0' }}>
          Create and manage email templates for outreach
        </p>
      </div>

      <Card>
        <div style={{ padding: 64, textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#a1a1aa', margin: '0 0 8px' }}>
            Coming Soon
          </h2>
          <p style={{ fontSize: 14, color: '#71717a', maxWidth: 400, margin: '0 auto' }}>
            Email template management with variables, categories, and one-click send is under development.
          </p>
        </div>
      </Card>
    </div>
  );
}

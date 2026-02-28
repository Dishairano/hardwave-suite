'use client';

import { Card } from '@/components/erp';

export default function PurchaseOrdersPage() {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', margin: 0 }}>
          Purchase Orders
        </h1>
        <p style={{ fontSize: 14, color: '#71717a', margin: '4px 0 0' }}>
          Create and manage purchase orders
        </p>
      </div>

      <Card>
        <div style={{ padding: 64, textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#a1a1aa', margin: '0 0 8px' }}>
            Coming Soon
          </h2>
          <p style={{ fontSize: 14, color: '#71717a', maxWidth: 400, margin: '0 auto' }}>
            Purchase order creation, supplier management, receiving workflows, and inventory integration are under development.
          </p>
        </div>
      </Card>
    </div>
  );
}

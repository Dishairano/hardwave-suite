'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

interface StockItem {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  location_name: string;
  quantity: number;
  reorder_point: number;
  unit_of_measure: string;
}

export default function StockPage() {
  const { toastError, toastSuccess } = useToast();
  const [stock, setStock] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ totalQuantity: 0, lowStockCount: 0 });
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const [adjustment, setAdjustment] = useState({
    product_id: '',
    location_id: '',
    adjustment_type: 'in',
    quantity: '',
    notes: '',
  });

  const fetchStock = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/inventory/stock?page=${page}&limit=20`;
      if (lowStockFilter) url += '&low_stock=true';

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStock(data.items);
        setTotalPages(data.pagination.totalPages);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch stock:', error);
    }

    setLoading(false);
  };

  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/inventory/products?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchStock();
  }, [page, lowStockFilter]);

  const handleAdjustStock = async () => {
    setAdjusting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/inventory/stock', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...adjustment,
          product_id: parseInt(adjustment.product_id),
          quantity: parseFloat(adjustment.quantity),
        }),
      });

      if (res.ok) {
        setShowAdjustModal(false);
        setAdjustment({
          product_id: '',
          location_id: '',
          adjustment_type: 'in',
          quantity: '',
          notes: '',
        });
        fetchStock();
        toastSuccess('Stock adjusted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to adjust stock');
      }
    } catch (error) {
      console.error('Adjust stock error:', error);
      toastError('Failed to adjust stock');
    }

    setAdjusting(false);
  };

  const columns: Column<StockItem>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: 120,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
    {
      key: 'product_name',
      header: 'Product',
      render: (value) => (
        <span style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</span>
      ),
    },
    {
      key: 'location_name',
      header: 'Location',
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>{value || 'Default'}</span>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      width: 120,
      align: 'center',
      render: (value, row) => {
        const isLow = value <= row.reorder_point;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 16,
                color: isLow ? tokens.colors.error : tokens.colors.success,
              }}
            >
              {value}
            </span>
            <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.unit_of_measure}</span>
          </div>
        );
      },
    },
    {
      key: 'reorder_point',
      header: 'Reorder At',
      width: 100,
      align: 'center',
      render: (value) => <span style={{ color: tokens.colors.textMuted }}>{value}</span>,
    },
    {
      key: 'id',
      header: 'Status',
      width: 100,
      render: (_, row) => {
        const isLow = row.quantity <= row.reorder_point;
        return isLow ? (
          <Badge variant="error">Low Stock</Badge>
        ) : (
          <Badge variant="success">OK</Badge>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Stock Levels
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            View and adjust inventory stock
          </p>
        </div>
        <Button onClick={() => setShowAdjustModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Adjust Stock
        </Button>
      </div>

      {/* Summary */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          marginBottom: 24,
          padding: 16,
          backgroundColor: '#101018',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>Total Units</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary }}>
            {summary.totalQuantity.toLocaleString()}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 24 }}>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>Low Stock Items</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.warning }}>
            {summary.lowStockCount}
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => {
                setLowStockFilter(e.target.checked);
                setPage(1);
              }}
            />
            <span style={{ color: tokens.colors.textSecondary }}>Show only low stock items</span>
          </label>
        </div>
      </Card>

      {/* Stock Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={stock}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No stock records found"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span style={{ padding: '8px 12px', color: tokens.colors.textSecondary }}>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Adjust Stock"
        description="Add, remove, or set stock quantity"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAdjustModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustStock}
              loading={adjusting}
              disabled={!adjustment.product_id || !adjustment.quantity}
            >
              Apply Adjustment
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Select
              label="Product"
              required
              value={adjustment.product_id}
              onChange={(e) => setAdjustment({ ...adjustment, product_id: e.target.value })}
              options={[
                { value: '', label: 'Select product...' },
                ...products.map(p => ({ value: p.id.toString(), label: `${p.sku} - ${p.name}` })),
              ]}
            />
          </div>

          <Select
            label="Adjustment Type"
            value={adjustment.adjustment_type}
            onChange={(e) => setAdjustment({ ...adjustment, adjustment_type: e.target.value })}
            options={[
              { value: 'in', label: 'Stock In (Add)' },
              { value: 'out', label: 'Stock Out (Remove)' },
              { value: 'adjustment', label: 'Set Quantity' },
            ]}
          />

          <Input
            label="Quantity"
            type="number"
            required
            value={adjustment.quantity}
            onChange={(e) => setAdjustment({ ...adjustment, quantity: e.target.value })}
            placeholder="0"
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Notes"
              value={adjustment.notes}
              onChange={(e) => setAdjustment({ ...adjustment, notes: e.target.value })}
              placeholder="Reason for adjustment..."
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

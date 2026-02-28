'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard, StatCardGrid, Card, Button, DataTable, Badge } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { InvProduct } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    brandBlue: '#3B82F6',
    brandGreen: '#00FF00',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

export default function InventoryDashboardPage() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalStock: 0,
    lowStockItems: 0,
    totalSuppliers: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [recentProducts, setRecentProducts] = useState<InvProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('token');

      try {
        // Fetch products
        const productsRes = await fetch('/api/erp/inventory/products?limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (productsRes.ok) {
          const data = await productsRes.json();
          setRecentProducts(data.items);
          setStats(prev => ({ ...prev, totalProducts: data.pagination.total }));
        }

        // Fetch stock summary
        const stockRes = await fetch('/api/erp/inventory/stock?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (stockRes.ok) {
          const data = await stockRes.json();
          setStats(prev => ({
            ...prev,
            totalStock: data.summary.totalQuantity,
            lowStockItems: data.summary.lowStockCount,
          }));
        }

        // Fetch low stock items
        const lowStockRes = await fetch('/api/erp/inventory/stock?low_stock=true&limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (lowStockRes.ok) {
          const data = await lowStockRes.json();
          setLowStockProducts(data.items);
        }

        // Fetch suppliers
        const suppliersRes = await fetch('/api/erp/inventory/suppliers?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (suppliersRes.ok) {
          const data = await suppliersRes.json();
          setStats(prev => ({ ...prev, totalSuppliers: data.pagination.total }));
        }
      } catch (error) {
        console.error('Failed to fetch inventory dashboard data:', error);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const productColumns: Column<InvProduct>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: 100,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
    {
      key: 'name',
      header: 'Product',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          {row.category_name && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.category_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'total_stock',
      header: 'Stock',
      width: 80,
      align: 'right',
      render: (value, row) => (
        <span
          style={{
            fontWeight: 600,
            color: value <= row.reorder_point ? tokens.colors.error : tokens.colors.success,
          }}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'selling_price',
      header: 'Price',
      width: 100,
      align: 'right',
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.textSecondary }}>
          {formatCurrency(value || 0)}
        </span>
      ),
    },
  ];

  const lowStockColumns: Column<any>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: 100,
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
      key: 'quantity',
      header: 'Current',
      width: 80,
      align: 'center',
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.error }}>{value}</span>
      ),
    },
    {
      key: 'reorder_point',
      header: 'Reorder At',
      width: 80,
      align: 'center',
      render: (value) => (
        <span style={{ color: tokens.colors.textMuted }}>{value}</span>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Inventory Dashboard
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage products, stock levels, and suppliers
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/erp/inventory/products" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Product
            </Button>
          </Link>
          <Link href="/erp/inventory/stock" style={{ textDecoration: 'none' }}>
            <Button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" />
                <path d="M14 3v4a2 2 0 0 0 2 2h4" />
              </svg>
              Adjust Stock
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 24 }}>
        <StatCardGrid>
          <StatCard
            title="Total Products"
            value={loading ? '...' : stats.totalProducts}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            }
            color={tokens.colors.brandPink}
            loading={loading}
          />
          <StatCard
            title="Total Stock Units"
            value={loading ? '...' : stats.totalStock.toLocaleString()}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            }
            color={tokens.colors.brandBlue}
            loading={loading}
          />
          <StatCard
            title="Low Stock Items"
            value={loading ? '...' : stats.lowStockItems}
            subtitle="Need reorder"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
            color={tokens.colors.warning}
            loading={loading}
          />
          <StatCard
            title="Suppliers"
            value={loading ? '...' : stats.totalSuppliers}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            }
            color={tokens.colors.success}
            loading={loading}
          />
        </StatCardGrid>
      </div>

      {/* Quick Access Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { href: '/erp/inventory/products', label: 'Products', icon: 'box' },
          { href: '/erp/inventory/stock', label: 'Stock Levels', icon: 'layers' },
          { href: '/erp/inventory/suppliers', label: 'Suppliers', icon: 'truck' },
          { href: '/erp/inventory/purchase-orders', label: 'Purchase Orders', icon: 'clipboard' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              backgroundColor: '#101018',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = tokens.colors.brandPink + '40';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: tokens.colors.brandPink + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.brandPink,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {item.icon === 'box' && (
                  <>
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </>
                )}
                {item.icon === 'layers' && (
                  <>
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </>
                )}
                {item.icon === 'truck' && (
                  <>
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </>
                )}
                {item.icon === 'clipboard' && (
                  <>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </>
                )}
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: tokens.colors.textPrimary }}>
              {item.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Tables Row */}
      <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent Products */}
        <Card
          title="Recent Products"
          actions={
            <Link href="/erp/inventory/products" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
          padding={false}
        >
          <DataTable
            columns={productColumns}
            data={recentProducts}
            loading={loading}
            rowKey={(row) => row.id}
            emptyMessage="No products yet"
          />
        </Card>

        {/* Low Stock Alert */}
        <Card
          title="Low Stock Alert"
          actions={
            <Link href="/erp/inventory/stock?low_stock=true" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
          padding={false}
        >
          <DataTable
            columns={lowStockColumns}
            data={lowStockProducts}
            loading={loading}
            rowKey={(row) => row.id}
            emptyMessage="No low stock items"
          />
        </Card>
      </div>
    </div>
  );
}

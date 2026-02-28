'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { InvProduct } from '@/lib/erp-types';

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

export default function ProductsPage() {
  const { toastError, toastSuccess } = useToast();
  const [products, setProducts] = useState<InvProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    description: '',
    category_id: '',
    unit_of_measure: 'each',
    cost_price: '',
    selling_price: '',
    reorder_point: '10',
    reorder_quantity: '50',
  });

  const fetchProducts = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/inventory/products?page=${page}&limit=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setProducts(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search]);

  const handleCreateProduct = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/inventory/products', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newProduct,
          category_id: newProduct.category_id ? parseInt(newProduct.category_id) : null,
          cost_price: parseFloat(newProduct.cost_price) || 0,
          selling_price: parseFloat(newProduct.selling_price) || 0,
          reorder_point: parseInt(newProduct.reorder_point) || 0,
          reorder_quantity: parseInt(newProduct.reorder_quantity) || 0,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewProduct({
          sku: '',
          name: '',
          description: '',
          category_id: '',
          unit_of_measure: 'each',
          cost_price: '',
          selling_price: '',
          reorder_point: '10',
          reorder_quantity: '50',
        });
        fetchProducts();
        toastSuccess('Product created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create product');
      }
    } catch (error) {
      console.error('Create product error:', error);
      toastError('Failed to create product');
    }

    setCreating(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const columns: Column<InvProduct>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: 120,
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
      width: 100,
      align: 'center',
      render: (value, row) => {
        const isLow = value <= row.reorder_point;
        return (
          <span
            style={{
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 4,
              backgroundColor: isLow ? tokens.colors.error + '20' : tokens.colors.success + '20',
              color: isLow ? tokens.colors.error : tokens.colors.success,
            }}
          >
            {value || 0}
          </span>
        );
      },
    },
    {
      key: 'cost_price',
      header: 'Cost',
      width: 100,
      align: 'right',
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.textSecondary }}>
          {formatCurrency(value || 0)}
        </span>
      ),
    },
    {
      key: 'selling_price',
      header: 'Price',
      width: 100,
      align: 'right',
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.success }}>
          {formatCurrency(value || 0)}
        </span>
      ),
    },
    {
      key: 'unit_of_measure',
      header: 'Unit',
      width: 80,
      render: (value) => <span style={{ color: tokens.colors.textMuted }}>{value}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      width: 80,
      render: (value) => (
        <Badge variant={value ? 'success' : 'default'}>{value ? 'Active' : 'Inactive'}</Badge>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Products
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage your product catalog
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 300 }}>
            <Input
              label="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by SKU, name, description..."
            />
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={products}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No products found"
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

      {/* Create Product Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Product"
        description="Create a new product in your catalog"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProduct}
              loading={creating}
              disabled={!newProduct.sku || !newProduct.name}
            >
              Create Product
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="SKU"
            required
            value={newProduct.sku}
            onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
            placeholder="e.g., PROD-001"
          />

          <Input
            label="Product Name"
            required
            value={newProduct.name}
            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            placeholder="Product name"
          />

          <Input
            label="Cost Price"
            type="number"
            value={newProduct.cost_price}
            onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
            leftIcon={<span>$</span>}
          />

          <Input
            label="Selling Price"
            type="number"
            value={newProduct.selling_price}
            onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })}
            leftIcon={<span>$</span>}
          />

          <Select
            label="Unit of Measure"
            value={newProduct.unit_of_measure}
            onChange={(e) => setNewProduct({ ...newProduct, unit_of_measure: e.target.value })}
            options={[
              { value: 'each', label: 'Each' },
              { value: 'piece', label: 'Piece' },
              { value: 'box', label: 'Box' },
              { value: 'kg', label: 'Kilogram' },
              { value: 'lb', label: 'Pound' },
              { value: 'l', label: 'Liter' },
              { value: 'gal', label: 'Gallon' },
            ]}
          />

          <Input
            label="Reorder Point"
            type="number"
            value={newProduct.reorder_point}
            onChange={(e) => setNewProduct({ ...newProduct, reorder_point: e.target.value })}
            placeholder="10"
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Description"
              value={newProduct.description}
              onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              placeholder="Product description..."
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

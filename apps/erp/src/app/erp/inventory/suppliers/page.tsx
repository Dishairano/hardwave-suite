'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Textarea, DataTable, Badge, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { InvSupplier } from '@/lib/erp-types';

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

export default function SuppliersPage() {
  const { toastError, toastSuccess } = useToast();
  const [suppliers, setSuppliers] = useState<InvSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit/Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<InvSupplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvSupplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = {
    name: '',
    code: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    notes: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  const fetchSuppliers = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/inventory/suppliers?page=${page}&limit=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, [page, search]);

  const handleCreateSupplier = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/inventory/suppliers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData(emptyForm);
        fetchSuppliers();
        toastSuccess('Supplier created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create supplier');
      }
    } catch (error) {
      console.error('Create supplier error:', error);
      toastError('Failed to create supplier');
    }

    setCreating(false);
  };

  const handleEdit = async () => {
    if (!selectedSupplier) return;
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/inventory/suppliers/${selectedSupplier.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedSupplier(null);
        setFormData(emptyForm);
        fetchSuppliers();
        toastSuccess('Supplier updated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update supplier');
      }
    } catch (error) {
      console.error('Update supplier error:', error);
      toastError('Failed to update supplier');
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/inventory/suppliers/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchSuppliers();
        toastSuccess('Supplier deleted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete supplier');
      }
    } catch (error) {
      console.error('Delete supplier error:', error);
      toastError('Failed to delete supplier');
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  const openEditModal = (supplier: InvSupplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      code: supplier.code || '',
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      website: supplier.website || '',
      address_line1: supplier.address_line1 || '',
      city: supplier.city || '',
      state: supplier.state || '',
      postal_code: supplier.postal_code || '',
      country: supplier.country || '',
      notes: supplier.notes || '',
    });
    setShowEditModal(true);
  };

  const columns: Column<InvSupplier>[] = [
    {
      key: 'code',
      header: 'Code',
      width: 100,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
    {
      key: 'name',
      header: 'Supplier',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          {row.contact_name && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.contact_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contact',
      render: (value, row) => (
        <div>
          {value && <div style={{ fontSize: 13, color: tokens.colors.textSecondary }}>{value}</div>}
          {row.phone && <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.phone}</div>}
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Location',
      render: (_, row) => (
        <span style={{ color: tokens.colors.textSecondary }}>
          {[row.city, row.state, row.country].filter(Boolean).join(', ') || '-'}
        </span>
      ),
    },
    {
      key: 'order_count',
      header: 'Orders',
      width: 80,
      align: 'center',
      render: (value) => (
        <span style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value || 0}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: 80,
      render: (value) => (
        <Badge variant={value ? 'success' : 'default'}>{value ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      width: 120,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => openEditModal(row)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(row)}
            style={{ color: tokens.colors.error }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const SupplierFormFields = () => (
    <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Input
        label="Supplier Name"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Company name"
      />
      <Input
        label="Code"
        value={formData.code}
        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
        placeholder="Auto-generated if blank"
      />
      <Input
        label="Contact Name"
        value={formData.contact_name}
        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
        placeholder="Primary contact"
      />
      <Input
        label="Email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <Input
        label="Phone"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
      />
      <Input
        label="Website"
        value={formData.website}
        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
        placeholder="https://"
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <Input
          label="Address"
          value={formData.address_line1}
          onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
        />
      </div>
      <Input
        label="City"
        value={formData.city}
        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
      />
      <Input
        label="State/Province"
        value={formData.state}
        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
      />
      <Input
        label="Postal Code"
        value={formData.postal_code}
        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
      />
      <Input
        label="Country"
        value={formData.country}
        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <Textarea
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Suppliers
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage your supplier relationships
          </p>
        </div>
        <Button onClick={() => {
          setFormData(emptyForm);
          setShowCreateModal(true);
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Supplier
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
              placeholder="Search by name, code, contact..."
            />
          </div>
        </div>
      </Card>

      {/* Suppliers Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={suppliers}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No suppliers found"
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

      {/* Create Supplier Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Supplier"
        description="Create a new supplier record"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSupplier}
              loading={creating}
              disabled={!formData.name}
            >
              Create Supplier
            </Button>
          </>
        }
      >
        <SupplierFormFields />
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Supplier"
        description={selectedSupplier ? `Editing ${selectedSupplier.name}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} loading={saving} disabled={!formData.name}>
              Save Changes
            </Button>
          </>
        }
      >
        <SupplierFormFields />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

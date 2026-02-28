'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, DataTable, Badge, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { InvLocation } from '@/lib/erp-types';

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

export default function LocationsPage() {
  const { toastError, toastSuccess } = useToast();
  const [locations, setLocations] = useState<InvLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newLocation, setNewLocation] = useState({
    name: '',
    code: '',
    location_type: 'warehouse' as 'warehouse' | 'store' | 'virtual' | 'transit',
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  });

  const fetchLocations = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/inventory/locations?page=${page}&limit=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setLocations(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, [page, search]);

  const handleCreateLocation = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/inventory/locations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLocation),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewLocation({
          name: '',
          code: '',
          location_type: 'warehouse',
          address_line1: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
        });
        fetchLocations();
        toastSuccess('Location created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create location');
      }
    } catch (error) {
      console.error('Create location error:', error);
      toastError('Failed to create location');
    }

    setCreating(false);
  };

  const columns: Column<InvLocation>[] = [
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
      header: 'Location',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          {row.description && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'location_type',
      header: 'Type',
      width: 100,
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>
          {value ? value.charAt(0).toUpperCase() + value.slice(1) : '-'}
        </span>
      ),
    },
    {
      key: 'city',
      header: 'Address',
      render: (_, row) => (
        <span style={{ color: tokens.colors.textSecondary }}>
          {[row.city, row.state, row.country].filter(Boolean).join(', ') || '-'}
        </span>
      ),
    },
    {
      key: 'is_default',
      header: 'Default',
      width: 80,
      align: 'center',
      render: (value) => (
        <span style={{ color: value ? tokens.colors.success : tokens.colors.textMuted }}>
          {value ? '✓' : '-'}
        </span>
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
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Locations
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage warehouse and storage locations
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Location
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
              placeholder="Search by name, code, city..."
            />
          </div>
        </div>
      </Card>

      {/* Locations Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={locations}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No locations found"
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

      {/* Create Location Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Location"
        description="Create a new storage location"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateLocation}
              loading={creating}
              disabled={!newLocation.name}
            >
              Create Location
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Location Name"
            required
            value={newLocation.name}
            onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
            placeholder="Location name"
          />

          <Input
            label="Code"
            value={newLocation.code}
            onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value })}
            placeholder="Auto-generated if blank"
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Select
              label="Location Type"
              value={newLocation.location_type}
              onChange={(e) => setNewLocation({ ...newLocation, location_type: e.target.value as 'warehouse' | 'store' | 'virtual' | 'transit' })}
              options={[
                { value: 'warehouse', label: 'Warehouse' },
                { value: 'store', label: 'Store' },
                { value: 'virtual', label: 'Virtual' },
                { value: 'transit', label: 'Transit' },
              ]}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Address"
              value={newLocation.address_line1}
              onChange={(e) => setNewLocation({ ...newLocation, address_line1: e.target.value })}
            />
          </div>

          <Input
            label="City"
            value={newLocation.city}
            onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
          />

          <Input
            label="State/Province"
            value={newLocation.state}
            onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
          />

          <Input
            label="Postal Code"
            value={newLocation.postal_code}
            onChange={(e) => setNewLocation({ ...newLocation, postal_code: e.target.value })}
          />

          <Input
            label="Country"
            value={newLocation.country}
            onChange={(e) => setNewLocation({ ...newLocation, country: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}

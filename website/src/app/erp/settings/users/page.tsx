'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    brandBlue: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

interface ERPRole {
  id: number;
  module: string;
  role_name: string;
}

interface User {
  id: number;
  display_name: string;
  email: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  system_role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  erp_role_count: number;
  erp_roles: ERPRole[];
}

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
];

export default function UsersPage() {
  const router = useRouter();
  const { toastError, toastSuccess } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create/Edit state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = {
    display_name: '',
    email: '',
    password: '',
    role: 'user',
    is_active: true,
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    notes: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/erp/settings/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.items);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }

    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    if (!formData.password) {
      toastError('Password is required for new users');
      return;
    }
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/settings/users', {
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
        fetchUsers();
        toastSuccess('User created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Create user error:', error);
      toastError('Failed to create user');
    }

    setCreating(false);
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      // Don't send password if empty (means no change)
      const payload = { ...formData };
      if (!payload.password) {
        delete (payload as any).password;
      }

      const res = await fetch(`/api/erp/settings/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedUser(null);
        setFormData(emptyForm);
        fetchUsers();
        toastSuccess('User updated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Update user error:', error);
      toastError('Failed to update user');
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/settings/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchUsers();
        toastSuccess('User deactivated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to deactivate user');
      }
    } catch (error) {
      console.error('Delete user error:', error);
      toastError('Failed to deactivate user');
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      display_name: user.display_name || '',
      email: user.email || '',
      password: '',
      role: user.system_role || 'user',
      is_active: user.is_active,
      phone: user.phone || '',
      address_line1: user.address_line1 || '',
      address_line2: user.address_line2 || '',
      city: user.city || '',
      state: user.state || '',
      postal_code: user.postal_code || '',
      country: user.country || '',
      notes: user.notes || '',
    });
    setShowEditModal(true);
  };

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      finance: '#10B981',
      projects: '#3B82F6',
      hr: '#8B5CF6',
      crm: '#EC4899',
      inventory: '#F59E0B',
      invoicing: '#06B6D4',
      admin: '#EF4444',
    };
    return colors[module] || tokens.colors.textMuted;
  };

  const columns: Column<User>[] = [
    {
      key: 'display_name',
      header: 'User',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.email}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      width: 140,
      render: (value) => (
        <span style={{ fontSize: 13, color: tokens.colors.textSecondary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'city',
      header: 'Location',
      render: (_, row) => {
        const parts = [row.city, row.state, row.country].filter(Boolean);
        return (
          <span style={{ fontSize: 13, color: tokens.colors.textSecondary }}>
            {parts.length > 0 ? parts.join(', ') : '-'}
          </span>
        );
      },
    },
    {
      key: 'system_role',
      header: 'Role',
      width: 100,
      render: (value) => (
        <Badge variant={value === 'admin' ? 'warning' : value === 'manager' ? 'info' : 'default'}>
          {value}
        </Badge>
      ),
    },
    {
      key: 'erp_roles',
      header: 'ERP Access',
      render: (value: ERPRole[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {value && value.length > 0 ? (
            value.slice(0, 4).map((role, idx) => (
              <span
                key={idx}
                style={{
                  padding: '2px 6px',
                  fontSize: 11,
                  borderRadius: 4,
                  backgroundColor: `${getModuleColor(role.module)}20`,
                  color: getModuleColor(role.module),
                }}
              >
                {role.module}
              </span>
            ))
          ) : (
            <span style={{ color: tokens.colors.textMuted, fontSize: 12 }}>None</span>
          )}
          {value && value.length > 4 && (
            <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>
              +{value.length - 4}
            </span>
          )}
        </div>
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
      key: 'last_login',
      header: 'Last Login',
      width: 110,
      render: (value) => (
        <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>
          {value ? new Date(value).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      width: 150,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/erp/settings/users/${row.id}`)}
          >
            View
          </Button>
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

  const UserFormFields = ({ isCreate }: { isCreate?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Account Info */}
      <div>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Account
        </h4>
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Display Name"
            required
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="Full name"
          />
          <Input
            label="Email"
            required
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="user@example.com"
          />
          <Input
            label={isCreate ? 'Password' : 'New Password'}
            type="password"
            required={isCreate}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={isCreate ? 'Set password' : 'Leave blank to keep current'}
          />
          <Select
            label="System Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={roleOptions}
          />
        </div>
      </div>

      {/* Contact Info */}
      <div>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Contact
        </h4>
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+1 555 123 4567"
          />
          <div /> {/* spacer */}
        </div>
      </div>

      {/* Address */}
      <div>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Address
        </h4>
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Address Line 1"
              value={formData.address_line1}
              onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
              placeholder="Street address"
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Address Line 2"
              value={formData.address_line2}
              onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
              placeholder="Apt, suite, unit, etc."
            />
          </div>
          <Input
            label="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
          <Input
            label="State / Province"
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
        </div>
      </div>

      {/* Notes */}
      <div>
        <Textarea
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Internal notes about this user..."
          rows={3}
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
            Users
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage user accounts, roles, and profile details
          </p>
        </div>
        <Button onClick={() => {
          setFormData(emptyForm);
          setShowCreateModal(true);
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 280 }}>
            <Input
              label="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Name, email, or phone..."
            />
          </div>
          <div style={{ width: 150 }}>
            <Select
              label="Role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Roles' },
                ...roleOptions,
              ]}
            />
          </div>
          <div style={{ width: 150 }}>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
          <div style={{ marginLeft: 'auto', color: tokens.colors.textMuted, fontSize: 13 }}>
            {total} users total
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No users found"
        />

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

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add User"
        description="Create a new user account"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={creating}
              disabled={!formData.display_name || !formData.email || !formData.password}
            >
              Create User
            </Button>
          </>
        }
      >
        <UserFormFields isCreate />
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        description={selectedUser ? `Editing ${selectedUser.display_name}` : ''}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              loading={saving}
              disabled={!formData.display_name || !formData.email}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <UserFormFields />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Deactivate User"
        message={`Are you sure you want to deactivate "${deleteTarget?.display_name}"? They will lose access to the system. This can be reversed by re-activating the account.`}
        loading={deleting}
      />
    </div>
  );
}

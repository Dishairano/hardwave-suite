'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Textarea, DataTable, Badge, useToast, ConfirmDialog } from '@/components/erp';
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

interface Role {
  id: number;
  name: string;
  description: string | null;
  permissions: Record<string, string[]>;
  user_count: number;
  created_at: string;
}

const MODULES = ['finance', 'projects', 'hr', 'crm', 'inventory', 'invoicing', 'admin'];
const PERMISSIONS = ['read', 'write', 'delete', 'approve'];

export default function RolesPage() {
  const { toastError, toastSuccess } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {} as Record<string, string[]>,
  });

  const fetchRoles = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/settings/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRoles(data.roles);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/settings/roles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ name: '', description: '', permissions: {} });
        fetchRoles();
        toastSuccess('Role created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create role');
      }
    } catch (error) {
      console.error('Create role error:', error);
      toastError('Failed to create role');
    }

    setSaving(false);
  };

  const handleEdit = async () => {
    if (!selectedRole) return;

    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/settings/roles/${selectedRole.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedRole(null);
        setFormData({ name: '', description: '', permissions: {} });
        fetchRoles();
        toastSuccess('Role updated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Update role error:', error);
      toastError('Failed to update role');
    }

    setSaving(false);
  };

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/settings/roles/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchRoles();
        toastSuccess('Role deleted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete role');
      }
    } catch (error) {
      console.error('Delete role error:', error);
      toastError('Failed to delete role');
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || {},
    });
    setShowEditModal(true);
  };

  const togglePermission = (module: string, permission: string) => {
    setFormData(prev => {
      const modulePerms = prev.permissions[module] || [];
      const hasPermission = modulePerms.includes(permission);

      const newPerms = hasPermission
        ? modulePerms.filter(p => p !== permission)
        : [...modulePerms, permission];

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [module]: newPerms,
        },
      };
    });
  };

  const isSystemRole = (name: string) => ['admin', 'manager', 'user', 'viewer'].includes(name);

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Role Name',
      render: (value, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{value}</span>
          {isSystemRole(value) && (
            <Badge variant="info">System</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (value) => (
        <span style={{ color: tokens.colors.textMuted }}>{value || '-'}</span>
      ),
    },
    {
      key: 'permissions',
      header: 'Modules',
      render: (value: Record<string, string[]>) => {
        const moduleCount = Object.keys(value || {}).filter(
          m => (value[m] || []).length > 0
        ).length;
        return <span>{moduleCount} modules</span>;
      },
    },
    {
      key: 'user_count',
      header: 'Users',
      width: 80,
      align: 'center',
      render: (value) => <Badge variant="default">{value}</Badge>,
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
          {!isSystemRole(row.name) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(row)}
              style={{ color: tokens.colors.error }}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  const PermissionsEditor = () => (
    <div style={{ marginTop: 16 }}>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: tokens.colors.textPrimary, marginBottom: 8 }}>
        Permissions
      </label>
      <div
        style={{
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, color: tokens.colors.textMuted, fontWeight: 500 }}>
                Module
              </th>
              {PERMISSIONS.map(perm => (
                <th key={perm} style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: tokens.colors.textMuted, fontWeight: 500, textTransform: 'capitalize' }}>
                  {perm}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map(module => (
              <tr key={module} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '12px 16px', fontSize: 14, color: tokens.colors.textPrimary, textTransform: 'capitalize' }}>
                  {module}
                </td>
                {PERMISSIONS.map(perm => (
                  <td key={perm} style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={(formData.permissions[module] || []).includes(perm)}
                      onChange={() => togglePermission(module, perm)}
                      style={{
                        width: 18,
                        height: 18,
                        cursor: 'pointer',
                        accentColor: tokens.colors.brandPink,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Roles
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage ERP roles and their permissions
          </p>
        </div>
        <Button onClick={() => {
          setFormData({ name: '', description: '', permissions: {} });
          setShowCreateModal(true);
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create Role
        </Button>
      </div>

      {/* Roles Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={roles}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No roles found"
        />
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Role"
        description="Define a new ERP role with permissions"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving} disabled={!formData.name}>
              Create Role
            </Button>
          </>
        }
      >
        <Input
          label="Role Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Sales Manager"
        />
        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What this role is for..."
        />
        <PermissionsEditor />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Role"
        description={selectedRole ? `Editing ${selectedRole.name}` : ''}
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
        <Input
          label="Role Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Sales Manager"
          disabled={selectedRole ? isSystemRole(selectedRole.name) : false}
        />
        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="What this role is for..."
        />
        <PermissionsEditor />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

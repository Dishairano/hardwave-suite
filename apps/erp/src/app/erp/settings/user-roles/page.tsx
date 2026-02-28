'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Modal, Select, DataTable, Badge, Input, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    brandBlue: '#3B82F6',
    success: '#10B981',
    error: '#EF4444',
  },
};

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  display_name: string;
  email: string;
  system_role: string;
  erp_roles: { module: string; role_name: string }[];
}

interface Assignment {
  id: number;
  user_id: number;
  role_id: number;
  module: string;
  user_name: string;
  user_email: string;
  role_name: string;
  granted_by_name: string;
  created_at: string;
}

const MODULES = ['finance', 'projects', 'hr', 'crm', 'inventory', 'invoicing', 'admin'];

export default function UserRolesPage() {
  const { toastError, toastSuccess } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    user_id: '',
    role_id: '',
    module: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const [usersRes, rolesRes, assignmentsRes] = await Promise.all([
        fetch(`/api/erp/settings/users?limit=100&search=${search}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/erp/settings/roles', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/erp/settings/user-roles?limit=500', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.items);
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data.roles);
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json();
        setAssignments(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }

    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/settings/user-roles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: parseInt(formData.user_id),
          role_id: parseInt(formData.role_id),
          module: formData.module,
        }),
      });

      if (res.ok) {
        setShowAssignModal(false);
        setFormData({ user_id: '', role_id: '', module: '' });
        fetchData();
        toastSuccess('Role assigned');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to assign role');
      }
    } catch (error) {
      console.error('Assign role error:', error);
      toastError('Failed to assign role');
    }

    setSaving(false);
  };

  const [revokeTarget, setRevokeTarget] = useState<Assignment | null>(null);
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!revokeTarget) return;

    setRevoking(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/settings/user-roles?id=${revokeTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchData();
        toastSuccess('Role revoked');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to revoke role');
      }
    } catch (error) {
      console.error('Revoke role error:', error);
      toastError('Failed to revoke role');
    }

    setRevoking(false);
    setRevokeTarget(null);
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

  const userColumns: Column<User>[] = [
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
      key: 'system_role',
      header: 'System Role',
      width: 100,
      render: (value) => (
        <Badge variant={value === 'admin' ? 'warning' : 'default'}>
          {value}
        </Badge>
      ),
    },
    {
      key: 'erp_roles',
      header: 'ERP Permissions',
      render: (value: { module: string; role_name: string }[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {value && value.length > 0 ? (
            value.map((role, idx) => (
              <span
                key={idx}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  borderRadius: 4,
                  backgroundColor: `${getModuleColor(role.module)}20`,
                  color: getModuleColor(role.module),
                }}
              >
                {role.module}: {role.role_name}
              </span>
            ))
          ) : (
            <span style={{ color: tokens.colors.textMuted, fontSize: 13 }}>No ERP roles</span>
          )}
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      width: 100,
      render: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedUser(row);
            setFormData({ user_id: row.id.toString(), role_id: '', module: '' });
            setShowAssignModal(true);
          }}
        >
          Manage
        </Button>
      ),
    },
  ];

  const getUserAssignments = (userId: number) => {
    return assignments.filter(a => a.user_id === userId);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            User Permissions
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Assign ERP roles to users
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
          />
          <Button onClick={() => {
            setSelectedUser(null);
            setFormData({ user_id: '', role_id: '', module: '' });
            setShowAssignModal(true);
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Assign Role
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card padding={false}>
        <DataTable
          columns={userColumns}
          data={users}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No users found"
        />
      </Card>

      {/* Assign Role Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={selectedUser ? `Manage Roles: ${selectedUser.display_name}` : 'Assign Role'}
        description={selectedUser ? selectedUser.email : 'Add ERP access for a user'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
              Close
            </Button>
            <Button
              onClick={handleAssign}
              loading={saving}
              disabled={!formData.user_id || !formData.role_id || !formData.module}
            >
              Assign Role
            </Button>
          </>
        }
      >
        {!selectedUser && (
          <Select
            label="User"
            required
            value={formData.user_id}
            onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
            options={[
              { value: '', label: 'Select user...' },
              ...users.map(u => ({ value: u.id.toString(), label: `${u.display_name} (${u.email})` })),
            ]}
          />
        )}

        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Select
            label="Module"
            required
            value={formData.module}
            onChange={(e) => setFormData({ ...formData, module: e.target.value })}
            options={[
              { value: '', label: 'Select module...' },
              ...MODULES.map(m => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) })),
            ]}
          />

          <Select
            label="Role"
            required
            value={formData.role_id}
            onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
            options={[
              { value: '', label: 'Select role...' },
              ...roles.map(r => ({ value: r.id.toString(), label: r.name })),
            ]}
          />
        </div>

        {selectedUser && (
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 12 }}>
              Current Role Assignments
            </h4>
            {getUserAssignments(selectedUser.id).length === 0 ? (
              <p style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No roles assigned yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {getUserAssignments(selectedUser.id).map(assignment => (
                  <div
                    key={assignment.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          fontSize: 12,
                          borderRadius: 4,
                          backgroundColor: `${getModuleColor(assignment.module)}20`,
                          color: getModuleColor(assignment.module),
                        }}
                      >
                        {assignment.module}
                      </span>
                      <span style={{ color: tokens.colors.textPrimary }}>{assignment.role_name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevokeTarget(assignment)}
                      style={{ color: tokens.colors.error }}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke Role"
        message={revokeTarget ? `Revoke ${revokeTarget.role_name} role from ${revokeTarget.user_name} for ${revokeTarget.module}?` : ''}
        confirmLabel="Revoke"
        loading={revoking}
      />
    </div>
  );
}

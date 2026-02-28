'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Modal, Input, Select, Textarea, Badge, useToast, ConfirmDialog } from '@/components/erp';

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
  role_id: number;
  role_name: string;
  granted_at: string;
}

interface UserDetail {
  id: number;
  display_name: string;
  email: string;
  role: string;
  is_active: boolean;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  last_login: string | null;
  erp_roles: ERPRole[];
}

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
];

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toastError, toastSuccess } = useToast();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [showDeactivate, setShowDeactivate] = useState(false);
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

  const fetchUser = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/settings/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        toastError('User not found');
        router.push('/erp/settings/users');
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
  }, [id]);

  const openEditModal = () => {
    if (!user) return;
    setFormData({
      display_name: user.display_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'user',
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

  const handleEdit = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const payload = { ...formData };
      if (!payload.password) {
        delete (payload as any).password;
      }

      const res = await fetch(`/api/erp/settings/users/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchUser();
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

  const handleDeactivate = async () => {
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/settings/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toastSuccess('User deactivated');
        router.push('/erp/settings/users');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to deactivate user');
      }
    } catch (error) {
      console.error('Deactivate user error:', error);
      toastError('Failed to deactivate user');
    }

    setDeleting(false);
    setShowDeactivate(false);
  };

  const handleToggleActive = async () => {
    if (!user) return;
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/settings/users/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      if (res.ok) {
        fetchUser();
        toastSuccess(user.is_active ? 'User deactivated' : 'User activated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Toggle status error:', error);
    }
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

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 14, color: tokens.colors.textMuted }}>{label}</span>
      <span style={{ fontSize: 14, color: value ? tokens.colors.textPrimary : tokens.colors.textMuted, textAlign: 'right', maxWidth: '60%' }}>
        {value || '-'}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 0', textAlign: 'center' }}>
        <span style={{ color: tokens.colors.textMuted }}>Loading user...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 0', textAlign: 'center' }}>
        <span style={{ color: tokens.colors.textMuted }}>User not found</span>
      </div>
    );
  }

  const fullAddress = [user.address_line1, user.address_line2, user.city, user.state, user.postal_code, user.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => router.push('/erp/settings/users')}
            style={{
              background: 'none',
              border: 'none',
              color: tokens.colors.textMuted,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
                {user.display_name}
              </h1>
              <Badge variant={user.is_active ? 'success' : 'default'}>
                {user.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant={user.role === 'admin' ? 'warning' : user.role === 'manager' ? 'info' : 'default'}>
                {user.role}
              </Badge>
            </div>
            <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: 0 }}>
              {user.email}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={handleToggleActive}>
            {user.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button onClick={openEditModal}>
            Edit User
          </Button>
        </div>
      </div>

      <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Account Info */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 16px' }}>
            Account Details
          </h3>
          <InfoRow label="Display Name" value={user.display_name} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="System Role" value={user.role} />
          <InfoRow label="Status" value={user.is_active ? 'Active' : 'Inactive'} />
          <InfoRow label="Created" value={user.created_at ? new Date(user.created_at).toLocaleDateString() : null} />
          <InfoRow label="Last Login" value={user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'} />
        </Card>

        {/* Contact Info */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 16px' }}>
            Contact & Address
          </h3>
          <InfoRow label="Phone" value={user.phone} />
          <InfoRow label="Address Line 1" value={user.address_line1} />
          <InfoRow label="Address Line 2" value={user.address_line2} />
          <InfoRow label="City" value={user.city} />
          <InfoRow label="State / Province" value={user.state} />
          <InfoRow label="Postal Code" value={user.postal_code} />
          <InfoRow label="Country" value={user.country} />
        </Card>

        {/* ERP Roles */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
              ERP Permissions
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/erp/settings/user-roles')}
            >
              Manage
            </Button>
          </div>
          {user.erp_roles.length === 0 ? (
            <p style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No ERP roles assigned</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {user.erp_roles.map((role) => (
                <div
                  key={role.id}
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
                        backgroundColor: `${getModuleColor(role.module)}20`,
                        color: getModuleColor(role.module),
                        textTransform: 'capitalize',
                      }}
                    >
                      {role.module}
                    </span>
                    <span style={{ color: tokens.colors.textPrimary, fontSize: 14 }}>{role.role_name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>
                    {role.granted_at ? new Date(role.granted_at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 16px' }}>
            Notes
          </h3>
          <p style={{
            fontSize: 14,
            color: user.notes ? tokens.colors.textSecondary : tokens.colors.textMuted,
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}>
            {user.notes || 'No notes added'}
          </p>
        </Card>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        description={`Editing ${user.display_name}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} loading={saving} disabled={!formData.display_name || !formData.email}>
              Save Changes
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              />
              <Input
                label="Email"
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <Input
                label="New Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Leave blank to keep current"
              />
              <Select
                label="System Role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                options={roleOptions}
              />
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Contact & Address
            </h4>
            <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Input
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 555 123 4567"
              />
              <div />
              <div style={{ gridColumn: '1 / -1' }}>
                <Input
                  label="Address Line 1"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input
                  label="Address Line 2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
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

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Internal notes..."
            rows={3}
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        onConfirm={handleDeactivate}
        title="Deactivate User"
        message={`Are you sure you want to deactivate "${user.display_name}"? They will lose access to the system.`}
        loading={deleting}
      />
    </div>
  );
}

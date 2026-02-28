'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { HRDepartment } from '@/lib/erp-types';

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

export default function DepartmentsPage() {
  const { toastError, toastSuccess } = useToast();
  const [departments, setDepartments] = useState<HRDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit/Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<HRDepartment | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HRDepartment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = {
    name: '',
    code: '',
    parent_id: '',
    description: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  const fetchDepartments = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/hr/departments?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setDepartments(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreateDepartment = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/hr/departments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          parent_id: formData.parent_id ? parseInt(formData.parent_id) : null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData(emptyForm);
        fetchDepartments();
        toastSuccess('Department created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create department');
      }
    } catch (error) {
      console.error('Create department error:', error);
      toastError('Failed to create department');
    }

    setCreating(false);
  };

  const handleEdit = async () => {
    if (!selectedDepartment) return;
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/hr/departments/${selectedDepartment.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          parent_id: formData.parent_id ? parseInt(formData.parent_id) : null,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedDepartment(null);
        setFormData(emptyForm);
        fetchDepartments();
        toastSuccess('Department updated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update department');
      }
    } catch (error) {
      console.error('Update department error:', error);
      toastError('Failed to update department');
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/hr/departments/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchDepartments();
        toastSuccess('Department deleted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete department');
      }
    } catch (error) {
      console.error('Delete department error:', error);
      toastError('Failed to delete department');
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  const openEditModal = (dept: HRDepartment) => {
    setSelectedDepartment(dept);
    setFormData({
      name: dept.name || '',
      code: dept.code || '',
      parent_id: dept.parent_id ? dept.parent_id.toString() : '',
      description: dept.description || '',
    });
    setShowEditModal(true);
  };

  const columns: Column<HRDepartment>[] = [
    {
      key: 'code',
      header: 'Code',
      width: 100,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Department',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          {row.description && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
              {row.description.substring(0, 50)}{row.description.length > 50 ? '...' : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'parent_name',
      header: 'Parent',
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'manager_name',
      header: 'Manager',
      render: (_, row) => (
        <span style={{ color: tokens.colors.textSecondary }}>
          {row.manager_name || '-'}
        </span>
      ),
    },
    {
      key: 'employee_count',
      header: 'Employees',
      width: 100,
      align: 'center',
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{value || 0}</span>
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

  const DepartmentFormFields = () => (
    <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Input
        label="Department Name"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="e.g., Engineering"
      />
      <Input
        label="Department Code"
        value={formData.code}
        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
        placeholder="e.g., ENG"
      />
      <Select
        label="Parent Department"
        value={formData.parent_id}
        onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
        options={[
          { value: '', label: 'None (Top Level)' },
          ...departments
            .filter(d => d.id !== selectedDepartment?.id)
            .map(d => ({ value: d.id.toString(), label: d.name })),
        ]}
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Department description..."
          rows={2}
        />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Departments
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage organizational structure
          </p>
        </div>
        <Button onClick={() => {
          setFormData(emptyForm);
          setShowCreateModal(true);
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Department
        </Button>
      </div>

      {/* Departments Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={departments}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No departments found"
        />
      </Card>

      {/* Create Department Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Department"
        description="Create a new department"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateDepartment}
              loading={creating}
              disabled={!formData.name}
            >
              Create Department
            </Button>
          </>
        }
      >
        <DepartmentFormFields />
      </Modal>

      {/* Edit Department Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Department"
        description={selectedDepartment ? `Editing ${selectedDepartment.name}` : ''}
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
        <DepartmentFormFields />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Department"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

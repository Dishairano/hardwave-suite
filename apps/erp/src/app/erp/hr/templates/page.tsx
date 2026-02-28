'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, DataTable, Badge, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { HRDocumentTemplate } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    cardBg: '#18181b',
    border: '#27272a',
  },
};

export default function TemplatesPage() {
  const { toastError, toastSuccess } = useToast();
  const [templates, setTemplates] = useState<HRDocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<HRDocumentTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HRDocumentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    document_type: 'contract',
    title_template: '',
    description_template: '',
    content: '',
    is_active: true,
  });

  const fetchTemplates = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/hr/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      document_type: 'contract',
      title_template: '',
      description_template: '',
      content: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEdit = (template: HRDocumentTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      document_type: template.document_type,
      title_template: template.title_template,
      description_template: template.description_template || '',
      content: template.content || '',
      is_active: template.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.title_template) {
      toastError('Name and title template are required');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const url = editingTemplate
        ? `/api/erp/hr/templates/${editingTemplate.id}`
        : '/api/erp/hr/templates';
      const method = editingTemplate ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        fetchTemplates();
        toastSuccess(editingTemplate ? 'Template updated' : 'Template created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Save template error:', error);
      toastError('Failed to save template');
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/hr/templates/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setDeleteTarget(null);
        fetchTemplates();
        toastSuccess('Template deleted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Delete template error:', error);
      toastError('Failed to delete template');
    }

    setDeleting(false);
  };

  const columns: Column<HRDocumentTemplate>[] = [
    {
      key: 'name',
      header: 'Template Name',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
            {row.title_template}
          </div>
        </div>
      ),
    },
    {
      key: 'document_type',
      header: 'Type',
      width: 150,
      render: (value) => {
        const labels: Record<string, string> = {
          contract: 'Contract',
          nda: 'NDA',
          offer_letter: 'Offer Letter',
          performance_review: 'Performance Review',
          certification: 'Certification',
          other: 'Other',
        };
        return <span style={{ color: tokens.colors.textSecondary }}>{labels[value] || value}</span>;
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      width: 100,
      render: (value) => (
        <Badge variant={value ? 'success' : 'default'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'created_by_name',
      header: 'Created By',
      width: 150,
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      width: 120,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(row)}
            title="Edit"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleteTarget(row)}
            title="Delete"
            style={{ color: tokens.colors.error }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Document Templates
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Create reusable templates for employee documents
          </p>
        </div>
        <Button onClick={handleCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Template
        </Button>
      </div>

      {/* Templates Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={templates}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No templates found. Create your first template to get started."
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTemplate ? 'Edit Template' : 'New Template'}
        description="Create a reusable template for employee documents"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!formData.name || !formData.title_template}
            >
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Template Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Standard Employment Contract"
          />
          <Select
            label="Document Type"
            required
            value={formData.document_type}
            onChange={(e) => setFormData({ ...formData, document_type: e.target.value as any })}
            options={[
              { value: 'contract', label: 'Contract' },
              { value: 'nda', label: 'NDA' },
              { value: 'offer_letter', label: 'Offer Letter' },
              { value: 'performance_review', label: 'Performance Review' },
              { value: 'certification', label: 'Certification' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input
            label="Title Template"
            required
            value={formData.title_template}
            onChange={(e) => setFormData({ ...formData, title_template: e.target.value })}
            placeholder="e.g., Employment Contract - {employee_name}"
            helpText="Use {employee_name}, {date}, {position} as placeholders"
          />
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: tokens.colors.textSecondary, marginBottom: 8 }}>
              Description Template
            </label>
            <textarea
              value={formData.description_template}
              onChange={(e) => setFormData({ ...formData, description_template: e.target.value })}
              placeholder="Default description for this type of document"
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                backgroundColor: tokens.colors.cardBg,
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: 6,
                color: tokens.colors.textPrimary,
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: tokens.colors.textSecondary, marginBottom: 8 }}>
              Template Content (Optional)
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Full template content for reference..."
              style={{
                width: '100%',
                minHeight: 150,
                padding: 12,
                backgroundColor: tokens.colors.cardBg,
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: 6,
                color: tokens.colors.textPrimary,
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, color: tokens.colors.textSecondary }}>Active template</span>
          </label>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}

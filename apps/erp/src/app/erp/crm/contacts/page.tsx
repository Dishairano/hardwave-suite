'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, DataTable, Badge, Textarea, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { CRMContact, CRMCompany } from '@/lib/erp-types';

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

export default function ContactsPage() {
  const { toastError, toastSuccess } = useToast();
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [companies, setCompanies] = useState<CRMCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit/Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CRMContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_id: '',
    job_title: '',
    lead_source: '',
    lead_status: 'new',
    notes: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  const fetchContacts = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/crm/contacts?page=${page}&limit=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (companyFilter) url += `&company_id=${companyFilter}`;
      if (statusFilter) url += `&lead_status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setContacts(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }

    setLoading(false);
  };

  const fetchCompanies = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/crm/companies?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [page, search, companyFilter, statusFilter]);

  const handleCreateContact = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/crm/contacts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          company_id: formData.company_id ? parseInt(formData.company_id) : null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setFormData(emptyForm);
        fetchContacts();
        toastSuccess('Contact created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create contact');
      }
    } catch (error) {
      console.error('Create contact error:', error);
      toastError('Failed to create contact');
    }

    setCreating(false);
  };

  const handleEdit = async () => {
    if (!selectedContact) return;
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/crm/contacts/${selectedContact.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          company_id: formData.company_id ? parseInt(formData.company_id) : null,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedContact(null);
        setFormData(emptyForm);
        fetchContacts();
        toastSuccess('Contact updated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update contact');
      }
    } catch (error) {
      console.error('Update contact error:', error);
      toastError('Failed to update contact');
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/crm/contacts/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchContacts();
        toastSuccess('Contact deleted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete contact');
      }
    } catch (error) {
      console.error('Delete contact error:', error);
      toastError('Failed to delete contact');
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  const openEditModal = (contact: CRMContact) => {
    setSelectedContact(contact);
    setFormData({
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company_id: contact.company_id ? contact.company_id.toString() : '',
      job_title: contact.job_title || '',
      lead_source: contact.lead_source || '',
      lead_status: contact.lead_status || 'new',
      notes: contact.notes || '',
    });
    setShowEditModal(true);
  };

  const columns: Column<CRMContact>[] = [
    {
      key: 'first_name',
      header: 'Name',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.first_name} {row.last_name}
          </div>
          {row.email && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.email}</div>
          )}
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Company',
      render: (value) => <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>,
    },
    {
      key: 'job_title',
      header: 'Title',
      render: (value) => <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>,
    },
    {
      key: 'lead_status',
      header: 'Status',
      width: 120,
      render: (value) => {
        const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
          new: 'default',
          contacted: 'warning',
          qualified: 'success',
          unqualified: 'error',
          converted: 'success',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (value) => (
        <span style={{ fontSize: 13, color: tokens.colors.textSecondary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Added',
      width: 100,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
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

  const ContactFormFields = () => (
    <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Input
        label="First Name"
        required
        value={formData.first_name}
        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
      />
      <Input
        label="Last Name"
        value={formData.last_name}
        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
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
      <Select
        label="Company"
        value={formData.company_id}
        onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
        options={[
          { value: '', label: 'Select company...' },
          ...companies.map(c => ({ value: c.id.toString(), label: c.name })),
        ]}
      />
      <Input
        label="Job Title"
        value={formData.job_title}
        onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
      />
      <Input
        label="Lead Source"
        value={formData.lead_source}
        onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })}
        placeholder="e.g., Website, Referral, Event"
      />
      <Select
        label="Lead Status"
        value={formData.lead_status}
        onChange={(e) => setFormData({ ...formData, lead_status: e.target.value })}
        options={[
          { value: 'new', label: 'New' },
          { value: 'contacted', label: 'Contacted' },
          { value: 'qualified', label: 'Qualified' },
          { value: 'unqualified', label: 'Unqualified' },
          { value: 'converted', label: 'Converted' },
        ]}
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <Textarea
          label="Notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
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
            Contacts
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage your contacts and leads
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
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 250 }}>
            <Input
              label="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Name, email, phone..."
            />
          </div>
          <div style={{ width: 200 }}>
            <Select
              label="Company"
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Companies' },
                ...companies.map(c => ({ value: c.id.toString(), label: c.name })),
              ]}
            />
          </div>
          <div style={{ width: 150 }}>
            <Select
              label="Lead Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'new', label: 'New' },
                { value: 'contacted', label: 'Contacted' },
                { value: 'qualified', label: 'Qualified' },
                { value: 'unqualified', label: 'Unqualified' },
                { value: 'converted', label: 'Converted' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Contacts Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={contacts}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No contacts found"
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

      {/* Create Contact Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Contact"
        description="Create a new contact record"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateContact}
              loading={creating}
              disabled={!formData.first_name}
            >
              Create Contact
            </Button>
          </>
        }
      >
        <ContactFormFields />
      </Modal>

      {/* Edit Contact Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Contact"
        description={selectedContact ? `Editing ${selectedContact.first_name} ${selectedContact.last_name}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} loading={saving} disabled={!formData.first_name}>
              Save Changes
            </Button>
          </>
        }
      >
        <ContactFormFields />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message={`Are you sure you want to delete "${deleteTarget?.first_name} ${deleteTarget?.last_name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

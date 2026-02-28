'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { CRMCompany } from '@/lib/erp-types';

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

const companySizeOptions = [
  { value: 'startup', label: 'Startup' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'enterprise', label: 'Enterprise' },
];

const industryOptions = [
  { value: '', label: 'All Industries' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Other', label: 'Other' },
];

export default function CompaniesPage() {
  const { toastError, toastSuccess } = useToast();
  const [companies, setCompanies] = useState<CRMCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit/Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CRMCompany | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CRMCompany | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = {
    name: '',
    industry: '',
    email: '',
    phone: '',
    website: '',
    company_size: '',
    city: '',
    country: '',
    description: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  const fetchCompanies = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/crm/companies?page=${page}&limit=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (industryFilter) url += `&industry=${encodeURIComponent(industryFilter)}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCompanies(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, [page, search, industryFilter]);

  const handleCreateCompany = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/crm/companies', {
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
        fetchCompanies();
        toastSuccess('Company created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create company');
      }
    } catch (error) {
      console.error('Create company error:', error);
      toastError('Failed to create company');
    }

    setCreating(false);
  };

  const handleEdit = async () => {
    if (!selectedCompany) return;
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/crm/companies/${selectedCompany.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedCompany(null);
        setFormData(emptyForm);
        fetchCompanies();
        toastSuccess('Company updated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update company');
      }
    } catch (error) {
      console.error('Update company error:', error);
      toastError('Failed to update company');
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/crm/companies/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchCompanies();
        toastSuccess('Company deleted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete company');
      }
    } catch (error) {
      console.error('Delete company error:', error);
      toastError('Failed to delete company');
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  const openEditModal = (company: CRMCompany) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name || '',
      industry: company.industry || '',
      email: company.email || '',
      phone: company.phone || '',
      website: company.website || '',
      company_size: company.company_size || '',
      city: company.city || '',
      country: company.country || '',
      description: company.description || '',
    });
    setShowEditModal(true);
  };

  const formatCompanySize = (size: string | null) => {
    if (!size) return '-';
    const sizeMap: Record<string, string> = {
      'startup': 'Startup',
      'small': 'Small',
      'medium': 'Medium',
      'large': 'Large',
      'enterprise': 'Enterprise',
    };
    return sizeMap[size] || size;
  };

  const columns: Column<CRMCompany>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          {row.domain && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.domain}</div>
          )}
          {row.industry && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.industry}</div>
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
      key: 'industry',
      header: 'Industry',
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'company_size',
      header: 'Size',
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>
          {formatCompanySize(value)}
        </span>
      ),
    },
    {
      key: 'contacts_count',
      header: 'Contacts',
      width: 80,
      align: 'center',
      render: (value) => (
        <span style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value || 0}</span>
      ),
    },
    {
      key: 'deals_count',
      header: 'Deals',
      width: 80,
      align: 'center',
      render: (value) => (
        <span style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value || 0}</span>
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

  const CompanyFormFields = () => (
    <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Input
        label="Company Name"
        required
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        placeholder="Company name"
      />
      <Input
        label="Industry"
        value={formData.industry}
        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
        placeholder="e.g., Technology"
      />
      <Input
        label="Email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        placeholder="contact@company.com"
      />
      <Input
        label="Phone"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        placeholder="+1 555 123 4567"
      />
      <Input
        label="Website"
        value={formData.website}
        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
        placeholder="https://company.com"
      />
      <Select
        label="Company Size"
        value={formData.company_size}
        onChange={(e) => setFormData({ ...formData, company_size: e.target.value })}
        options={[{ value: '', label: 'Select size' }, ...companySizeOptions]}
      />
      <Input
        label="City"
        value={formData.city}
        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
        placeholder="San Francisco"
      />
      <Input
        label="Country"
        value={formData.country}
        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
        placeholder="United States"
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the company..."
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
            Companies
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage your business relationships
          </p>
        </div>
        <Button onClick={() => {
          setFormData(emptyForm);
          setShowCreateModal(true);
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Company
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
              placeholder="Search by name, domain, email..."
            />
          </div>
          <div style={{ width: 200 }}>
            <Select
              label="Industry"
              value={industryFilter}
              onChange={(e) => {
                setIndustryFilter(e.target.value);
                setPage(1);
              }}
              options={industryOptions}
            />
          </div>
        </div>
      </Card>

      {/* Companies Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={companies}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No companies found"
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

      {/* Create Company Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Company"
        description="Create a new company record"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCompany}
              loading={creating}
              disabled={!formData.name}
            >
              Create Company
            </Button>
          </>
        }
      >
        <CompanyFormFields />
      </Modal>

      {/* Edit Company Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Company"
        description={selectedCompany ? `Editing ${selectedCompany.name}` : ''}
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
        <CompanyFormFields />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Company"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

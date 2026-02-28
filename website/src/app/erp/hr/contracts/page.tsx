'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Select, DataTable, Badge, Modal, Textarea, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { HRContract } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    brandPurple: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    bgCard: '#101018',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
  },
};

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  draft: 'default',
  pending_internal: 'warning',
  pending_external: 'info',
  completed: 'success',
  revoked: 'error',
  expired: 'error',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_internal: 'Pending Internal',
  pending_external: 'Pending External',
  completed: 'Completed',
  revoked: 'Revoked',
  expired: 'Expired',
};

const docTypeLabels: Record<string, string> = {
  nda: 'NDA',
  employment_contract: 'Employment Contract',
  vendor_agreement: 'Vendor Agreement',
  service_agreement: 'Service Agreement',
  other: 'Other',
};

export default function ContractsPage() {
  const router = useRouter();
  const { toastError } = useToast();
  const [contracts, setContracts] = useState<HRContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const limit = 20;

  const [newContract, setNewContract] = useState({
    title: '',
    document_type: 'nda',
    description: '',
    entity_type: 'standalone',
    external_signer_name: '',
    external_signer_email: '',
  });

  const fetchContracts = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/hr/contracts?page=${page}&limit=${limit}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (docTypeFilter) url += `&document_type=${docTypeFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setContracts(data.items || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchContracts();
  }, [page, statusFilter, docTypeFilter]);

  const handleCreate = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const formData = new FormData();
      formData.append('title', newContract.title);
      formData.append('document_type', newContract.document_type);
      if (newContract.description) formData.append('description', newContract.description);
      formData.append('entity_type', newContract.entity_type);
      formData.append('external_signer_name', newContract.external_signer_name);
      formData.append('external_signer_email', newContract.external_signer_email);
      if (fileToUpload) formData.append('file', fileToUpload);

      const res = await fetch('/api/erp/hr/contracts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        resetForm();
        router.push(`/erp/hr/contracts/${data.id}`);
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create contract');
      }
    } catch (error) {
      console.error('Create contract error:', error);
      toastError('Failed to create contract');
    }

    setCreating(false);
  };

  const resetForm = () => {
    setNewContract({
      title: '',
      document_type: 'nda',
      description: '',
      entity_type: 'standalone',
      external_signer_name: '',
      external_signer_email: '',
    });
    setFileToUpload(null);
  };

  const columns: Column<HRContract>[] = [
    {
      key: 'title',
      header: 'Contract',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.title}
          </div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
            {docTypeLabels[row.document_type] || row.document_type}
          </div>
        </div>
      ),
    },
    {
      key: 'external_signer_name',
      header: 'External Party',
      render: (_, row) => (
        <div>
          <div style={{ color: tokens.colors.textSecondary }}>
            {row.external_signer_name || '-'}
          </div>
          {row.external_signer_email && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
              {row.external_signer_email}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 150,
      render: (value) => (
        <Badge variant={statusColors[value] || 'default'}>
          {statusLabels[value] || value}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      width: 120,
      render: (value) => (
        <span style={{ color: tokens.colors.textMuted }}>
          {value ? new Date(value).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      width: 100,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/erp/hr/contracts/${row.id}`)}
            title="View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
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
            Contracts & NDAs
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage documents and signing workflows
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Contract
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
              onKeyDown={(e) => e.key === 'Enter' && fetchContracts()}
              placeholder="Title, name, email..."
            />
          </div>
          <div style={{ width: 180 }}>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'draft', label: 'Draft' },
                { value: 'pending_internal', label: 'Pending Internal' },
                { value: 'pending_external', label: 'Pending External' },
                { value: 'completed', label: 'Completed' },
                { value: 'revoked', label: 'Revoked' },
              ]}
            />
          </div>
          <div style={{ width: 180 }}>
            <Select
              label="Type"
              value={docTypeFilter}
              onChange={(e) => {
                setDocTypeFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Types' },
                { value: 'nda', label: 'NDA' },
                { value: 'employment_contract', label: 'Employment Contract' },
                { value: 'vendor_agreement', label: 'Vendor Agreement' },
                { value: 'service_agreement', label: 'Service Agreement' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>
          <Button variant="secondary" onClick={fetchContracts}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={contracts}
          loading={loading}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/erp/hr/contracts/${row.id}`)}
          emptyMessage="No contracts found"
          pagination={{
            page,
            limit,
            total,
            onPageChange: setPage,
          }}
        />
      </Card>

      {/* Create Contract Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        title="Create New Contract"
        description="Upload a document and configure signing workflow"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={creating}
              disabled={!newContract.title || !newContract.external_signer_name || !newContract.external_signer_email}
            >
              Create Contract
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Title"
            required
            value={newContract.title}
            onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
            placeholder="e.g., Beta Tester NDA - John Doe"
          />
          <Select
            label="Document Type"
            required
            value={newContract.document_type}
            onChange={(e) => setNewContract({ ...newContract, document_type: e.target.value })}
            options={[
              { value: 'nda', label: 'NDA' },
              { value: 'employment_contract', label: 'Employment Contract' },
              { value: 'vendor_agreement', label: 'Vendor Agreement' },
              { value: 'service_agreement', label: 'Service Agreement' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input
            label="External Signer Name"
            required
            value={newContract.external_signer_name}
            onChange={(e) => setNewContract({ ...newContract, external_signer_name: e.target.value })}
            placeholder="John Doe"
          />
          <Input
            label="External Signer Email"
            required
            type="email"
            value={newContract.external_signer_email}
            onChange={(e) => setNewContract({ ...newContract, external_signer_email: e.target.value })}
            placeholder="john@example.com"
          />
          <Select
            label="Link To"
            value={newContract.entity_type}
            onChange={(e) => setNewContract({ ...newContract, entity_type: e.target.value })}
            options={[
              { value: 'standalone', label: 'Standalone' },
              { value: 'employee', label: 'Employee' },
              { value: 'vendor', label: 'Vendor' },
              { value: 'project', label: 'Project' },
            ]}
          />
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: tokens.colors.textSecondary, marginBottom: 6 }}>
              Document (PDF)
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 44,
                borderRadius: 8,
                border: `1px dashed ${fileToUpload ? tokens.colors.success : tokens.colors.borderSubtle}`,
                backgroundColor: tokens.colors.bgCard,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontSize: 14,
                color: fileToUpload ? tokens.colors.success : tokens.colors.textMuted,
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {fileToUpload ? fileToUpload.name : 'Upload file'}
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Textarea
            label="Description"
            value={newContract.description}
            onChange={(e) => setNewContract({ ...newContract, description: e.target.value })}
            placeholder="Optional details about this contract"
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
}

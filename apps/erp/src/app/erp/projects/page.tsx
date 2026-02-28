'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, Badge, Button, Card, Modal, Input, Select, Textarea, StatCard, StatCardGrid, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { Project, ProjectStatus, ProjectPriority } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandBlue: '#3B82F6',
    brandGreen: '#00FF00',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

const statusColors: Record<ProjectStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  planning: 'info',
  active: 'success',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'error',
};

const priorityColors: Record<ProjectPriority, string> = {
  low: '#6B7280',
  medium: '#3B82F6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

export default function ProjectsPage() {
  const router = useRouter();
  const { toastError, toastSuccess } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, overdue: 0 });

  // Edit/Delete state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = {
    name: '',
    description: '',
    priority: 'medium' as ProjectPriority,
    status: 'draft' as ProjectStatus,
    project_type: 'internal',
    start_date: '',
    target_end_date: '',
    budget_amount: '',
    billable: false,
    hourly_rate: '',
  };

  const [formData, setFormData] = useState(emptyForm);

  const fetchProjects = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/erp/projects?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setProjects(data.items);
        setTotal(data.pagination.total);

        // Calculate stats
        const allProjects = data.items as Project[];
        setStats({
          total: data.pagination.total,
          active: allProjects.filter((p) => p.status === 'active').length,
          completed: allProjects.filter((p) => p.status === 'completed').length,
          overdue: allProjects.filter((p) =>
            p.status === 'active' && p.target_end_date && new Date(p.target_end_date) < new Date()
          ).length,
        });
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, [page, limit, search, statusFilter]);

  const handleCreateProject = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : 0,
          hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : 0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        setFormData(emptyForm);
        router.push(`/erp/projects/${data.project.id}`);
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Create project error:', error);
      toastError('Failed to create project');
    }

    setCreating(false);
  };

  const handleEdit = async () => {
    if (!selectedProject) return;
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : 0,
          hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : 0,
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedProject(null);
        setFormData(emptyForm);
        fetchProjects();
        toastSuccess('Project updated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update project');
      }
    } catch (error) {
      console.error('Update project error:', error);
      toastError('Failed to update project');
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/projects/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchProjects();
        toastSuccess('Project deleted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Delete project error:', error);
      toastError('Failed to delete project');
    }

    setDeleting(false);
    setDeleteTarget(null);
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name || '',
      description: project.description || '',
      priority: project.priority || 'medium',
      status: project.status || 'draft',
      project_type: project.project_type || 'internal',
      start_date: project.start_date ? String(project.start_date).split('T')[0] : '',
      target_end_date: project.target_end_date ? String(project.target_end_date).split('T')[0] : '',
      budget_amount: project.budget_amount ? project.budget_amount.toString() : '',
      billable: project.billable || false,
      hourly_rate: project.hourly_rate ? project.hourly_rate.toString() : '',
    });
    setShowEditModal(true);
  };

  const columns: Column<Project>[] = [
    {
      key: 'project_code',
      header: 'Code',
      width: 100,
      render: (_, row) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: tokens.colors.brandBlue }}>
          {row.project_code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Project Name',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{row.name}</div>
          {row.client_name && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.client_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      render: (value) => (
        <Badge variant={statusColors[value as ProjectStatus]}>
          {value.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      width: 100,
      render: (value) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: priorityColors[value as ProjectPriority],
            }}
          />
          <span style={{ textTransform: 'capitalize', fontSize: 13 }}>{value}</span>
        </div>
      ),
    },
    {
      key: 'progress_percent',
      header: 'Progress',
      width: 120,
      render: (value) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>{value}%</span>
          </div>
          <div
            style={{
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${value}%`,
                height: '100%',
                backgroundColor: value >= 100 ? tokens.colors.success : tokens.colors.brandBlue,
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'target_end_date',
      header: 'Due Date',
      width: 110,
      render: (value) =>
        value ? (
          <span style={{ fontSize: 13 }}>{new Date(value).toLocaleDateString()}</span>
        ) : (
          <span style={{ color: tokens.colors.textMuted }}>-</span>
        ),
    },
    {
      key: 'id',
      header: 'Actions',
      width: 120,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
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

  const ProjectFormFields = ({ showStatus }: { showStatus?: boolean }) => (
    <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Input
          label="Project Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter project name"
        />
      </div>

      <Select
        label="Priority"
        value={formData.priority}
        onChange={(e) => setFormData({ ...formData, priority: e.target.value as ProjectPriority })}
        options={[
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
        ]}
      />

      {showStatus ? (
        <Select
          label="Status"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'planning', label: 'Planning' },
            { value: 'active', label: 'Active' },
            { value: 'on_hold', label: 'On Hold' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      ) : (
        <Select
          label="Project Type"
          value={formData.project_type}
          onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
          options={[
            { value: 'internal', label: 'Internal' },
            { value: 'client', label: 'Client' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'research', label: 'Research' },
          ]}
        />
      )}

      {showStatus && (
        <Select
          label="Project Type"
          value={formData.project_type}
          onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
          options={[
            { value: 'internal', label: 'Internal' },
            { value: 'client', label: 'Client' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'research', label: 'Research' },
          ]}
        />
      )}

      <Input
        label="Start Date"
        type="date"
        value={formData.start_date}
        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
      />

      <Input
        label="Target End Date"
        type="date"
        value={formData.target_end_date}
        onChange={(e) => setFormData({ ...formData, target_end_date: e.target.value })}
      />

      <Input
        label="Budget"
        type="number"
        value={formData.budget_amount}
        onChange={(e) => setFormData({ ...formData, budget_amount: e.target.value })}
        placeholder="0.00"
        leftIcon={<span>$</span>}
      />

      <Input
        label="Hourly Rate"
        type="number"
        value={formData.hourly_rate}
        onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
        placeholder="0.00"
        leftIcon={<span>$</span>}
      />

      <div style={{ gridColumn: '1 / -1' }}>
        <Textarea
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the project..."
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
            Projects
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage your projects and track progress
          </p>
        </div>
        <Button onClick={() => {
          setFormData(emptyForm);
          setShowCreateModal(true);
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Project
        </Button>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 24 }}>
        <StatCardGrid>
          <StatCard
            title="Total Projects"
            value={stats.total}
            size="sm"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
            color={tokens.colors.brandBlue}
          />
          <StatCard
            title="Active"
            value={stats.active}
            size="sm"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
            color={tokens.colors.success}
          />
          <StatCard
            title="Completed"
            value={stats.completed}
            size="sm"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            color={tokens.colors.brandGreen}
          />
          <StatCard
            title="Overdue"
            value={stats.overdue}
            size="sm"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            color={tokens.colors.error}
          />
        </StatCardGrid>
      </div>

      {/* Filters */}
      <Card padding={false}>
        <div className="erp-filter-bar" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: '#101018',
                color: '#fff',
                fontSize: 14,
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: '#101018',
              color: '#a1a1aa',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={projects}
          loading={loading}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/erp/projects/${row.id}`)}
          pagination={{
            page,
            limit,
            total,
            onPageChange: setPage,
            onLimitChange: (newLimit) => {
              setLimit(newLimit);
              setPage(1);
            },
          }}
          emptyMessage="No projects found. Create your first project to get started."
        />
      </Card>

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Project"
        description="Fill in the details to create a new project"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} loading={creating} disabled={!formData.name}>
              Create Project
            </Button>
          </>
        }
      >
        <ProjectFormFields />
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Project"
        description={selectedProject ? `Editing ${selectedProject.name}` : ''}
        size="lg"
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
        <ProjectFormFields showStatus />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

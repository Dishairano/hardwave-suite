'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, DataTable, Badge, Textarea, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { ProjectMilestone } from '@/lib/erp-types';

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

interface MilestoneWithExtras extends ProjectMilestone {
  project_name?: string;
  task_count?: number;
  completed_tasks?: number;
}

interface Project {
  id: number;
  name: string;
  project_code: string;
}

export default function MilestonesPage() {
  const { toastError, toastSuccess } = useToast();
  const [milestones, setMilestones] = useState<MilestoneWithExtras[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newMilestone, setNewMilestone] = useState({
    project_id: '',
    name: '',
    description: '',
    due_date: '',
    status: 'pending',
  });

  const fetchMilestones = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/projects/milestones?page=${page}&limit=20`;
      if (projectFilter) url += `&project_id=${projectFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setMilestones(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
    }

    setLoading(false);
  };

  const fetchProjects = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/projects?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchMilestones();
  }, [page, projectFilter, statusFilter]);

  const handleCreateMilestone = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/projects/milestones', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newMilestone,
          project_id: newMilestone.project_id ? parseInt(newMilestone.project_id) : null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewMilestone({
          project_id: '',
          name: '',
          description: '',
          due_date: '',
          status: 'pending',
        });
        fetchMilestones();
        toastSuccess('Milestone created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create milestone');
      }
    } catch (error) {
      console.error('Create milestone error:', error);
      toastError('Failed to create milestone');
    }

    setCreating(false);
  };

  const isOverdue = (dueDate: Date | null, status: string) => {
    if (!dueDate || status === 'completed' || status === 'cancelled') return false;
    return new Date(dueDate) < new Date();
  };

  const columns: Column<MilestoneWithExtras>[] = [
    {
      key: 'name',
      header: 'Milestone',
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{value}</div>
          {row.description && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'project_name',
      header: 'Project',
      render: (value) => <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (value, row) => {
        if (!value) return '-';
        const overdue = isOverdue(value, row.status);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: overdue ? tokens.colors.error : tokens.colors.textSecondary }}>
              {new Date(value).toLocaleDateString()}
            </span>
            {overdue && (
              <span style={{ fontSize: 11, color: tokens.colors.error, fontWeight: 600 }}>OVERDUE</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (value) => {
        const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
          pending: 'default',
          in_progress: 'warning',
          completed: 'success',
          cancelled: 'error',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'task_count',
      header: 'Progress',
      width: 120,
      render: (value, row) => {
        const completed = row.completed_tasks || 0;
        const total = value || 0;
        const percent = total > 0 ? (completed / total) * 100 : 0;

        return (
          <div>
            <div style={{ fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 4 }}>
              {completed}/{total} tasks
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                backgroundColor: '#27272a',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  backgroundColor: percent === 100 ? tokens.colors.success : tokens.colors.brandPink,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Milestones
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Track project milestones and deadlines
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Add Milestone
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 250 }}>
            <Select
              label="Project"
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Projects' },
                ...projects.map(p => ({ value: p.id.toString(), label: p.name })),
              ]}
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
                { value: 'pending', label: 'Pending' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Milestones Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={milestones}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No milestones found"
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

      {/* Create Milestone Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Milestone"
        description="Create a new project milestone"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateMilestone}
              loading={creating}
              disabled={!newMilestone.project_id || !newMilestone.name}
            >
              Create Milestone
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <Select
            label="Project"
            required
            value={newMilestone.project_id}
            onChange={(e) => setNewMilestone({ ...newMilestone, project_id: e.target.value })}
            options={[
              { value: '', label: 'Select project...' },
              ...projects.map(p => ({ value: p.id.toString(), label: p.name })),
            ]}
          />
          <Input
            label="Name"
            required
            value={newMilestone.name}
            onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
          />
          <Textarea
            label="Description"
            value={newMilestone.description}
            onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
            rows={3}
          />
          <Input
            label="Due Date"
            type="date"
            value={newMilestone.due_date}
            onChange={(e) => setNewMilestone({ ...newMilestone, due_date: e.target.value })}
          />
          <Select
            label="Status"
            value={newMilestone.status}
            onChange={(e) => setNewMilestone({ ...newMilestone, status: e.target.value })}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}

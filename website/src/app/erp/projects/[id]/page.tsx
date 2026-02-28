'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Badge, Modal, Input, Select, Textarea, useToast, ConfirmDialog } from '@/components/erp';
import type { Project, ProjectTeamMember, ProjectMilestone, ProjectStatus, ProjectPriority, MilestoneStatus } from '@/lib/erp-types';

const tokens = {
  colors: {
    bgPrimary: '#08080c',
    bgCard: '#101018',
    bgElevated: '#0c0c12',
    bgHover: '#14141c',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.1)',
    brandBlue: '#3B82F6',
    brandGreen: '#00FF00',
    brandPurple: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
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

const milestoneStatusColors: Record<MilestoneStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  in_progress: 'info',
  completed: 'success',
  overdue: 'error',
};

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toastSuccess, toastError } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [taskStats, setTaskStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 'medium' as ProjectPriority,
    status: 'draft' as ProjectStatus,
    project_type: 'internal',
    start_date: '',
    target_end_date: '',
    budget_amount: '',
    hourly_rate: '',
    total_hours_estimated: '',
    progress_percent: '',
  });

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProject = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/projects/${resolvedParams.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setTeamMembers(data.teamMembers || []);
        setMilestones(data.milestones || []);
        setTaskStats(data.taskStats || {});
      } else {
        toastError('Failed to load project');
        router.push('/erp/projects');
      }
    } catch {
      toastError('Failed to load project');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProject();
  }, [resolvedParams.id]);

  const openEditModal = () => {
    if (!project) return;
    setFormData({
      name: project.name || '',
      description: project.description || '',
      priority: project.priority || 'medium',
      status: project.status || 'draft',
      project_type: project.project_type || 'internal',
      start_date: project.start_date ? String(project.start_date).split('T')[0] : '',
      target_end_date: project.target_end_date ? String(project.target_end_date).split('T')[0] : '',
      budget_amount: project.budget_amount ? project.budget_amount.toString() : '',
      hourly_rate: project.hourly_rate ? project.hourly_rate.toString() : '',
      total_hours_estimated: project.total_hours_estimated ? project.total_hours_estimated.toString() : '',
      progress_percent: project.progress_percent ? project.progress_percent.toString() : '0',
    });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/projects/${project.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : 0,
          hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : 0,
          total_hours_estimated: formData.total_hours_estimated ? parseFloat(formData.total_hours_estimated) : 0,
          progress_percent: formData.progress_percent ? parseInt(formData.progress_percent) : 0,
        }),
      });
      if (res.ok) {
        toastSuccess('Project updated');
        setShowEditModal(false);
        fetchProject();
      } else {
        const err = await res.json();
        toastError(err.error || 'Failed to update');
      }
    } catch {
      toastError('Failed to update project');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!project) return;
    setDeleting(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/projects/${project.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toastSuccess('Project deleted');
        router.push('/erp/projects');
      } else {
        const err = await res.json();
        toastError(err.error || 'Failed to delete');
      }
    } catch {
      toastError('Failed to delete project');
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div style={{ color: tokens.colors.textMuted }}>Loading project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <h2 style={{ color: tokens.colors.textPrimary }}>Project not found</h2>
        <Button variant="secondary" onClick={() => router.push('/erp/projects')} style={{ marginTop: 16 }}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const totalTasks = Object.values(taskStats).reduce((a, b) => a + b, 0);
  const doneTasks = (taskStats['done'] || 0) + (taskStats['cancelled'] || 0);
  const budgetUsedPercent = project.budget_amount > 0
    ? Math.round((project.spent_amount / project.budget_amount) * 100)
    : 0;
  const hoursPercent = project.total_hours_estimated > 0
    ? Math.round((project.total_hours_logged / project.total_hours_estimated) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Button variant="ghost" size="sm" onClick={() => router.push('/erp/projects')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back
        </Button>
        <span style={{ color: tokens.colors.textFaint, fontSize: 13 }}>
          <Link href="/erp/projects" style={{ color: tokens.colors.textMuted, textDecoration: 'none' }}>Projects</Link>
          {' / '}
          <span style={{ color: tokens.colors.textSecondary }}>{project.project_code}</span>
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
              {project.name}
            </h1>
            <Badge variant={statusColors[project.status]}>
              {project.status.replace('_', ' ')}
            </Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: tokens.colors.textMuted }}>
            <span style={{ fontFamily: 'monospace', color: tokens.colors.brandBlue }}>{project.project_code}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                backgroundColor: priorityColors[project.priority],
              }} />
              {project.priority} priority
            </span>
            <span style={{ textTransform: 'capitalize' }}>{project.project_type}</span>
            {project.manager_name && <span>Manager: {project.manager_name}</span>}
            {project.client_name && <span>Client: {project.client_name}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={openEditModal}>Edit</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(true)} style={{ color: tokens.colors.error }}>Delete</Button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Progress */}
        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Progress</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.textPrimary, marginBottom: 8 }}>{project.progress_percent}%</div>
            <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${project.progress_percent}%`,
                height: '100%',
                backgroundColor: project.progress_percent >= 100 ? tokens.colors.success : tokens.colors.brandBlue,
                borderRadius: 3,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        </Card>
        {/* Tasks */}
        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tasks</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.textPrimary }}>
              {doneTasks}<span style={{ fontSize: 16, color: tokens.colors.textMuted, fontWeight: 400 }}>/{totalTasks}</span>
            </div>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 4 }}>
              {taskStats['in_progress'] || 0} in progress
            </div>
          </div>
        </Card>
        {/* Budget */}
        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Budget</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.textPrimary }}>
              {formatCurrency(project.spent_amount)}
            </div>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 4 }}>
              of {formatCurrency(project.budget_amount)} ({budgetUsedPercent}%)
            </div>
          </div>
        </Card>
        {/* Hours */}
        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hours</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.textPrimary }}>
              {project.total_hours_logged}<span style={{ fontSize: 16, color: tokens.colors.textMuted, fontWeight: 400 }}>h</span>
            </div>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 4 }}>
              of {project.total_hours_estimated}h estimated ({hoursPercent}%)
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Description */}
          {project.description && (
            <Card>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 12px' }}>Description</h3>
                <p style={{ fontSize: 14, color: tokens.colors.textSecondary, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {project.description}
                </p>
              </div>
            </Card>
          )}

          {/* Task Breakdown */}
          <Card>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>Task Breakdown</h3>
                <Button variant="ghost" size="sm" onClick={() => router.push(`/erp/projects/tasks?project=${project.id}`)}>
                  View Tasks
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
              {totalTasks === 0 ? (
                <div style={{ fontSize: 13, color: tokens.colors.textMuted, textAlign: 'center', padding: 20 }}>
                  No tasks yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(['backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled'] as const).map((status) => {
                    const count = taskStats[status] || 0;
                    if (count === 0) return null;
                    const pct = Math.round((count / totalTasks) * 100);
                    const colorMap: Record<string, string> = {
                      backlog: '#6B7280', todo: '#3B82F6', in_progress: '#F59E0B',
                      review: '#8B5CF6', done: '#10B981', cancelled: '#EF4444',
                    };
                    return (
                      <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 90, fontSize: 12, color: tokens.colors.textMuted, textTransform: 'capitalize' }}>
                          {status.replace('_', ' ')}
                        </div>
                        <div style={{ flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: colorMap[status], borderRadius: 3 }} />
                        </div>
                        <div style={{ width: 32, fontSize: 12, color: tokens.colors.textSecondary, textAlign: 'right' }}>{count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Milestones */}
          <Card>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>Milestones</h3>
                <Button variant="ghost" size="sm" onClick={() => router.push(`/erp/projects/milestones?project=${project.id}`)}>
                  Manage
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Button>
              </div>
              {milestones.length === 0 ? (
                <div style={{ fontSize: 13, color: tokens.colors.textMuted, textAlign: 'center', padding: 20 }}>
                  No milestones
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {milestones.map((ms) => (
                    <div key={ms.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: tokens.radius.default,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${tokens.colors.borderSubtle}`,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: tokens.colors.textPrimary }}>{ms.name}</div>
                        {ms.due_date && (
                          <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 2 }}>
                            Due {formatDate(ms.due_date)}
                          </div>
                        )}
                      </div>
                      <Badge variant={milestoneStatusColors[ms.status]}>
                        {ms.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Details */}
          <Card>
            <div style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 16px' }}>Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {([
                  ['Status', <Badge key="s" variant={statusColors[project.status]}>{project.status.replace('_', ' ')}</Badge>],
                  ['Priority', <span key="p" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: priorityColors[project.priority] }} />
                    <span style={{ textTransform: 'capitalize' }}>{project.priority}</span>
                  </span>],
                  ['Type', <span key="t" style={{ textTransform: 'capitalize' }}>{project.project_type}</span>],
                  ['Billable', project.billable ? 'Yes' : 'No'],
                  ['Hourly Rate', project.hourly_rate ? formatCurrency(project.hourly_rate) : '-'],
                  ['Start Date', formatDate(project.start_date)],
                  ['Target End', formatDate(project.target_end_date)],
                  ['Actual End', formatDate(project.actual_end_date)],
                  ['Created', formatDate(project.created_at)],
                ] as [string, React.ReactNode][]).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: tokens.colors.textMuted }}>{label}</span>
                    <span style={{ fontSize: 13, color: tokens.colors.textSecondary }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Team */}
          <Card>
            <div style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 16px' }}>
                Team ({teamMembers.length})
              </h3>
              {teamMembers.length === 0 ? (
                <div style={{ fontSize: 13, color: tokens.colors.textMuted, textAlign: 'center', padding: 16 }}>
                  No team members assigned
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {teamMembers.map((tm) => (
                    <div key={tm.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 10px', borderRadius: tokens.radius.default,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: tokens.colors.textPrimary }}>
                          {tm.user_name || tm.user_email}
                        </div>
                        <div style={{ fontSize: 11, color: tokens.colors.textMuted, textTransform: 'capitalize' }}>
                          {tm.role}
                        </div>
                      </div>
                      {tm.allocated_hours > 0 && (
                        <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>{tm.allocated_hours}h</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Quick Links */}
          <Card>
            <div style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 16px' }}>Quick Links</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button
                  variant="secondary"
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                  onClick={() => router.push(`/erp/projects/tasks?project=${project.id}`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                  Task Board
                </Button>
                <Button
                  variant="secondary"
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                  onClick={() => router.push(`/erp/projects/time?project=${project.id}`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Time Tracking
                </Button>
                <Button
                  variant="secondary"
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                  onClick={() => router.push(`/erp/projects/milestones?project=${project.id}`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  Milestones
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Project"
        description={`Editing ${project.name}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!formData.name}>Save Changes</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Project Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
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
          <Input
            label="Progress %"
            type="number"
            value={formData.progress_percent}
            onChange={(e) => setFormData({ ...formData, progress_percent: e.target.value })}
          />
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
            leftIcon={<span>$</span>}
          />
          <Input
            label="Hourly Rate"
            type="number"
            value={formData.hourly_rate}
            onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
            leftIcon={<span>$</span>}
          />
          <Input
            label="Estimated Hours"
            type="number"
            value={formData.total_hours_estimated}
            onChange={(e) => setFormData({ ...formData, total_hours_estimated: e.target.value })}
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
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This will also delete all tasks, time entries, and milestones. This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { TimeTracker, TimeEntryRow, Card, Button, DataTable, Badge, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { TimeEntry, Project, Task } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandBlue: '#3B82F6',
    brandTurquoise: '#40E0D0',
    success: '#10B981',
  },
};

export default function TimeTrackingPage() {
  const { toastError, toastSuccess } = useToast();
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ totalHours: 0, totalMinutes: 0 });
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const fetchActiveTimer = useCallback(async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/projects/time/active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsRunning(data.isRunning);
        setActiveTimer(data.entry);
      }
    } catch (error) {
      console.error('Failed to fetch active timer:', error);
    }
  }, []);

  const fetchProjects = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/projects?limit=100&status=active', {
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

  const fetchTasks = async (projectId: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/projects/tasks?project_id=${projectId}&status=todo,in_progress,review&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        user_id: 'me',
        start_date: dateRange.start,
        end_date: dateRange.end,
      });

      if (selectedProjectId) {
        params.set('project_id', selectedProjectId);
      }

      const res = await fetch(`/api/erp/projects/time?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEntries(data.items);
        setTotal(data.pagination.total);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch time entries:', error);
    }

    setLoading(false);
  }, [page, dateRange, selectedProjectId]);

  useEffect(() => {
    fetchActiveTimer();
    fetchProjects();
  }, [fetchActiveTimer]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleStartTimer = async (data: { projectId?: number; taskId?: number; description: string }) => {
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/projects/time', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: data.projectId,
          task_id: data.taskId,
          description: data.description,
          start_timer: true,
        }),
      });

      if (res.ok) {
        await fetchActiveTimer();
        toastSuccess('Timer started');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to start timer');
      }
    } catch (error) {
      console.error('Start timer error:', error);
      toastError('Failed to start timer');
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;

    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/projects/time/${activeTimer.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stop_timer: true }),
      });

      if (res.ok) {
        setIsRunning(false);
        setActiveTimer(null);
        fetchEntries();
        toastSuccess('Timer stopped');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to stop timer');
      }
    } catch (error) {
      console.error('Stop timer error:', error);
      toastError('Failed to stop timer');
    }
  };

  const formatDuration = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const columns: Column<TimeEntry>[] = [
    {
      key: 'project_name',
      header: 'Project',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.project_name}
          </div>
          {row.task_title && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
              {row.task_title}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (value) => (
        <span style={{ color: value ? tokens.colors.textSecondary : tokens.colors.textMuted }}>
          {value || 'No description'}
        </span>
      ),
    },
    {
      key: 'start_time',
      header: 'Date',
      width: 120,
      render: (value) => (
        <span style={{ fontSize: 13 }}>
          {new Date(value).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'duration_minutes',
      header: 'Duration',
      width: 100,
      align: 'right',
      render: (value) => (
        <span style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
          {formatDuration(value || 0)}
        </span>
      ),
    },
    {
      key: 'billable',
      header: 'Billable',
      width: 80,
      align: 'center',
      render: (value) => (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: value ? tokens.colors.success : tokens.colors.textMuted,
            margin: '0 auto',
          }}
          title={value ? 'Billable' : 'Non-billable'}
        />
      ),
    },
    {
      key: 'billed',
      header: 'Status',
      width: 100,
      render: (value) => (
        <Badge variant={value ? 'success' : 'default'}>
          {value ? 'Billed' : 'Unbilled'}
        </Badge>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
          Time Tracking
        </h1>
        <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
          Track time spent on projects and tasks
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
        {/* Timer Column */}
        <div>
          <TimeTracker
            isRunning={isRunning}
            startTime={activeTimer?.start_time ? new Date(activeTimer.start_time) : undefined}
            projectId={activeTimer?.project_id}
            projectName={activeTimer?.project_name}
            taskId={activeTimer?.task_id || undefined}
            taskTitle={activeTimer?.task_title}
            description={activeTimer?.description || ''}
            onStart={handleStartTimer}
            onStop={handleStopTimer}
            projects={projects.map((p) => ({ id: p.id, name: `${p.project_code} - ${p.name}` }))}
            tasks={tasks.map((t) => ({ id: t.id, title: t.title, project_id: t.project_id }))}
          />

          {/* Today's Summary */}
          <Card title="Today's Summary" style={{ marginTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>
                  Total Hours
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.brandTurquoise }}>
                  {summary.totalHours.toFixed(1)}h
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>
                  Entries
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary }}>
                  {total}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Entries Column */}
        <div>
          <Card padding={false}>
            {/* Filters */}
            <div
              className="erp-filter-bar"
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: '#101018',
                  color: '#a1a1aa',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_code} - {p.name}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: '#a1a1aa',
                    fontSize: 13,
                  }}
                />
                <span style={{ color: tokens.colors.textMuted }}>to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: '#101018',
                    color: '#a1a1aa',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <DataTable
              columns={columns}
              data={entries}
              loading={loading}
              rowKey={(row) => row.id}
              pagination={{
                page,
                limit: 20,
                total,
                onPageChange: setPage,
              }}
              emptyMessage="No time entries found for the selected period."
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

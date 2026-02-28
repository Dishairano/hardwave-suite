'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, DataTable, Badge, Textarea, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { CRMActivity, CRMContact, CRMCompany } from '@/lib/erp-types';

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

export default function ActivitiesPage() {
  const { toastError, toastSuccess } = useToast();
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [companies, setCompanies] = useState<CRMCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activityTypeFilter, setActivityTypeFilter] = useState('');
  const [completedFilter, setCompletedFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newActivity, setNewActivity] = useState({
    activity_type: 'task',
    subject: '',
    contact_id: '',
    company_id: '',
    due_date: '',
    priority: 'medium',
    description: '',
  });

  const fetchActivities = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/crm/activities?page=${page}&limit=20`;
      if (activityTypeFilter) url += `&activity_type=${activityTypeFilter}`;
      if (completedFilter) url += `&is_completed=${completedFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setActivities(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }

    setLoading(false);
  };

  const fetchContacts = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/crm/contacts?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
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
    fetchContacts();
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [page, activityTypeFilter, completedFilter]);

  const handleCreateActivity = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/crm/activities', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newActivity,
          contact_id: newActivity.contact_id ? parseInt(newActivity.contact_id) : null,
          company_id: newActivity.company_id ? parseInt(newActivity.company_id) : null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewActivity({
          activity_type: 'task',
          subject: '',
          contact_id: '',
          company_id: '',
          due_date: '',
          priority: 'medium',
          description: '',
        });
        fetchActivities();
        toastSuccess('Activity created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create activity');
      }
    } catch (error) {
      console.error('Create activity error:', error);
      toastError('Failed to create activity');
    }

    setCreating(false);
  };

  const isOverdue = (dueDate: Date | null, isCompleted: boolean) => {
    if (!dueDate || isCompleted) return false;
    return new Date(dueDate) < new Date();
  };

  const columns: Column<CRMActivity>[] = [
    {
      key: 'activity_type',
      header: 'Type',
      width: 100,
      render: (value) => {
        const activityColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
          call: 'default',
          meeting: 'warning',
          email: 'success',
          task: 'error',
          note: 'default',
        };
        return <Badge variant={activityColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.subject}
          </div>
          {row.description && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'contact_name',
      header: 'Contact',
      render: (_, row) => (
        <div>
          {row.contact_name && (
            <div style={{ color: tokens.colors.textSecondary }}>{row.contact_name}</div>
          )}
          {row.company_name && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.company_name}</div>
          )}
          {!row.contact_name && !row.company_name && (
            <span style={{ color: tokens.colors.textMuted }}>-</span>
          )}
        </div>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (value, row) => (
        <div>
          {value ? (
            <>
              <div style={{ color: tokens.colors.textSecondary }}>
                {new Date(value).toLocaleDateString()}
              </div>
              {isOverdue(value, row.is_completed) && (
                <Badge variant="error">Overdue</Badge>
              )}
            </>
          ) : (
            <span style={{ color: tokens.colors.textMuted }}>-</span>
          )}
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      width: 80,
      render: (value) => {
        const priorityColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
          low: 'default',
          medium: 'warning',
          high: 'error',
        };
        return <Badge variant={priorityColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'is_completed',
      header: 'Status',
      width: 100,
      render: (value) => {
        return (
          <Badge variant={value ? 'success' : 'warning'}>
            {value ? 'completed' : 'pending'}
          </Badge>
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
            Activities
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Track calls, meetings, and tasks
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Log Activity
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 180 }}>
            <Select
              label="Activity Type"
              value={activityTypeFilter}
              onChange={(e) => {
                setActivityTypeFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Types' },
                { value: 'call', label: 'Call' },
                { value: 'meeting', label: 'Meeting' },
                { value: 'email', label: 'Email' },
                { value: 'task', label: 'Task' },
                { value: 'note', label: 'Note' },
              ]}
            />
          </div>
          <div style={{ width: 180 }}>
            <Select
              label="Status"
              value={completedFilter}
              onChange={(e) => {
                setCompletedFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All' },
                { value: 'false', label: 'Pending' },
                { value: 'true', label: 'Completed' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Activities Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={activities}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No activities found"
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

      {/* Create Activity Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Log Activity"
        description="Create a new activity record"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateActivity}
              loading={creating}
              disabled={!newActivity.activity_type || !newActivity.subject}
            >
              Create Activity
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Select
            label="Activity Type"
            required
            value={newActivity.activity_type}
            onChange={(e) => setNewActivity({ ...newActivity, activity_type: e.target.value })}
            options={[
              { value: 'call', label: 'Call' },
              { value: 'meeting', label: 'Meeting' },
              { value: 'email', label: 'Email' },
              { value: 'task', label: 'Task' },
              { value: 'note', label: 'Note' },
            ]}
          />
          <Input
            label="Subject"
            required
            value={newActivity.subject}
            onChange={(e) => setNewActivity({ ...newActivity, subject: e.target.value })}
          />
          <Select
            label="Contact"
            value={newActivity.contact_id}
            onChange={(e) => setNewActivity({ ...newActivity, contact_id: e.target.value })}
            options={[
              { value: '', label: 'Select contact...' },
              ...contacts.map(c => ({
                value: c.id.toString(),
                label: `${c.first_name} ${c.last_name || ''}`.trim()
              })),
            ]}
          />
          <Select
            label="Company"
            value={newActivity.company_id}
            onChange={(e) => setNewActivity({ ...newActivity, company_id: e.target.value })}
            options={[
              { value: '', label: 'Select company...' },
              ...companies.map(c => ({ value: c.id.toString(), label: c.name })),
            ]}
          />
          <Input
            label="Due Date"
            type="date"
            value={newActivity.due_date}
            onChange={(e) => setNewActivity({ ...newActivity, due_date: e.target.value })}
          />
          <Select
            label="Priority"
            value={newActivity.priority}
            onChange={(e) => setNewActivity({ ...newActivity, priority: e.target.value })}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Description"
              value={newActivity.description}
              onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
              rows={4}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

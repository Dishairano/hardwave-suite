'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { HRLeaveRequest } from '@/lib/erp-types';

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

export default function LeaveManagementPage() {
  const { toastError, toastSuccess } = useToast();
  const [requests, setRequests] = useState<HRLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [employees, setEmployees] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  const [newRequest, setNewRequest] = useState({
    employee_id: '',
    leave_type_id: '',
    start_date: '',
    end_date: '',
    days_requested: '',
    reason: '',
  });

  const fetchRequests = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/hr/leave/requests?page=${page}&limit=20`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRequests(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch leave requests:', error);
    }

    setLoading(false);
  };

  const fetchLeaveTypes = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/hr/leave/types?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaveTypes(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch leave types:', error);
    }
  };

  const fetchEmployees = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/hr/employees?status=active&limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [page, statusFilter]);

  const calculateDays = () => {
    if (newRequest.start_date && newRequest.end_date) {
      const start = new Date(newRequest.start_date);
      const end = new Date(newRequest.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setNewRequest(prev => ({ ...prev, days_requested: days > 0 ? days.toString() : '' }));
    }
  };

  useEffect(() => {
    calculateDays();
  }, [newRequest.start_date, newRequest.end_date]);

  const handleCreateRequest = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/hr/leave/requests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newRequest,
          employee_id: parseInt(newRequest.employee_id),
          leave_type_id: parseInt(newRequest.leave_type_id),
          days_requested: parseFloat(newRequest.days_requested),
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewRequest({
          employee_id: '',
          leave_type_id: '',
          start_date: '',
          end_date: '',
          days_requested: '',
          reason: '',
        });
        fetchRequests();
        toastSuccess('Leave request submitted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to submit leave request');
      }
    } catch (error) {
      console.error('Create leave request error:', error);
      toastError('Failed to submit leave request');
    }

    setCreating(false);
  };

  const handleApprove = async (requestId: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/hr/leave/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        fetchRequests();
        toastSuccess('Leave request approved');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to approve request');
      }
    } catch (error) {
      console.error('Approve request error:', error);
    }
  };

  const handleReject = async (requestId: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/hr/leave/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'reject', rejection_reason: reason }),
      });
      if (res.ok) {
        fetchRequests();
        toastSuccess('Leave request rejected');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Reject request error:', error);
    }
  };

  const columns: Column<HRLeaveRequest>[] = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.employee_name || '-'}
          </div>
        </div>
      ),
    },
    {
      key: 'leave_type_name',
      header: 'Type',
      render: (value) => (
        <Badge variant="default">
          {value || '-'}
        </Badge>
      ),
    },
    {
      key: 'start_date',
      header: 'Period',
      render: (_, row) => (
        <div style={{ fontSize: 13 }}>
          <div style={{ color: tokens.colors.textPrimary }}>
            {new Date(row.start_date).toLocaleDateString()}
          </div>
          <div style={{ color: tokens.colors.textMuted }}>
            to {new Date(row.end_date).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'days_requested',
      header: 'Days',
      width: 80,
      align: 'center',
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{value}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (value) => (
        <span style={{ fontSize: 13, color: tokens.colors.textSecondary }}>
          {value && value.length > 40 ? value.substring(0, 40) + '...' : value || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (value) => {
        const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
          pending: 'warning',
          approved: 'success',
          rejected: 'error',
          cancelled: 'default',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'id',
      header: '',
      width: 140,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {row.status === 'pending' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleApprove(row.id)}
                style={{ color: tokens.colors.success }}
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReject(row.id)}
                style={{ color: tokens.colors.error }}
              >
                Reject
              </Button>
            </>
          )}
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
            Leave Management
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage employee leave requests
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Request Leave
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Requests Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={requests}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No leave requests found"
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

      {/* Create Leave Request Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Request Leave"
        description="Submit a new leave request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRequest}
              loading={creating}
              disabled={!newRequest.employee_id || !newRequest.leave_type_id || !newRequest.start_date || !newRequest.end_date}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Select
            label="Employee"
            required
            value={newRequest.employee_id}
            onChange={(e) => setNewRequest({ ...newRequest, employee_id: e.target.value })}
            options={[
              { value: '', label: 'Select employee...' },
              ...employees.map(e => ({
                value: e.id.toString(),
                label: `${e.first_name} ${e.last_name}`,
              })),
            ]}
          />

          <Select
            label="Leave Type"
            required
            value={newRequest.leave_type_id}
            onChange={(e) => setNewRequest({ ...newRequest, leave_type_id: e.target.value })}
            options={[
              { value: '', label: 'Select type...' },
              ...leaveTypes.map(t => ({ value: t.id.toString(), label: t.name })),
            ]}
          />

          <Input
            label="Start Date"
            type="date"
            required
            value={newRequest.start_date}
            onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })}
          />

          <Input
            label="End Date"
            type="date"
            required
            value={newRequest.end_date}
            onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })}
          />

          <Input
            label="Days Requested"
            type="number"
            value={newRequest.days_requested}
            onChange={(e) => setNewRequest({ ...newRequest, days_requested: e.target.value })}
            disabled
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Reason"
              value={newRequest.reason}
              onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
              placeholder="Reason for leave..."
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

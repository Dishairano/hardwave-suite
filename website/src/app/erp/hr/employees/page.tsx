'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Modal, Input, Select, DataTable, Badge, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { HREmployee, HRDepartment } from '@/lib/erp-types';

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

export default function EmployeesPage() {
  const router = useRouter();
  const { toastError, toastSuccess } = useToast();
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [departments, setDepartments] = useState<HRDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HREmployee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    hire_date: '',
    employment_type: 'full_time',
    salary: '',
  });

  const fetchEmployees = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/hr/employees?page=${page}&limit=20`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (deptFilter) url += `&department_id=${deptFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEmployees(data.items);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }

    setLoading(false);
  };

  const fetchDepartments = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/hr/departments?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [page, search, deptFilter, statusFilter]);

  const handleCreateEmployee = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/hr/employees', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newEmployee,
          department_id: newEmployee.department_id ? parseInt(newEmployee.department_id) : null,
          salary: newEmployee.salary ? parseFloat(newEmployee.salary) : null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewEmployee({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          department_id: '',
          hire_date: '',
          employment_type: 'full_time',
          salary: '',
        });
        fetchEmployees();
        toastSuccess('Employee created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create employee');
      }
    } catch (error) {
      console.error('Create employee error:', error);
      toastError('Failed to create employee');
    }

    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/hr/employees/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setDeleteTarget(null);
        fetchEmployees();
        toastSuccess('Employee deleted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete employee');
      }
    } catch (error) {
      console.error('Delete employee error:', error);
      toastError('Failed to delete employee');
    }

    setDeleting(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<HREmployee>[] = [
    {
      key: 'employee_number',
      header: 'ID',
      width: 100,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
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
      key: 'position_title',
      header: 'Position',
      render: (value) => <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>,
    },
    {
      key: 'department_name',
      header: 'Department',
      render: (value) => <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>,
    },
    {
      key: 'hire_date',
      header: 'Hire Date',
      width: 100,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'employment_type',
      header: 'Type',
      width: 100,
      render: (value) => {
        const labels: Record<string, string> = {
          full_time: 'Full-time',
          part_time: 'Part-time',
          contract: 'Contract',
          intern: 'Intern',
        };
        return <span style={{ color: tokens.colors.textSecondary }}>{labels[value] || value}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (value) => {
        const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
          active: 'success',
          on_leave: 'warning',
          terminated: 'error',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'id',
      header: 'Actions',
      width: 140,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/erp/hr/employees/${row.id}`)}
            title="View"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/erp/hr/employees/${row.id}`)}
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
            Employees
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage your workforce
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Add Employee
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
              placeholder="Name, email, employee #..."
            />
          </div>
          <div style={{ width: 180 }}>
            <Select
              label="Department"
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Departments' },
                ...departments.map(d => ({ value: d.id.toString(), label: d.name })),
              ]}
            />
          </div>
          <div style={{ width: 150 }}>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'active', label: 'Active' },
                { value: 'on_leave', label: 'On Leave' },
                { value: 'terminated', label: 'Terminated' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Employees Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={employees}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No employees found"
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

      {/* Create Employee Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Employee"
        description="Create a new employee record"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateEmployee}
              loading={creating}
              disabled={!newEmployee.first_name || !newEmployee.last_name || !newEmployee.hire_date}
            >
              Create Employee
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="First Name"
            required
            value={newEmployee.first_name}
            onChange={(e) => setNewEmployee({ ...newEmployee, first_name: e.target.value })}
          />
          <Input
            label="Last Name"
            required
            value={newEmployee.last_name}
            onChange={(e) => setNewEmployee({ ...newEmployee, last_name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={newEmployee.email}
            onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
          />
          <Input
            label="Phone"
            value={newEmployee.phone}
            onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
          />
          <Select
            label="Department"
            value={newEmployee.department_id}
            onChange={(e) => setNewEmployee({ ...newEmployee, department_id: e.target.value })}
            options={[
              { value: '', label: 'Select department...' },
              ...departments.map(d => ({ value: d.id.toString(), label: d.name })),
            ]}
          />
          <Input
            label="Hire Date"
            type="date"
            required
            value={newEmployee.hire_date}
            onChange={(e) => setNewEmployee({ ...newEmployee, hire_date: e.target.value })}
          />
          <Select
            label="Employment Type"
            value={newEmployee.employment_type}
            onChange={(e) => setNewEmployee({ ...newEmployee, employment_type: e.target.value })}
            options={[
              { value: 'full_time', label: 'Full-time' },
              { value: 'part_time', label: 'Part-time' },
              { value: 'contract', label: 'Contract' },
              { value: 'intern', label: 'Intern' },
            ]}
          />
          <Input
            label="Annual Salary"
            type="number"
            value={newEmployee.salary}
            onChange={(e) => setNewEmployee({ ...newEmployee, salary: e.target.value })}
            leftIcon={<span>$</span>}
          />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Employee"
        description={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}

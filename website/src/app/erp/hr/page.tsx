'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard, StatCardGrid, Card, Button, DataTable, Badge } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { HREmployee, HRLeaveRequest } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    brandBlue: '#3B82F6',
    brandGreen: '#00FF00',
    success: '#10B981',
    warning: '#F59E0B',
  },
};

export default function HRDashboardPage() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    departments: 0,
    pendingLeaveRequests: 0,
  });
  const [recentEmployees, setRecentEmployees] = useState<HREmployee[]>([]);
  const [pendingLeave, setPendingLeave] = useState<HRLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('token');

      try {
        // Fetch employees
        const employeesRes = await fetch('/api/erp/hr/employees?limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (employeesRes.ok) {
          const data = await employeesRes.json();
          setRecentEmployees(data.items);
          setStats(prev => ({ ...prev, totalEmployees: data.pagination.total }));
        }

        // Fetch active employees
        const activeRes = await fetch('/api/erp/hr/employees?status=active&limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (activeRes.ok) {
          const data = await activeRes.json();
          setStats(prev => ({ ...prev, activeEmployees: data.pagination.total }));
        }

        // Fetch departments
        const deptRes = await fetch('/api/erp/hr/departments?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (deptRes.ok) {
          const data = await deptRes.json();
          setStats(prev => ({ ...prev, departments: data.pagination.total }));
        }

        // Fetch pending leave requests
        const leaveRes = await fetch('/api/erp/hr/leave/requests?status=pending&limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (leaveRes.ok) {
          const data = await leaveRes.json();
          setPendingLeave(data.items);
          setStats(prev => ({ ...prev, pendingLeaveRequests: data.pagination.total }));
        }
      } catch (error) {
        console.error('Failed to fetch HR dashboard data:', error);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const employeeColumns: Column<HREmployee>[] = [
    {
      key: 'first_name',
      header: 'Employee',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.first_name} {row.last_name}
          </div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
            {row.employee_number}
          </div>
        </div>
      ),
    },
    {
      key: 'position_title',
      header: 'Position',
      render: (value) => <span style={{ color: tokens.colors.brandPink }}>{value || '-'}</span>,
    },
    {
      key: 'department_name',
      header: 'Department',
      render: (value) => <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>,
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
  ];

  const leaveColumns: Column<HRLeaveRequest>[] = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (_, row) => (
        <span style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
          {row.employee_name || '-'}
        </span>
      ),
    },
    {
      key: 'leave_type_name',
      header: 'Type',
      render: (value) => (
        <span style={{ color: tokens.colors.brandPink }}>{value || '-'}</span>
      ),
    },
    {
      key: 'days_requested',
      header: 'Days',
      width: 60,
      align: 'center',
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{value}</span>
      ),
    },
    {
      key: 'start_date',
      header: 'Period',
      render: (_, row) => (
        <span style={{ fontSize: 13, color: tokens.colors.textSecondary }}>
          {new Date(row.start_date).toLocaleDateString()} - {new Date(row.end_date).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            HR Dashboard
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage employees, departments, and leave
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/erp/hr/employees" style={{ textDecoration: 'none' }}>
            <Button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Add Employee
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 24 }}>
        <StatCardGrid>
          <StatCard
            title="Total Employees"
            value={loading ? '...' : stats.totalEmployees}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            color={tokens.colors.brandPink}
            loading={loading}
          />
          <StatCard
            title="Active Employees"
            value={loading ? '...' : stats.activeEmployees}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            color={tokens.colors.success}
            loading={loading}
          />
          <StatCard
            title="Departments"
            value={loading ? '...' : stats.departments}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="9" y1="6" x2="15" y2="6" />
                <line x1="9" y1="10" x2="15" y2="10" />
                <line x1="9" y1="14" x2="12" y2="14" />
              </svg>
            }
            color={tokens.colors.brandBlue}
            loading={loading}
          />
          <StatCard
            title="Pending Leave"
            value={loading ? '...' : stats.pendingLeaveRequests}
            subtitle="Awaiting approval"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
            color={tokens.colors.warning}
            loading={loading}
          />
        </StatCardGrid>
      </div>

      {/* Quick Access Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { href: '/erp/hr/employees', label: 'Employees', icon: 'users' },
          { href: '/erp/hr/departments', label: 'Departments', icon: 'building' },
          { href: '/erp/hr/leave', label: 'Leave Management', icon: 'calendar' },
          { href: '/erp/hr/payroll', label: 'Payroll', icon: 'dollar' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              backgroundColor: '#101018',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = tokens.colors.brandPink + '40';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: tokens.colors.brandPink + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.colors.brandPink,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {item.icon === 'users' && (
                  <>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </>
                )}
                {item.icon === 'building' && (
                  <>
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01" />
                  </>
                )}
                {item.icon === 'calendar' && (
                  <>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </>
                )}
                {item.icon === 'dollar' && (
                  <>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </>
                )}
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: tokens.colors.textPrimary }}>
              {item.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Tables Row */}
      <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent Employees */}
        <Card
          title="Recent Employees"
          actions={
            <Link href="/erp/hr/employees" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
          padding={false}
        >
          <DataTable
            columns={employeeColumns}
            data={recentEmployees}
            loading={loading}
            rowKey={(row) => row.id}
            emptyMessage="No employees yet"
          />
        </Card>

        {/* Pending Leave Requests */}
        <Card
          title="Pending Leave Requests"
          actions={
            <Link href="/erp/hr/leave" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
          padding={false}
        >
          <DataTable
            columns={leaveColumns}
            data={pendingLeave}
            loading={loading}
            rowKey={(row) => row.id}
            emptyMessage="No pending requests"
          />
        </Card>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard, StatCardGrid, Card, Button } from '@/components/erp';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { DashboardStats } from '@/lib/erp-types';

const tokens = {
  colors: {
    bgCard: '#101018',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    brandOrange: '#FFA500',
    brandGreen: '#00FF00',
    brandTurquoise: '#40E0D0',
    brandBlue: '#3B82F6',
    brandPurple: '#8B5CF6',
    brandPink: '#EC4899',
  },
  radius: { md: 8, lg: 12 },
};

// Module quick actions
const modules = [
  {
    id: 'finance',
    name: 'Finance',
    description: 'Manage accounts, expenses, and budgets',
    href: '/erp/finance',
    color: tokens.colors.brandGreen,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'projects',
    name: 'Projects',
    description: 'Track projects, tasks, and time',
    href: '/erp/projects',
    color: tokens.colors.brandBlue,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'hr',
    name: 'HR',
    description: 'Employees, leave, and payroll',
    href: '/erp/hr',
    color: tokens.colors.brandPurple,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Contacts, deals, and pipeline',
    href: '/erp/crm',
    color: tokens.colors.brandPink,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M20 7h-9M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </svg>
    ),
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Products, stock, and suppliers',
    href: '/erp/inventory',
    color: tokens.colors.brandOrange,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: 'invoicing',
    name: 'Invoicing',
    description: 'Create and manage invoices',
    href: '/erp/invoicing',
    color: tokens.colors.brandTurquoise,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
];

export default function ERPDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('token');

      try {
        const res = await fetch('/api/erp/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setRecentActivity(data.recentActivity || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 32 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
          ERP Dashboard
        </h1>
        <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '8px 0 0' }}>
          Welcome back! Here&apos;s an overview of your business.
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{ marginBottom: 32 }}>
        <StatCardGrid>
          <StatCard
            title="Revenue (MTD)"
            value={loading ? '...' : formatCurrency(stats?.finance?.totalRevenue || 0)}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            color={tokens.colors.brandGreen}
            trend={{ value: 12.5, label: 'vs last month', positive: true }}
            loading={loading}
          />
          <StatCard
            title="Active Projects"
            value={loading ? '...' : stats?.projects?.activeProjects || 0}
            subtitle={`${stats?.projects?.completedProjects || 0} completed`}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
            color={tokens.colors.brandBlue}
            loading={loading}
          />
          <StatCard
            title="Pipeline Value"
            value={loading ? '...' : formatCurrency(stats?.crm?.pipelineValue || 0)}
            subtitle={`${stats?.crm?.openDeals || 0} open deals`}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 7h-9M14 17H5" />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
              </svg>
            }
            color={tokens.colors.brandPink}
            loading={loading}
          />
          <StatCard
            title="Outstanding Invoices"
            value={loading ? '...' : formatCurrency(stats?.invoicing?.outstandingAmount || 0)}
            subtitle={`${stats?.invoicing?.overdueInvoices || 0} overdue`}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }
            color={tokens.colors.brandTurquoise}
            loading={loading}
          />
        </StatCardGrid>
      </div>

      {/* Module Quick Access */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>
          Modules
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {modules.map((module) => (
            <Link
              key={module.id}
              href={module.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 20,
                backgroundColor: tokens.colors.bgCard,
                borderRadius: tokens.radius.lg,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${module.color}40`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = tokens.colors.borderSubtle;
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: tokens.radius.md,
                  backgroundColor: `${module.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: module.color,
                }}
              >
                {module.icon}
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
                  {module.name}
                </h3>
                <p style={{ fontSize: 13, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
                  {module.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: isMobile ? 16 : 24 }}>
        {/* Recent Activity */}
        <Card title="Recent Activity" description="Latest actions across all modules">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 60,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: tokens.radius.md,
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: tokens.colors.textMuted }}>
              No recent activity to display.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderRadius: tokens.radius.md,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: tokens.colors.brandTurquoise + '20',
                      color: tokens.colors.brandTurquoise,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {activity.user?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: tokens.colors.textPrimary }}>
                      {activity.description}
                    </div>
                    <div style={{ fontSize: 12, color: tokens.colors.textFaint }}>
                      {activity.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </Card>

        {/* Quick Actions & Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/erp/invoicing/create" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Invoice
                </Button>
              </Link>
              <Link href="/erp/projects" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Project
                </Button>
              </Link>
              <Link href="/erp/crm/contacts" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add Contact
                </Button>
              </Link>
              <Link href="/erp/finance/expenses" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Submit Expense
                </Button>
              </Link>
            </div>
          </Card>

          {/* Alerts */}
          <Card title="Alerts">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats?.invoicing?.overdueInvoices ? (
                <div
                  style={{
                    padding: 12,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: tokens.radius.md,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span style={{ fontSize: 13, color: '#EF4444' }}>
                    {stats.invoicing.overdueInvoices} overdue invoice(s)
                  </span>
                </div>
              ) : null}
              {stats?.inventory?.lowStockItems ? (
                <div
                  style={{
                    padding: 12,
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: tokens.radius.md,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span style={{ fontSize: 13, color: '#F59E0B' }}>
                    {stats.inventory.lowStockItems} low stock item(s)
                  </span>
                </div>
              ) : null}
              {stats?.hr?.pendingLeaveRequests ? (
                <div
                  style={{
                    padding: 12,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: tokens.radius.md,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span style={{ fontSize: 13, color: '#3B82F6' }}>
                    {stats.hr.pendingLeaveRequests} pending leave request(s)
                  </span>
                </div>
              ) : null}
              {!stats?.invoicing?.overdueInvoices && !stats?.inventory?.lowStockItems && !stats?.hr?.pendingLeaveRequests && (
                <div style={{ padding: 16, textAlign: 'center', color: tokens.colors.textMuted, fontSize: 13 }}>
                  No alerts at this time.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

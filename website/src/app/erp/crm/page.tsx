'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard, StatCardGrid, Card, Button, DataTable, Badge } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { CRMContact, CRMDeal, CRMActivity } from '@/lib/erp-types';

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

export default function CRMDashboardPage() {
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalCompanies: 0,
    openDeals: 0,
    pipelineValue: 0,
    dealsWonThisMonth: 0,
    wonValueThisMonth: 0,
  });
  const [recentContacts, setRecentContacts] = useState<CRMContact[]>([]);
  const [recentDeals, setRecentDeals] = useState<CRMDeal[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<CRMActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = localStorage.getItem('token');

      try {
        // Fetch contacts
        const contactsRes = await fetch('/api/erp/crm/contacts?limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (contactsRes.ok) {
          const data = await contactsRes.json();
          setRecentContacts(data.items);
          setStats(prev => ({ ...prev, totalContacts: data.pagination.total }));
        }

        // Fetch deals
        const dealsRes = await fetch('/api/erp/crm/deals?limit=5', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dealsRes.ok) {
          const data = await dealsRes.json();
          setRecentDeals(data.items);
          setStats(prev => ({
            ...prev,
            openDeals: data.pagination.total,
            pipelineValue: data.summary.totalValue,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch CRM dashboard data:', error);
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
    }).format(amount);
  };

  const contactColumns: Column<CRMContact>[] = [
    {
      key: 'first_name',
      header: 'Name',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>
            {row.first_name} {row.last_name}
          </div>
          {row.job_title && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.job_title}</div>
          )}
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Company',
      render: (value) => <span style={{ color: tokens.colors.brandPink }}>{value || '-'}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (value) => <span style={{ fontSize: 13 }}>{value || '-'}</span>,
    },
    {
      key: 'lead_status',
      header: 'Status',
      width: 100,
      render: (value) => {
        const statusColors: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
          new: 'info',
          contacted: 'default',
          qualified: 'success',
          unqualified: 'warning',
          converted: 'success',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
  ];

  const dealColumns: Column<CRMDeal>[] = [
    {
      key: 'name',
      header: 'Deal',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, color: tokens.colors.textPrimary }}>{row.name}</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.deal_number}</div>
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Company',
      render: (value) => <span>{value || '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Value',
      align: 'right',
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.success }}>
          {formatCurrency(value || 0)}
        </span>
      ),
    },
    {
      key: 'stage_name',
      header: 'Stage',
      render: (value, row) => (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            backgroundColor: `${row.stage_color}20`,
            color: row.stage_color,
          }}
        >
          {value}
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
            CRM Dashboard
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage contacts, companies, and deals
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/erp/crm/contacts" style={{ textDecoration: 'none' }}>
            <Button variant="secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Add Contact
            </Button>
          </Link>
          <Link href="/erp/crm/deals" style={{ textDecoration: 'none' }}>
            <Button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Deal
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 24 }}>
        <StatCardGrid>
          <StatCard
            title="Total Contacts"
            value={loading ? '...' : stats.totalContacts}
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
            title="Open Deals"
            value={loading ? '...' : stats.openDeals}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 7h-9M14 17H5" />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
              </svg>
            }
            color={tokens.colors.brandBlue}
            loading={loading}
          />
          <StatCard
            title="Pipeline Value"
            value={loading ? '...' : formatCurrency(stats.pipelineValue)}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            color={tokens.colors.success}
            loading={loading}
          />
          <StatCard
            title="Won This Month"
            value={loading ? '...' : stats.dealsWonThisMonth}
            subtitle={`${formatCurrency(stats.wonValueThisMonth)} value`}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            color={tokens.colors.brandGreen}
            loading={loading}
          />
        </StatCardGrid>
      </div>

      {/* Quick Access Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { href: '/erp/crm/contacts', label: 'Contacts', icon: 'users' },
          { href: '/erp/crm/companies', label: 'Companies', icon: 'building' },
          { href: '/erp/crm/deals', label: 'Deal Pipeline', icon: 'pipeline' },
          { href: '/erp/crm/activities', label: 'Activities', icon: 'calendar' },
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
                    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01" />
                  </>
                )}
                {item.icon === 'pipeline' && (
                  <>
                    <path d="M20 7h-9M14 17H5" />
                    <circle cx="17" cy="17" r="3" />
                    <circle cx="7" cy="7" r="3" />
                  </>
                )}
                {item.icon === 'calendar' && (
                  <>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
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
        {/* Recent Contacts */}
        <Card
          title="Recent Contacts"
          actions={
            <Link href="/erp/crm/contacts" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
          padding={false}
        >
          <DataTable
            columns={contactColumns}
            data={recentContacts}
            loading={loading}
            rowKey={(row) => row.id}
            emptyMessage="No contacts yet"
          />
        </Card>

        {/* Recent Deals */}
        <Card
          title="Recent Deals"
          actions={
            <Link href="/erp/crm/deals" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
          padding={false}
        >
          <DataTable
            columns={dealColumns}
            data={recentDeals}
            loading={loading}
            rowKey={(row) => row.id}
            emptyMessage="No deals yet"
          />
        </Card>
      </div>
    </div>
  );
}

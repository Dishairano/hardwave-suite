'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, StatCard, StatCardGrid } from '@/components/erp';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    brandBlue: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
  },
};

interface SettingsStats {
  totalRoles: number;
  totalAssignments: number;
  totalUsers: number;
  recentActions: number;
}

export default function SettingsPage() {
  const [stats, setStats] = useState<SettingsStats>({
    totalRoles: 0,
    totalAssignments: 0,
    totalUsers: 0,
    recentActions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');

      try {
        // Fetch roles count
        const rolesRes = await fetch('/api/erp/settings/roles', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setStats(prev => ({ ...prev, totalRoles: data.roles.length }));
        }

        // Fetch user roles count
        const assignmentsRes = await fetch('/api/erp/settings/user-roles?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (assignmentsRes.ok) {
          const data = await assignmentsRes.json();
          setStats(prev => ({ ...prev, totalAssignments: data.pagination.total }));
        }

        // Fetch users count
        const usersRes = await fetch('/api/erp/settings/users?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (usersRes.ok) {
          const data = await usersRes.json();
          setStats(prev => ({ ...prev, totalUsers: data.pagination.total }));
        }

        // Fetch recent audit log count (last 24h)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const auditRes = await fetch(
          `/api/erp/settings/audit-log?limit=1&start_date=${yesterday.toISOString().split('T')[0]}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (auditRes.ok) {
          const data = await auditRes.json();
          setStats(prev => ({ ...prev, recentActions: data.pagination.total }));
        }
      } catch (error) {
        console.error('Failed to fetch settings stats:', error);
      }

      setLoading(false);
    };

    fetchStats();
  }, []);

  const settingsCards = [
    {
      href: '/erp/settings/users',
      title: 'Users',
      description: 'Manage user accounts and profiles',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: tokens.colors.warning,
    },
    {
      href: '/erp/settings/roles',
      title: 'Roles',
      description: 'Manage ERP roles and permissions',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      ),
      color: tokens.colors.brandPink,
    },
    {
      href: '/erp/settings/user-roles',
      title: 'User Permissions',
      description: 'Assign ERP roles to users',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: tokens.colors.brandBlue,
    },
    {
      href: '/erp/settings/audit-log',
      title: 'Audit Log',
      description: 'View all ERP activity history',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      color: tokens.colors.success,
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
          ERP Settings
        </h1>
        <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
          Manage roles, permissions, and system configuration
        </p>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: 32 }}>
        <StatCardGrid>
          <StatCard
            title="Roles"
            value={loading ? '...' : stats.totalRoles}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            color={tokens.colors.brandPink}
            loading={loading}
          />
          <StatCard
            title="Role Assignments"
            value={loading ? '...' : stats.totalAssignments}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
            }
            color={tokens.colors.brandBlue}
            loading={loading}
          />
          <StatCard
            title="Total Users"
            value={loading ? '...' : stats.totalUsers}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            color={tokens.colors.success}
            loading={loading}
          />
          <StatCard
            title="Actions (24h)"
            value={loading ? '...' : stats.recentActions}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
            color={tokens.colors.warning}
            loading={loading}
          />
        </StatCardGrid>
      </div>

      {/* Settings Cards */}
      <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {settingsCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{ textDecoration: 'none' }}
          >
            <Card padding={false}>
              <div
                style={{
                  padding: 24,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: `${card.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: card.color,
                    flexShrink: 0,
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
                    {card.title}
                  </h3>
                  <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
                    {card.description}
                  </p>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={tokens.colors.textMuted}
                  strokeWidth="2"
                  style={{ marginLeft: 'auto' }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

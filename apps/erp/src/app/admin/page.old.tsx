'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Design Tokens
const tokens = {
  colors: {
    bgPrimary: '#08080c',
    bgElevated: '#0c0c12',
    bgCard: '#101018',
    bgHover: '#16161e',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.1)',
    brandOrange: '#FFA500',
    brandGreen: '#00FF00',
    brandTurquoise: '#40E0D0',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

// Types
interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  recentSignups: number;
  monthlyRevenue: number;
}

interface User {
  id: number;
  email: string;
  displayName: string | null;
  isActive: boolean;
  isAdmin?: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  subscription: { status: string; periodEnd: string } | null;
  licenseKey: string | null;
}

interface Subscription {
  id: number;
  userId: number;
  userEmail: string;
  userName: string | null;
  status: string;
  planName: string;
  price: number;
  currency: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  licenseKey: string | null;
}

interface Invoice {
  id: number;
  userEmail: string;
  userName: string | null;
  invoiceNumber: string;
  status: string;
  amount: number;
  currency: string;
  pdfUrl: string | null;
  createdAt: string;
}

interface License {
  id: number;
  userId: number;
  userEmail: string;
  licenseKey: string;
  status: string;
  activations: number;
  maxActivations: number;
  createdAt: string;
}

interface Coupon {
  id: number;
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
}

interface AuditLog {
  id: number;
  adminEmail: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

interface AnalyticsData {
  userGrowth: { date: string; count: number }[];
  revenueData: { date: string; count: number; revenue: number }[];
  subscriptionStats: { status: string; count: number }[];
  mrrTrend: { month: string; mrr: number; active_subs: number }[];
  retention: { active_7d: number; active_30d: number; total: number };
  topPlans: { plan_name: string; count: number; total_revenue: number }[];
  dailyActiveUsers: { date: string; count: number }[];
}

// Simple Line Chart Component
const LineChart = ({ data, dataKey, color, height = 160, showArea = true }: {
  data: { date: string; [key: string]: any }[];
  dataKey: string;
  color: string;
  height?: number;
  showArea?: boolean;
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md }}>
        <p style={{ color: tokens.colors.textFaint, fontSize: 12 }}>No data available</p>
      </div>
    );
  }

  const values = data.map(d => d[dataKey] || 0);
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min;

  const width = 100;
  const chartHeight = 100;
  const padding = 5;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = chartHeight - padding - ((d[dataKey] || 0) - min) / (range || 1) * (chartHeight - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${chartHeight - padding} ${points} ${width - padding},${chartHeight - padding}`;

  return (
    <div style={{ height, position: 'relative', backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, padding: 12 }}>
      <svg viewBox={`0 0 ${width} ${chartHeight}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
        {showArea && (
          <polygon points={areaPoints} fill={`${color}15`} />
        )}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
          const y = chartHeight - padding - ((d[dataKey] || 0) - min) / (range || 1) * (chartHeight - padding * 2);
          return (
            <circle key={i} cx={x} cy={y} r="1.5" fill={color} />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', top: 8, right: 12, fontSize: 18, fontWeight: 700, color }}>
        {values[values.length - 1]}
      </div>
      <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 10, color: tokens.colors.textFaint }}>
        {data[0]?.date?.slice(5)}
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 10, color: tokens.colors.textFaint }}>
        {data[data.length - 1]?.date?.slice(5)}
      </div>
    </div>
  );
};

// Bar Chart Component
const BarChart = ({ data, labelKey, valueKey, color, height = 160 }: {
  data: { [key: string]: any }[];
  labelKey: string;
  valueKey: string;
  color: string;
  height?: number;
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md }}>
        <p style={{ color: tokens.colors.textFaint, fontSize: 12 }}>No data available</p>
      </div>
    );
  }

  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);

  return (
    <div style={{ height, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, padding: 12, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
      {data.map((d, i) => {
        const barHeight = ((d[valueKey] || 0) / max) * 100;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: tokens.colors.textMuted }}>{d[valueKey]}</span>
            <div
              style={{
                width: '100%',
                height: `${barHeight}%`,
                minHeight: 4,
                backgroundColor: color,
                borderRadius: 2,
                opacity: 0.8 + (i / data.length) * 0.2,
              }}
            />
            <span style={{ fontSize: 8, color: tokens.colors.textFaint, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
              {d[labelKey]?.slice(0, 8)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Donut Chart Component
const DonutChart = ({ data, colors, height = 160 }: {
  data: { label: string; value: number }[];
  colors: string[];
  height?: number;
}) => {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let currentAngle = -90;

  const segments = data.map((d, i) => {
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = ((startAngle + angle) * Math.PI) / 180;

    const x1 = 50 + 35 * Math.cos(startRad);
    const y1 = 50 + 35 * Math.sin(startRad);
    const x2 = 50 + 35 * Math.cos(endRad);
    const y2 = 50 + 35 * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    return {
      path: `M 50 50 L ${x1} ${y1} A 35 35 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colors[i % colors.length],
      label: d.label,
      value: d.value,
      percent: ((d.value / total) * 100).toFixed(0),
    };
  });

  return (
    <div style={{ height, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, padding: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 100 100" style={{ width: height - 24, height: height - 24, flexShrink: 0 }}>
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity={0.85} />
        ))}
        <circle cx="50" cy="50" r="20" fill={tokens.colors.bgElevated} />
        <text x="50" y="52" textAnchor="middle" fill={tokens.colors.textPrimary} fontSize="12" fontWeight="bold">{total}</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {segments.slice(0, 4).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
            <span style={{ fontSize: 11, color: tokens.colors.textMuted, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 11, color: tokens.colors.textPrimary, fontWeight: 500 }}>{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

type Tab = 'overview' | 'users' | 'subscriptions' | 'licenses' | 'invoices' | 'coupons' | 'analytics' | 'audit' | 'settings';

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '💳' },
  { id: 'licenses', label: 'Licenses', icon: '🔑' },
  { id: 'invoices', label: 'Invoices', icon: '📄' },
  { id: 'coupons', label: 'Coupons', icon: '🎟️' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'audit', label: 'Audit Log', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Data states
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7' | '30' | '90'>('30');

  // UI states
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Check for mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      router.push('/login');
      return;
    }

    const userData = JSON.parse(userStr);
    if (!userData.isAdmin) {
      router.push('/dashboard');
      return;
    }

    setUser(userData);
    loadAllData(token);
  }, [router]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const loadAllData = async (token: string) => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const responses = await Promise.all([
        fetch('/api/admin/stats', { headers }),
        fetch('/api/admin/users?limit=100', { headers }),
        fetch('/api/admin/subscriptions?limit=100', { headers }),
        fetch('/api/admin/invoices?limit=100', { headers }),
        fetch('/api/admin/licenses?limit=100', { headers }).catch(() => null),
        fetch('/api/admin/coupons', { headers }).catch(() => null),
        fetch('/api/admin/audit?limit=50', { headers }).catch(() => null),
        fetch(`/api/admin/analytics?period=${analyticsPeriod}`, { headers }).catch(() => null),
      ]);

      const [statsRes, usersRes, subsRes, invoicesRes, licensesRes, couponsRes, auditRes, analyticsRes] = responses;

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const subsData = await subsRes.json();
      const invoicesData = await invoicesRes.json();
      const licensesData = licensesRes ? await licensesRes.json().catch(() => ({ licenses: [] })) : { licenses: [] };
      const couponsData = couponsRes ? await couponsRes.json().catch(() => ({ coupons: [] })) : { coupons: [] };
      const auditData = auditRes ? await auditRes.json().catch(() => ({ logs: [] })) : { logs: [] };
      const analyticsData = analyticsRes ? await analyticsRes.json().catch(() => ({ analytics: null })) : { analytics: null };

      if (statsData.success) setStats(statsData.stats);
      if (usersData.success) setUsers(usersData.users);
      if (subsData.success) setSubscriptions(subsData.subscriptions);
      if (invoicesData.success) setInvoices(invoicesData.invoices);
      setLicenses(licensesData.licenses || []);
      setCoupons(couponsData.coupons || []);
      setAuditLogs(auditData.logs || []);
      if (analyticsData.success) setAnalytics(analyticsData.analytics);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // User actions
  const toggleUserStatus = async (userId: number, activate: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: activate }),
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, isActive: activate } : u));
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAdminStatus = async (userId: number, makeAdmin: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/admin`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isAdmin: makeAdmin }),
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, isAdmin: makeAdmin } : u));
      }
    } catch (error) {
      console.error('Failed to update admin status:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const generateLicense = async (userId: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/licenses/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`License generated: ${data.licenseKey}`);
        loadAllData(localStorage.getItem('token')!);
      }
    } catch (error) {
      console.error('Failed to generate license:', error);
    } finally {
      setActionLoading(false);
      setShowLicenseModal(false);
    }
  };

  const revokeLicense = async (licenseId: number) => {
    if (!confirm('Are you sure you want to revoke this license?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/licenses/${licenseId}/revoke`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setLicenses(licenses.map(l => l.id === licenseId ? { ...l, status: 'revoked' } : l));
      }
    } catch (error) {
      console.error('Failed to revoke license:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const cancelSubscription = async (subscriptionId: number) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        loadAllData(localStorage.getItem('token')!);
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const createCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const code = (form.elements.namedItem('code') as HTMLInputElement).value;
    const discountPercent = parseInt((form.elements.namedItem('discount') as HTMLInputElement).value);
    const maxUses = parseInt((form.elements.namedItem('maxUses') as HTMLInputElement).value);
    const expiresAt = (form.elements.namedItem('expires') as HTMLInputElement).value || null;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/coupons`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ code, discountPercent, maxUses, expiresAt }),
      });
      if (res.ok) {
        loadAllData(localStorage.getItem('token')!);
        setShowCouponModal(false);
      }
    } catch (error) {
      console.error('Failed to create coupon:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('en-EU', { style: 'currency', currency }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      active: { bg: `${tokens.colors.brandGreen}20`, text: tokens.colors.brandGreen },
      trialing: { bg: `${tokens.colors.brandTurquoise}20`, text: tokens.colors.brandTurquoise },
      past_due: { bg: `${tokens.colors.warning}20`, text: tokens.colors.warning },
      canceled: { bg: `${tokens.colors.danger}20`, text: tokens.colors.danger },
      revoked: { bg: `${tokens.colors.danger}20`, text: tokens.colors.danger },
      paid: { bg: `${tokens.colors.brandGreen}20`, text: tokens.colors.brandGreen },
      open: { bg: `${tokens.colors.warning}20`, text: tokens.colors.warning },
    };
    return colors[status] || { bg: 'rgba(255,255,255,0.1)', text: tokens.colors.textMuted };
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: tokens.colors.bgPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${tokens.colors.borderSubtle}`, borderTopColor: tokens.colors.brandGreen, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: tokens.colors.textSecondary }}>Loading admin suite...</p>
        </div>
        <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: tokens.colors.bgPrimary, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 40,
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: isMobile ? 280 : (sidebarOpen ? 220 : 64),
        backgroundColor: tokens.colors.bgElevated,
        borderRight: `1px solid ${tokens.colors.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s ease, width 0.2s ease',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 50,
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
      }}>
        {/* Logo */}
        <div style={{ padding: '16px 12px', borderBottom: `1px solid ${tokens.colors.borderSubtle}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              <div style={{ width: 5, height: 18, backgroundColor: tokens.colors.brandOrange, borderRadius: '2px 0 0 2px' }} />
              <div style={{ width: 5, height: 18, backgroundColor: tokens.colors.brandGreen }} />
              <div style={{ width: 5, height: 18, backgroundColor: tokens.colors.brandTurquoise, borderRadius: '0 2px 2px 0' }} />
            </div>
            {(sidebarOpen || isMobile) && <span style={{ fontSize: 13, fontWeight: 700, color: tokens.colors.textPrimary }}>HARDWAVE</span>}
          </Link>
          {(sidebarOpen || isMobile) && (
            <span style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 6px', backgroundColor: `${tokens.colors.brandOrange}20`, color: tokens.colors.brandOrange, borderRadius: 3, fontWeight: 600 }}>ADMIN</span>
          )}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                marginLeft: 'auto',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                color: tokens.colors.textMuted,
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Desktop Toggle */}
        {!isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              position: 'absolute', right: -12, top: 60, width: 24, height: 24, borderRadius: '50%',
              backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderDefault}`,
              color: tokens.colors.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
            }}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              style={{
                width: '100%',
                padding: (sidebarOpen || isMobile) ? '12px 12px' : '12px',
                marginBottom: 2,
                borderRadius: tokens.radius.md,
                border: 'none',
                backgroundColor: activeTab === item.id ? `${tokens.colors.brandGreen}15` : 'transparent',
                color: activeTab === item.id ? tokens.colors.brandGreen : tokens.colors.textMuted,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 14,
                justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center',
                minHeight: 44,
              }}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {(sidebarOpen || isMobile) && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: 12, borderTop: `1px solid ${tokens.colors.borderSubtle}` }}>
          {(sidebarOpen || isMobile) ? (
            <div>
              <p style={{ fontSize: 11, color: tokens.colors.textFaint, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
              <button onClick={handleLogout} style={{ fontSize: 12, color: tokens.colors.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', minHeight: 44 }}>Logout</button>
            </div>
          ) : (
            <button onClick={handleLogout} style={{ fontSize: 18, color: tokens.colors.textMuted, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, width: '100%' }} title="Logout">🚪</button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        marginLeft: isMobile ? 0 : (sidebarOpen ? 220 : 64),
        transition: 'margin-left 0.2s ease',
        minHeight: '100vh',
      }}>
        {/* Header */}
        <header style={{
          padding: isMobile ? '12px 16px' : '12px 20px',
          borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: tokens.colors.bgPrimary,
          position: 'sticky',
          top: 0,
          zIndex: 30,
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tokens.colors.bgCard,
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  borderRadius: tokens.radius.md,
                  color: tokens.colors.textPrimary,
                  fontSize: 18,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ☰
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{
                fontSize: isMobile ? 16 : 18,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {navItems.find(n => n.id === activeTab)?.icon} {navItems.find(n => n.id === activeTab)?.label}
              </h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {!isMobile && (
              <Link href="/dashboard" style={{ padding: '6px 12px', borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderDefault}`, color: tokens.colors.textSecondary, fontSize: 12, textDecoration: 'none' }}>Dashboard</Link>
            )}
            <button
              onClick={() => loadAllData(localStorage.getItem('token')!)}
              style={{
                padding: isMobile ? '8px' : '6px 12px',
                borderRadius: tokens.radius.default,
                border: `1px solid ${tokens.colors.borderDefault}`,
                backgroundColor: 'transparent',
                color: tokens.colors.textSecondary,
                fontSize: 12,
                cursor: 'pointer',
                minWidth: isMobile ? 40 : 'auto',
                minHeight: 40,
              }}
            >
              🔄{!isMobile && ' Refresh'}
            </button>
          </div>
        </header>

        <div style={{ padding: isMobile ? 16 : 20 }}>
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && stats && (
            <>
              {/* Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: isMobile ? 8 : 12,
                marginBottom: 24,
              }}>
                {[
                  { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: tokens.colors.brandTurquoise },
                  { label: 'Active Subs', value: stats.activeSubscriptions, icon: '💳', color: tokens.colors.brandGreen },
                  { label: 'Monthly Rev', value: formatCurrency(stats.monthlyRevenue), icon: '📈', color: tokens.colors.brandOrange },
                  { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: '💰', color: tokens.colors.brandTurquoise },
                  { label: 'New (30d)', value: stats.recentSignups, icon: '🆕', color: tokens.colors.brandGreen },
                ].map((stat) => (
                  <div key={stat.label} style={{
                    padding: isMobile ? 12 : 16,
                    backgroundColor: tokens.colors.bgCard,
                    border: `1px solid ${tokens.colors.borderSubtle}`,
                    borderRadius: tokens.radius.lg,
                  }}>
                    <div style={{ fontSize: isMobile ? 16 : 20, marginBottom: 6 }}>{stat.icon}</div>
                    <p style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, color: stat.color, marginBottom: 2 }}>{stat.value}</p>
                    <p style={{ fontSize: isMobile ? 10 : 11, color: tokens.colors.textFaint }}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 12 }}>Quick Actions</h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, max-content))',
                  gap: 8,
                }}>
                  <button onClick={() => handleTabChange('users')} style={{ padding: '12px 16px', borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textSecondary, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>👤 View Users</button>
                  <button onClick={() => { setShowLicenseModal(true); }} style={{ padding: '12px 16px', borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textSecondary, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>🔑 Gen License</button>
                  <button onClick={() => setShowCouponModal(true)} style={{ padding: '12px 16px', borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textSecondary, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>🎟️ Create Coupon</button>
                  <button onClick={() => handleTabChange('analytics')} style={{ padding: '12px 16px', borderRadius: tokens.radius.default, background: `linear-gradient(135deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen})`, color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', minHeight: 44 }}>📊 Analytics</button>
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 16,
              }}>
                {/* Recent Users */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen})` }} />
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>Recent Users</h3>
                      <button onClick={() => handleTabChange('users')} style={{ fontSize: 11, color: tokens.colors.brandTurquoise, background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>View all →</button>
                    </div>
                    {users.slice(0, 5).map((u) => (
                      <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 12, color: tokens.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                          <p style={{ fontSize: 10, color: tokens.colors.textFaint }}>{formatDateShort(u.createdAt)}</p>
                        </div>
                        {u.subscription && (
                          <span style={{ padding: '2px 6px', backgroundColor: getStatusColor(u.subscription.status).bg, color: getStatusColor(u.subscription.status).text, fontSize: 9, fontWeight: 600, borderRadius: 3, flexShrink: 0, marginLeft: 8 }}>{u.subscription.status}</span>
                        )}
                      </div>
                    ))}
                    {users.length === 0 && <p style={{ fontSize: 12, color: tokens.colors.textFaint, textAlign: 'center', padding: 16 }}>No users yet</p>}
                  </div>
                </div>

                {/* Recent Subscriptions */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${tokens.colors.brandGreen}, ${tokens.colors.brandTurquoise})` }} />
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>Recent Subs</h3>
                      <button onClick={() => handleTabChange('subscriptions')} style={{ fontSize: 11, color: tokens.colors.brandTurquoise, background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>View all →</button>
                    </div>
                    {subscriptions.slice(0, 5).map((sub) => (
                      <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 12, color: tokens.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.userEmail}</p>
                          <p style={{ fontSize: 10, color: tokens.colors.textFaint }}>{formatCurrency(sub.price, sub.currency)}/mo</p>
                        </div>
                        <span style={{ padding: '2px 6px', backgroundColor: getStatusColor(sub.status).bg, color: getStatusColor(sub.status).text, fontSize: 9, fontWeight: 600, borderRadius: 3, flexShrink: 0, marginLeft: 8 }}>{sub.status}</span>
                      </div>
                    ))}
                    {subscriptions.length === 0 && <p style={{ fontSize: 12, color: tokens.colors.textFaint, textAlign: 'center', padding: 16 }}>No subscriptions yet</p>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen}, ${tokens.colors.brandTurquoise})` }} />
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: 16, gap: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary }}>Users ({users.length})</h3>
                  <input type="text" placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: isMobile ? '100%' : 220, height: 40, padding: '0 12px', backgroundColor: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.borderDefault}`, borderRadius: tokens.radius.default, color: tokens.colors.textPrimary, fontSize: 14, boxSizing: 'border-box' }} />
                </div>

                {/* Mobile User Cards */}
                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredUsers.map((u) => (
                      <div key={u.id} style={{ padding: 12, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: tokens.colors.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.colors.textMuted, fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, color: tokens.colors.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                              {u.isAdmin && <span style={{ padding: '1px 5px', backgroundColor: `${tokens.colors.brandOrange}20`, color: tokens.colors.brandOrange, fontSize: 9, fontWeight: 600, borderRadius: 2 }}>ADMIN</span>}
                              <span style={{ padding: '2px 6px', backgroundColor: u.isActive ? `${tokens.colors.brandGreen}20` : `${tokens.colors.danger}20`, color: u.isActive ? tokens.colors.brandGreen : tokens.colors.danger, fontSize: 9, fontWeight: 600, borderRadius: 3 }}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                              {u.subscription && (
                                <span style={{ padding: '2px 6px', backgroundColor: getStatusColor(u.subscription.status).bg, color: getStatusColor(u.subscription.status).text, fontSize: 9, fontWeight: 600, borderRadius: 3 }}>{u.subscription.status}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button onClick={() => toggleUserStatus(u.id, !u.isActive)} disabled={actionLoading}
                            style={{ flex: 1, padding: '10px 12px', borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textMuted, fontSize: 11, cursor: 'pointer', minHeight: 40 }}>
                            {u.isActive ? '🚫 Deactivate' : '✅ Activate'}
                          </button>
                          <button onClick={() => toggleAdminStatus(u.id, !u.isAdmin)} disabled={actionLoading || u.id === user?.id}
                            style={{ flex: 1, padding: '10px 12px', borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textMuted, fontSize: 11, cursor: u.id === user?.id ? 'not-allowed' : 'pointer', opacity: u.id === user?.id ? 0.5 : 1, minHeight: 40 }}>
                            {u.isAdmin ? '👤 Remove Admin' : '👑 Make Admin'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No users found</p>}
                  </div>
                ) : (
                  /* Desktop Table */
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>User</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Status</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Subscription</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>License</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Joined</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: tokens.colors.bgElevated, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.colors.textMuted, fontSize: 12, fontWeight: 600 }}>
                                  {u.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p style={{ fontSize: 13, color: tokens.colors.textPrimary }}>{u.email}</p>
                                  {u.displayName && <p style={{ fontSize: 11, color: tokens.colors.textFaint }}>{u.displayName}</p>}
                                </div>
                                {u.isAdmin && <span style={{ padding: '1px 5px', backgroundColor: `${tokens.colors.brandOrange}20`, color: tokens.colors.brandOrange, fontSize: 9, fontWeight: 600, borderRadius: 2 }}>ADMIN</span>}
                              </div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 8px', backgroundColor: u.isActive ? `${tokens.colors.brandGreen}20` : `${tokens.colors.danger}20`, color: u.isActive ? tokens.colors.brandGreen : tokens.colors.danger, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {u.subscription ? (
                                <span style={{ padding: '3px 8px', backgroundColor: getStatusColor(u.subscription.status).bg, color: getStatusColor(u.subscription.status).text, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>{u.subscription.status}</span>
                              ) : (
                                <span style={{ fontSize: 12, color: tokens.colors.textFaint }}>None</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              {u.licenseKey ? (
                                <code style={{ fontSize: 10, color: tokens.colors.brandTurquoise, backgroundColor: tokens.colors.bgElevated, padding: '3px 6px', borderRadius: 3 }}>{u.licenseKey}</code>
                              ) : (
                                <span style={{ color: tokens.colors.textFaint }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textMuted }}>{formatDate(u.createdAt)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button onClick={() => toggleUserStatus(u.id, !u.isActive)} disabled={actionLoading}
                                  style={{ padding: '4px 8px', borderRadius: 3, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textMuted, fontSize: 10, cursor: 'pointer' }}
                                  title={u.isActive ? 'Deactivate' : 'Activate'}>{u.isActive ? '🚫' : '✅'}</button>
                                <button onClick={() => toggleAdminStatus(u.id, !u.isAdmin)} disabled={actionLoading || u.id === user?.id}
                                  style={{ padding: '4px 8px', borderRadius: 3, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textMuted, fontSize: 10, cursor: u.id === user?.id ? 'not-allowed' : 'pointer', opacity: u.id === user?.id ? 0.5 : 1 }}
                                  title={u.isAdmin ? 'Remove Admin' : 'Make Admin'}>{u.isAdmin ? '👤' : '👑'}</button>
                                {!u.licenseKey && (
                                  <button onClick={() => generateLicense(u.id)} disabled={actionLoading}
                                    style={{ padding: '4px 8px', borderRadius: 3, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textMuted, fontSize: 10, cursor: 'pointer' }}
                                    title="Generate License">🔑</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredUsers.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No users found</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBSCRIPTIONS TAB */}
          {activeTab === 'subscriptions' && (
            <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen}, ${tokens.colors.brandTurquoise})` }} />
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>Subscriptions ({subscriptions.length})</h3>

                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {subscriptions.map((sub) => (
                      <div key={sub.id} style={{ padding: 12, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: 13, color: tokens.colors.textPrimary, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.userEmail}</p>
                            <p style={{ fontSize: 11, color: tokens.colors.textFaint }}>{sub.planName} - {formatCurrency(sub.price, sub.currency)}/mo</p>
                          </div>
                          <span style={{ padding: '3px 8px', backgroundColor: getStatusColor(sub.status).bg, color: getStatusColor(sub.status).text, fontSize: 10, fontWeight: 600, borderRadius: 3, flexShrink: 0 }}>{sub.status}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: 11, color: tokens.colors.textMuted }}>Renews: {formatDateShort(sub.currentPeriodEnd)}</p>
                          {sub.status === 'active' && !sub.cancelAtPeriodEnd && (
                            <button onClick={() => cancelSubscription(sub.id)} disabled={actionLoading}
                              style={{ padding: '8px 12px', borderRadius: 3, border: `1px solid ${tokens.colors.danger}40`, backgroundColor: `${tokens.colors.danger}10`, color: tokens.colors.danger, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {subscriptions.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No subscriptions yet</p>}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Customer</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Plan</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Status</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Renews</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((sub) => (
                          <tr key={sub.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                            <td style={{ padding: '10px 12px' }}>
                              <p style={{ fontSize: 13, color: tokens.colors.textPrimary }}>{sub.userEmail}</p>
                              {sub.userName && <p style={{ fontSize: 11, color: tokens.colors.textFaint }}>{sub.userName}</p>}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <p style={{ fontSize: 13, color: tokens.colors.textPrimary }}>{sub.planName}</p>
                              <p style={{ fontSize: 11, color: tokens.colors.textFaint }}>{formatCurrency(sub.price, sub.currency)}/mo</p>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 8px', backgroundColor: getStatusColor(sub.status).bg, color: getStatusColor(sub.status).text, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>{sub.status}</span>
                              {sub.cancelAtPeriodEnd && <p style={{ fontSize: 10, color: tokens.colors.warning, marginTop: 2 }}>Cancels at period end</p>}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textMuted }}>{formatDate(sub.currentPeriodEnd)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              {sub.status === 'active' && !sub.cancelAtPeriodEnd && (
                                <button onClick={() => cancelSubscription(sub.id)} disabled={actionLoading}
                                  style={{ padding: '4px 10px', borderRadius: 3, border: `1px solid ${tokens.colors.danger}40`, backgroundColor: `${tokens.colors.danger}10`, color: tokens.colors.danger, fontSize: 10, cursor: 'pointer' }}>Cancel</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {subscriptions.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No subscriptions yet</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LICENSES TAB */}
          {activeTab === 'licenses' && (
            <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen}, ${tokens.colors.brandTurquoise})` }} />
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: 16, gap: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary }}>Licenses ({licenses.length})</h3>
                  <button onClick={() => setShowLicenseModal(true)}
                    style={{ padding: '10px 14px', borderRadius: tokens.radius.default, background: `linear-gradient(135deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen})`, color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', minHeight: 44 }}>+ Generate</button>
                </div>

                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {licenses.map((license) => (
                      <div key={license.id} style={{ padding: 12, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <div style={{ marginBottom: 8 }}>
                          <code style={{ fontSize: 11, color: tokens.colors.brandTurquoise, backgroundColor: tokens.colors.bgCard, padding: '4px 8px', borderRadius: 3, display: 'inline-block' }}>{license.licenseKey}</code>
                        </div>
                        <p style={{ fontSize: 12, color: tokens.colors.textPrimary, marginBottom: 4 }}>{license.userEmail}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ padding: '3px 8px', backgroundColor: getStatusColor(license.status).bg, color: getStatusColor(license.status).text, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>{license.status}</span>
                            <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>{license.activations}/{license.maxActivations}</span>
                          </div>
                          {license.status === 'active' && (
                            <button onClick={() => revokeLicense(license.id)} disabled={actionLoading}
                              style={{ padding: '8px 12px', borderRadius: 3, border: `1px solid ${tokens.colors.danger}40`, backgroundColor: `${tokens.colors.danger}10`, color: tokens.colors.danger, fontSize: 11, cursor: 'pointer' }}>Revoke</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {licenses.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No licenses yet</p>}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>License Key</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>User</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Status</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Activations</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Created</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {licenses.map((license) => (
                          <tr key={license.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                            <td style={{ padding: '10px 12px' }}>
                              <code style={{ fontSize: 11, color: tokens.colors.brandTurquoise, backgroundColor: tokens.colors.bgElevated, padding: '3px 6px', borderRadius: 3 }}>{license.licenseKey}</code>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textPrimary }}>{license.userEmail}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 8px', backgroundColor: getStatusColor(license.status).bg, color: getStatusColor(license.status).text, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>{license.status}</span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textMuted }}>{license.activations}/{license.maxActivations}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textMuted }}>{formatDate(license.createdAt)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              {license.status === 'active' && (
                                <button onClick={() => revokeLicense(license.id)} disabled={actionLoading}
                                  style={{ padding: '4px 10px', borderRadius: 3, border: `1px solid ${tokens.colors.danger}40`, backgroundColor: `${tokens.colors.danger}10`, color: tokens.colors.danger, fontSize: 10, cursor: 'pointer' }}>Revoke</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {licenses.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No licenses yet</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen}, ${tokens.colors.brandTurquoise})` }} />
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>Invoices ({invoices.length})</h3>

                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {invoices.map((inv) => (
                      <div key={inv.id} style={{ padding: 12, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <p style={{ fontSize: 13, color: tokens.colors.textPrimary, fontWeight: 600 }}>{formatCurrency(inv.amount, inv.currency)}</p>
                            <p style={{ fontSize: 11, color: tokens.colors.textFaint }}>{inv.invoiceNumber || `#${inv.id}`}</p>
                          </div>
                          <span style={{ padding: '3px 8px', backgroundColor: getStatusColor(inv.status).bg, color: getStatusColor(inv.status).text, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>{inv.status}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: 12, color: tokens.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{inv.userEmail}</p>
                          {inv.pdfUrl && (
                            <button onClick={() => window.open(inv.pdfUrl!, '_blank')}
                              style={{ padding: '8px 12px', borderRadius: 3, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textSecondary, fontSize: 11, cursor: 'pointer', marginLeft: 8 }}>PDF</button>
                          )}
                        </div>
                      </div>
                    ))}
                    {invoices.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No invoices yet</p>}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Invoice</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Customer</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Amount</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Status</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Date</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                            <td style={{ padding: '10px 12px', fontSize: 13, color: tokens.colors.textPrimary }}>{inv.invoiceNumber || `#${inv.id}`}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textPrimary }}>{inv.userEmail}</td>
                            <td style={{ padding: '10px 12px', fontSize: 13, color: tokens.colors.textPrimary, fontWeight: 500 }}>{formatCurrency(inv.amount, inv.currency)}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 8px', backgroundColor: getStatusColor(inv.status).bg, color: getStatusColor(inv.status).text, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>{inv.status}</span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textMuted }}>{formatDate(inv.createdAt)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              {inv.pdfUrl && (
                                <button onClick={() => window.open(inv.pdfUrl!, '_blank')}
                                  style={{ padding: '4px 10px', borderRadius: 3, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textSecondary, fontSize: 10, cursor: 'pointer' }}>PDF</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {invoices.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No invoices yet</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COUPONS TAB */}
          {activeTab === 'coupons' && (
            <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen}, ${tokens.colors.brandTurquoise})` }} />
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: 16, gap: 12 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary }}>Coupons ({coupons.length})</h3>
                  <button onClick={() => setShowCouponModal(true)}
                    style={{ padding: '10px 14px', borderRadius: tokens.radius.default, background: `linear-gradient(135deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen})`, color: '#000', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', minHeight: 44 }}>+ Create</button>
                </div>

                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {coupons.map((coupon) => (
                      <div key={coupon.id} style={{ padding: 12, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <code style={{ fontSize: 13, color: tokens.colors.brandOrange, backgroundColor: tokens.colors.bgCard, padding: '4px 8px', borderRadius: 3 }}>{coupon.code}</code>
                          <span style={{ fontSize: 14, color: tokens.colors.brandGreen, fontWeight: 600 }}>{coupon.discountPercent}% OFF</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>Used: {coupon.usedCount}/{coupon.maxUses}</span>
                          <span style={{ padding: '3px 8px', backgroundColor: coupon.isActive ? `${tokens.colors.brandGreen}20` : `${tokens.colors.danger}20`, color: coupon.isActive ? tokens.colors.brandGreen : tokens.colors.danger, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>
                            {coupon.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {coupons.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No coupons yet</p>}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Code</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Discount</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Usage</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Expires</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coupons.map((coupon) => (
                          <tr key={coupon.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                            <td style={{ padding: '10px 12px' }}>
                              <code style={{ fontSize: 12, color: tokens.colors.brandOrange, backgroundColor: tokens.colors.bgElevated, padding: '3px 6px', borderRadius: 3 }}>{coupon.code}</code>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: 13, color: tokens.colors.brandGreen, fontWeight: 600 }}>{coupon.discountPercent}% OFF</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textMuted }}>{coupon.usedCount}/{coupon.maxUses}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textMuted }}>{coupon.expiresAt ? formatDate(coupon.expiresAt) : 'Never'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 8px', backgroundColor: coupon.isActive ? `${tokens.colors.brandGreen}20` : `${tokens.colors.danger}20`, color: coupon.isActive ? tokens.colors.brandGreen : tokens.colors.danger, fontSize: 10, fontWeight: 600, borderRadius: 3 }}>
                                {coupon.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {coupons.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No coupons yet</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <div>
              {/* Period Selector */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary }}>Analytics Dashboard</h2>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['7', '30', '90'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => {
                        setAnalyticsPeriod(period);
                        const token = localStorage.getItem('token');
                        if (token) {
                          fetch(`/api/admin/analytics?period=${period}`, { headers: { 'Authorization': `Bearer ${token}` } })
                            .then(res => res.json())
                            .then(data => { if (data.success) setAnalytics(data.analytics); });
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: tokens.radius.default,
                        border: `1px solid ${analyticsPeriod === period ? tokens.colors.brandGreen : tokens.colors.borderDefault}`,
                        backgroundColor: analyticsPeriod === period ? `${tokens.colors.brandGreen}15` : 'transparent',
                        color: analyticsPeriod === period ? tokens.colors.brandGreen : tokens.colors.textMuted,
                        fontSize: 12,
                        cursor: 'pointer',
                        minHeight: 36,
                      }}
                    >
                      {period}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
                {/* User Growth Chart */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>User Signups</h3>
                    <span style={{ fontSize: 11, color: tokens.colors.textFaint }}>Last {analyticsPeriod} days</span>
                  </div>
                  <LineChart
                    data={analytics?.userGrowth || []}
                    dataKey="count"
                    color={tokens.colors.brandTurquoise}
                    height={160}
                  />
                </div>

                {/* Revenue Chart */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>Revenue</h3>
                    <span style={{ fontSize: 11, color: tokens.colors.textFaint }}>Last {analyticsPeriod} days</span>
                  </div>
                  <LineChart
                    data={analytics?.revenueData || []}
                    dataKey="revenue"
                    color={tokens.colors.brandGreen}
                    height={160}
                  />
                </div>
              </div>

              {/* Secondary Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                {/* Daily Active Users */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 12 }}>Daily Active Users</h3>
                  <LineChart
                    data={analytics?.dailyActiveUsers || []}
                    dataKey="count"
                    color={tokens.colors.brandOrange}
                    height={140}
                    showArea={false}
                  />
                </div>

                {/* Subscription Status */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 12 }}>Subscription Status</h3>
                  <DonutChart
                    data={(analytics?.subscriptionStats || []).map(s => ({ label: s.status, value: parseInt(String(s.count)) }))}
                    colors={[tokens.colors.brandGreen, tokens.colors.brandTurquoise, tokens.colors.warning, tokens.colors.danger, tokens.colors.textMuted]}
                    height={140}
                  />
                </div>

                {/* User Retention */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 12 }}>User Retention</h3>
                  <div style={{ height: 140, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>7-day active</span>
                        <span style={{ fontSize: 11, color: tokens.colors.brandGreen, fontWeight: 600 }}>
                          {analytics?.retention?.total ? ((analytics.retention.active_7d / analytics.retention.total) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                      <div style={{ height: 6, backgroundColor: tokens.colors.bgCard, borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${analytics?.retention?.total ? (analytics.retention.active_7d / analytics.retention.total) * 100 : 0}%`, backgroundColor: tokens.colors.brandGreen, borderRadius: 3 }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>30-day active</span>
                        <span style={{ fontSize: 11, color: tokens.colors.brandTurquoise, fontWeight: 600 }}>
                          {analytics?.retention?.total ? ((analytics.retention.active_30d / analytics.retention.total) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                      <div style={{ height: 6, backgroundColor: tokens.colors.bgCard, borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${analytics?.retention?.total ? (analytics.retention.active_30d / analytics.retention.total) * 100 : 0}%`, backgroundColor: tokens.colors.brandTurquoise, borderRadius: 3 }} />
                      </div>
                    </div>
                    <p style={{ fontSize: 10, color: tokens.colors.textFaint, textAlign: 'center' }}>
                      {analytics?.retention?.active_30d || 0} of {analytics?.retention?.total || 0} users
                    </p>
                  </div>
                </div>
              </div>

              {/* MRR Trend & Key Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 16 }}>
                {/* MRR Trend */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 12 }}>MRR Trend (12 months)</h3>
                  <BarChart
                    data={(analytics?.mrrTrend || []).slice(-12)}
                    labelKey="month"
                    valueKey="mrr"
                    color={tokens.colors.brandGreen}
                    height={180}
                  />
                </div>

                {/* Key Metrics */}
                <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>Key Metrics</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'MRR', value: formatCurrency(stats?.monthlyRevenue || 0), color: tokens.colors.brandGreen },
                      { label: 'ARR', value: formatCurrency((stats?.monthlyRevenue || 0) * 12), color: tokens.colors.brandTurquoise },
                      { label: 'ARPU', value: formatCurrency(stats?.activeSubscriptions ? (stats.monthlyRevenue / stats.activeSubscriptions) : 0), color: tokens.colors.brandOrange },
                      { label: 'LTV (est.)', value: formatCurrency(stats?.activeSubscriptions ? (stats.monthlyRevenue / stats.activeSubscriptions) * 12 : 0), color: tokens.colors.textPrimary },
                      { label: 'Churn', value: '0%', color: tokens.colors.danger },
                      { label: 'Growth', value: `+${stats?.recentSignups || 0}`, color: tokens.colors.brandGreen },
                    ].map((metric) => (
                      <div key={metric.label} style={{ padding: 12, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md }}>
                        <p style={{ fontSize: 10, color: tokens.colors.textFaint, marginBottom: 2 }}>{metric.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: metric.color }}>{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AUDIT LOG TAB */}
          {activeTab === 'audit' && (
            <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen}, ${tokens.colors.brandTurquoise})` }} />
              <div style={{ padding: isMobile ? 12 : 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>Audit Log</h3>

                {isMobile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {auditLogs.map((log) => (
                      <div key={log.id} style={{ padding: 12, backgroundColor: tokens.colors.bgElevated, borderRadius: tokens.radius.md, border: `1px solid ${tokens.colors.borderSubtle}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: tokens.colors.brandTurquoise, fontWeight: 500 }}>{log.action}</span>
                          <span style={{ fontSize: 10, color: tokens.colors.textFaint }}>{formatDateShort(log.createdAt)}</span>
                        </div>
                        <p style={{ fontSize: 11, color: tokens.colors.textPrimary, marginBottom: 4 }}>{log.adminEmail}</p>
                        <p style={{ fontSize: 10, color: tokens.colors.textFaint, wordBreak: 'break-word' }}>{log.details}</p>
                      </div>
                    ))}
                    {auditLogs.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No audit logs yet</p>}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Time</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Admin</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Action</th>
                          <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 500, color: tokens.colors.textFaint }}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log) => (
                          <tr key={log.id} style={{ borderBottom: `1px solid ${tokens.colors.borderSubtle}` }}>
                            <td style={{ padding: '10px 12px', fontSize: 11, color: tokens.colors.textMuted }}>{formatDate(log.createdAt)}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.textPrimary }}>{log.adminEmail}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: tokens.colors.brandTurquoise }}>{log.action}</td>
                            <td style={{ padding: '10px 12px', fontSize: 11, color: tokens.colors.textFaint }}>{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {auditLogs.length === 0 && <p style={{ fontSize: 13, color: tokens.colors.textFaint, textAlign: 'center', padding: 24 }}>No audit logs yet</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>General Settings</h3>
                <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 6 }}>Site Name</label>
                    <input type="text" defaultValue="Hardwave Studios" style={{ width: '100%', height: 44, padding: '0 12px', backgroundColor: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.borderDefault}`, borderRadius: tokens.radius.default, color: tokens.colors.textPrimary, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 6 }}>Support Email</label>
                    <input type="email" defaultValue="support@hardwavestudios.com" style={{ width: '100%', height: 44, padding: '0 12px', backgroundColor: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.borderDefault}`, borderRadius: tokens.radius.default, color: tokens.colors.textPrimary, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
              <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.borderSubtle}`, borderRadius: tokens.radius.lg, padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>Stripe Configuration</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button style={{ padding: '10px 16px', borderRadius: tokens.radius.default, backgroundColor: `${tokens.colors.warning}20`, border: `1px solid ${tokens.colors.warning}`, color: tokens.colors.warning, fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 44 }}>Test Mode</button>
                  <button style={{ padding: '10px 16px', borderRadius: tokens.radius.default, backgroundColor: 'transparent', border: `1px solid ${tokens.colors.borderDefault}`, color: tokens.colors.textMuted, fontSize: 12, cursor: 'pointer', minHeight: 44 }}>Live Mode</button>
                </div>
                <p style={{ fontSize: 11, color: tokens.colors.textFaint }}>Configure Stripe keys in .env.local</p>
              </div>
              <div style={{ backgroundColor: tokens.colors.bgCard, border: `1px solid ${tokens.colors.danger}30`, borderRadius: tokens.radius.lg, padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.danger, marginBottom: 6 }}>Danger Zone</h3>
                <p style={{ fontSize: 11, color: tokens.colors.textMuted, marginBottom: 12 }}>Irreversible actions</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={{ padding: '10px 12px', borderRadius: tokens.radius.default, backgroundColor: `${tokens.colors.danger}10`, border: `1px solid ${tokens.colors.danger}40`, color: tokens.colors.danger, fontSize: 11, cursor: 'pointer', minHeight: 44 }}>Clear Logs</button>
                  <button style={{ padding: '10px 12px', borderRadius: tokens.radius.default, backgroundColor: `${tokens.colors.danger}10`, border: `1px solid ${tokens.colors.danger}40`, color: tokens.colors.danger, fontSize: 11, cursor: 'pointer', minHeight: 44 }}>Reset Stats</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* COUPON MODAL */}
      {showCouponModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ backgroundColor: tokens.colors.bgCard, borderRadius: tokens.radius.lg, padding: isMobile ? 16 : 20, width: '100%', maxWidth: 360, border: `1px solid ${tokens.colors.borderSubtle}`, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>Create Coupon</h3>
            <form onSubmit={createCoupon}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 6 }}>Coupon Code</label>
                <input name="code" type="text" required placeholder="LAUNCH50" style={{ width: '100%', height: 44, padding: '0 12px', backgroundColor: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.borderDefault}`, borderRadius: tokens.radius.default, color: tokens.colors.textPrimary, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 6 }}>Discount %</label>
                <input name="discount" type="number" required min="1" max="100" placeholder="50" style={{ width: '100%', height: 44, padding: '0 12px', backgroundColor: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.borderDefault}`, borderRadius: tokens.radius.default, color: tokens.colors.textPrimary, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 6 }}>Max Uses</label>
                <input name="maxUses" type="number" required min="1" defaultValue="100" style={{ width: '100%', height: 44, padding: '0 12px', backgroundColor: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.borderDefault}`, borderRadius: tokens.radius.default, color: tokens.colors.textPrimary, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 6 }}>Expires (optional)</label>
                <input name="expires" type="date" style={{ width: '100%', height: 44, padding: '0 12px', backgroundColor: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.borderDefault}`, borderRadius: tokens.radius.default, color: tokens.colors.textPrimary, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setShowCouponModal(false)} style={{ flex: 1, padding: '12px', borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textSecondary, fontSize: 13, cursor: 'pointer', minHeight: 44 }}>Cancel</button>
                <button type="submit" disabled={actionLoading} style={{ flex: 1, padding: '12px', borderRadius: tokens.radius.default, background: `linear-gradient(135deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen})`, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', minHeight: 44 }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LICENSE MODAL */}
      {showLicenseModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ backgroundColor: tokens.colors.bgCard, borderRadius: tokens.radius.lg, padding: isMobile ? 16 : 20, width: '100%', maxWidth: 360, border: `1px solid ${tokens.colors.borderSubtle}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>Generate License</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: tokens.colors.textSecondary, marginBottom: 6 }}>Select User</label>
              <select
                value={selectedUserId || ''}
                onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: '100%', height: 44, padding: '0 12px', backgroundColor: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.borderDefault}`, borderRadius: tokens.radius.default, color: tokens.colors.textPrimary, fontSize: 14 }}
              >
                <option value="">Select a user...</option>
                {users.filter(u => !u.licenseKey).map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setShowLicenseModal(false); setSelectedUserId(null); }} style={{ flex: 1, padding: '12px', borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderDefault}`, backgroundColor: 'transparent', color: tokens.colors.textSecondary, fontSize: 13, cursor: 'pointer', minHeight: 44 }}>Cancel</button>
              <button onClick={() => selectedUserId && generateLicense(selectedUserId)} disabled={actionLoading || !selectedUserId} style={{ flex: 1, padding: '12px', borderRadius: tokens.radius.default, background: `linear-gradient(135deg, ${tokens.colors.brandOrange}, ${tokens.colors.brandGreen})`, color: '#000', fontSize: 13, fontWeight: 600, cursor: selectedUserId ? 'pointer' : 'not-allowed', border: 'none', opacity: selectedUserId ? 1 : 0.5, minHeight: 44 }}>Generate</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

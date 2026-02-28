'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

// Design Tokens (matching main site)
const tokens = {
  colors: {
    bgPrimary: '#08080c',
    bgElevated: '#0c0c12',
    bgCard: '#101018',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.1)',
    brandOrange: '#FFA500',
    brandGreen: '#00FF00',
    brandTurquoise: '#40E0D0',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

interface DashboardNavProps {
  user: {
    email: string;
    display_name?: string;
    isAdmin?: boolean;
  } | null;
}

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const navItems = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/subscription', label: 'Subscription' },
    { href: '/dashboard/downloads', label: 'Downloads' },
    { href: '/dashboard/invoices', label: 'Invoices' },
  ];

  // Add ERP link for admin users (ERP access is checked in the ERP layout)
  if (user?.isAdmin) {
    navItems.push({ href: '/erp', label: 'ERP' });
    navItems.push({ href: '/admin', label: 'Admin' });
  }

  return (
    <nav
      style={{
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        backgroundColor: `${tokens.colors.bgPrimary}ee`,
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 64 }}>
          {/* Logo and nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ width: 6, height: 24, backgroundColor: tokens.colors.brandOrange, borderRadius: '3px 0 0 3px' }} />
                <div style={{ width: 6, height: 24, backgroundColor: tokens.colors.brandGreen }} />
                <div style={{ width: 6, height: 24, backgroundColor: tokens.colors.brandTurquoise, borderRadius: '0 3px 3px 0' }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: tokens.colors.textPrimary, letterSpacing: '-0.01em' }}>HARDWAVE</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex" style={{ display: 'none', gap: 4 }}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: '8px 14px',
                    borderRadius: tokens.radius.default,
                    fontSize: 14,
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                    backgroundColor: pathname === item.href ? `${tokens.colors.brandGreen}15` : 'transparent',
                    color: pathname === item.href ? tokens.colors.brandGreen : tokens.colors.textMuted,
                    border: pathname === item.href ? `1px solid ${tokens.colors.brandGreen}30` : '1px solid transparent',
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* User info and logout - desktop */}
          <div className="hidden md:flex" style={{ display: 'none', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: tokens.colors.textFaint }}>{user?.email}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                borderRadius: tokens.radius.default,
                backgroundColor: 'transparent',
                border: `1px solid ${tokens.colors.borderDefault}`,
                color: tokens.colors.textSecondary,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = tokens.colors.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = tokens.colors.textSecondary;
              }}
            >
              Logout
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              padding: 8,
              color: tokens.colors.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Desktop nav - visible on md+ */}
        <style jsx global>{`
          @media (min-width: 768px) {
            .hidden.md\\:flex { display: flex !important; }
            .md\\:hidden { display: none !important; }
          }
        `}</style>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div
            className="md:hidden"
            style={{
              padding: '16px 0',
              borderTop: `1px solid ${tokens.colors.borderSubtle}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: tokens.radius.default,
                    fontSize: 14,
                    textDecoration: 'none',
                    backgroundColor: pathname === item.href ? `${tokens.colors.brandGreen}15` : 'transparent',
                    color: pathname === item.href ? tokens.colors.brandGreen : tokens.colors.textSecondary,
                  }}
                >
                  {item.label}
                </Link>
              ))}
              <div style={{ padding: '12px 14px', borderTop: `1px solid ${tokens.colors.borderSubtle}`, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: tokens.colors.textFaint }}>{user?.email}</span>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  padding: '12px 14px',
                  borderRadius: tokens.radius.default,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: tokens.colors.textSecondary,
                  fontSize: 14,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

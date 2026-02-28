'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ERPSidebar } from '@/components/erp/ERPSidebar';
import { ERPHeader } from '@/components/erp/ERPHeader';
import { ToastProvider } from '@/components/erp/Toast';
import { ResponsiveStyles } from '@/components/erp/ResponsiveStyles';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ERPModule, ERPPermission } from '@/lib/erp-types';

const tokens = {
  colors: {
    bgPrimary: '#08080c',
    textMuted: '#71717a',
  },
};

interface User {
  id: number;
  email: string;
  display_name?: string;
  isAdmin?: boolean;
}

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Record<ERPModule, ERPPermission[]>>({
    finance: [],
    projects: [],
    hr: [],
    crm: [],
    inventory: [],
    invoicing: [],
    settings: [],
  });
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        router.push('/login?redirect=/erp');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      try {
        // Fetch user identity and ERP permissions from server in parallel
        const [meRes, permRes] = await Promise.all([
          fetch('/api/auth/me', { headers }),
          fetch('/api/erp/auth/permissions', { headers }),
        ]);

        // If either returns 401, token is invalid/expired
        if (meRes.status === 401 || permRes.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/login?redirect=/erp');
          return;
        }

        if (!meRes.ok || !permRes.ok) {
          router.push('/dashboard');
          return;
        }

        const meData = await meRes.json();
        const permData = await permRes.json();

        // Server determines access - no localStorage trust
        if (!permData.hasERPAccess && !permData.isAdmin) {
          router.push('/dashboard');
          return;
        }

        setUser({
          id: meData.id,
          email: meData.email,
          display_name: meData.displayName,
          isAdmin: permData.isAdmin,
        });
        setPermissions(permData.permissions);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login?redirect=/erp');
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: tokens.colors.bgPrimary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: '#40E0D0',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ color: tokens.colors.textMuted, fontSize: 14 }}>Loading ERP...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ResponsiveStyles />
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: tokens.colors.bgPrimary,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <ERPHeader
          user={user}
          isMobile={isMobile}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* Sidebar - desktop: normal flow, mobile: overlay drawer */}
          {isMobile ? (
            <>
              {/* Backdrop */}
              {mobileMenuOpen && (
                <div
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    zIndex: 60,
                  }}
                />
              )}
              {/* Drawer */}
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: 280,
                  zIndex: 70,
                  transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
                  transition: 'transform 0.25s ease',
                }}
              >
                <ERPSidebar
                  permissions={permissions}
                  collapsed={false}
                  onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                  isMobile={true}
                  onClose={() => setMobileMenuOpen(false)}
                />
              </div>
            </>
          ) : (
            <ERPSidebar
              permissions={permissions}
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          )}

          {/* Page Content */}
          <main
            style={{
              flex: 1,
              padding: isMobile ? 16 : 24,
              overflowY: 'auto',
              minHeight: 'calc(100vh - 64px)',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

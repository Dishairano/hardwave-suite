'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { ERPModule, ERPPermission } from '@/lib/erp-types';

// Design tokens matching site style
const tokens = {
  colors: {
    bgPrimary: '#08080c',
    bgElevated: '#0c0c12',
    bgCard: '#101018',
    bgHover: '#14141c',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.1)',
    brandOrange: '#FFA500',
    brandGreen: '#00FF00',
    brandTurquoise: '#40E0D0',
    brandBlue: '#3B82F6',
    brandPurple: '#8B5CF6',
    brandPink: '#EC4899',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

// Module icons and colors
const moduleConfig: Record<ERPModule, { icon: ReactNode; color: string; label: string }> = {
  finance: {
    label: 'Finance',
    color: tokens.colors.brandGreen,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  projects: {
    label: 'Projects',
    color: tokens.colors.brandBlue,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  hr: {
    label: 'HR',
    color: tokens.colors.brandPurple,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  crm: {
    label: 'CRM',
    color: tokens.colors.brandPink,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-9" />
        <path d="M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </svg>
    ),
  },
  inventory: {
    label: 'Inventory',
    color: tokens.colors.brandOrange,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  invoicing: {
    label: 'Invoicing',
    color: tokens.colors.brandTurquoise,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  settings: {
    label: 'Settings',
    color: tokens.colors.textMuted,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
};

// Submenu items per module
const moduleSubmenus: Record<ERPModule, { href: string; label: string }[]> = {
  finance: [
    { href: '/erp/finance', label: 'Overview' },
    { href: '/erp/finance/accounts', label: 'Chart of Accounts' },
    { href: '/erp/finance/journal', label: 'Journal Entries' },
    { href: '/erp/finance/expenses', label: 'Expenses' },
    { href: '/erp/finance/budgets', label: 'Budgets' },
    { href: '/erp/finance/reports', label: 'Reports' },
  ],
  projects: [
    { href: '/erp/projects', label: 'All Projects' },
    { href: '/erp/projects/tasks', label: 'Tasks' },
    { href: '/erp/projects/time', label: 'Time Tracking' },
    { href: '/erp/projects/milestones', label: 'Milestones' },
  ],
  hr: [
    { href: '/erp/hr', label: 'Overview' },
    { href: '/erp/hr/employees', label: 'Employees' },
    { href: '/erp/hr/departments', label: 'Departments' },
    { href: '/erp/hr/contracts', label: 'Contracts & NDAs' },
    { href: '/erp/hr/templates', label: 'Templates' },
    { href: '/erp/hr/leave', label: 'Leave Management' },
    { href: '/erp/hr/payroll', label: 'Payroll' },
    { href: '/erp/hr/reviews', label: 'Performance' },
  ],
  crm: [
    { href: '/erp/crm', label: 'Dashboard' },
    { href: '/erp/crm/contacts', label: 'Contacts' },
    { href: '/erp/crm/companies', label: 'Companies' },
    { href: '/erp/crm/deals', label: 'Deals' },
    { href: '/erp/crm/activities', label: 'Activities' },
    { href: '/erp/crm/templates', label: 'Templates' },
  ],
  inventory: [
    { href: '/erp/inventory', label: 'Overview' },
    { href: '/erp/inventory/products', label: 'Products' },
    { href: '/erp/inventory/stock', label: 'Stock Levels' },
    { href: '/erp/inventory/locations', label: 'Locations' },
    { href: '/erp/inventory/suppliers', label: 'Suppliers' },
    { href: '/erp/inventory/purchase-orders', label: 'Purchase Orders' },
  ],
  invoicing: [
    { href: '/erp/invoicing', label: 'All Invoices' },
    { href: '/erp/invoicing/create', label: 'Create Invoice' },
    { href: '/erp/invoicing/payments', label: 'Payments' },
    { href: '/erp/invoicing/recurring', label: 'Recurring' },
  ],
  settings: [
    { href: '/erp/settings', label: 'Overview' },
    { href: '/erp/settings/users', label: 'Users' },
    { href: '/erp/settings/roles', label: 'Roles' },
    { href: '/erp/settings/user-roles', label: 'User Permissions' },
    { href: '/erp/settings/audit-log', label: 'Audit Log' },
  ],
};

interface ERPSidebarProps {
  permissions: Record<ERPModule, ERPPermission[]>;
  collapsed?: boolean;
  onToggle?: () => void;
  isMobile?: boolean;
  onClose?: () => void;
}

export function ERPSidebar({ permissions, collapsed = false, onToggle, isMobile = false, onClose }: ERPSidebarProps) {
  const pathname = usePathname();
  const [expandedModule, setExpandedModule] = useState<ERPModule | null>(() => {
    // Auto-expand based on current path
    for (const [module, items] of Object.entries(moduleSubmenus)) {
      if (items.some(item => pathname.startsWith(item.href))) {
        return module as ERPModule;
      }
    }
    return null;
  });

  // On mobile, never use collapsed mode
  const isCollapsed = isMobile ? false : collapsed;

  const hasModuleAccess = (module: ERPModule): boolean => {
    return permissions[module]?.length > 0;
  };

  const isModuleActive = (module: ERPModule): boolean => {
    return moduleSubmenus[module]?.some(item => pathname.startsWith(item.href)) ?? false;
  };

  const toggleModule = (module: ERPModule) => {
    setExpandedModule(expandedModule === module ? null : module);
  };

  const handleNavClick = () => {
    if (isMobile && onClose) onClose();
  };

  const accessibleModules = (Object.keys(moduleConfig) as ERPModule[]).filter(hasModuleAccess);

  return (
    <aside
      style={{
        width: isMobile ? 280 : isCollapsed ? 64 : 256,
        minHeight: isMobile ? '100vh' : 'calc(100vh - 64px)',
        backgroundColor: tokens.colors.bgElevated,
        borderRight: `1px solid ${tokens.colors.borderSubtle}`,
        transition: isMobile ? 'none' : 'width 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          padding: isCollapsed ? '16px 12px' : '16px 20px',
          borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          minHeight: isMobile ? 64 : 'auto',
        }}
      >
        {!isCollapsed && (
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.textMuted, letterSpacing: '0.05em' }}>
            ERP MODULES
          </span>
        )}
        {isMobile ? (
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius.default,
              border: 'none',
              backgroundColor: 'transparent',
              color: tokens.colors.textMuted,
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onToggle}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius.default,
              border: 'none',
              backgroundColor: 'transparent',
              color: tokens.colors.textMuted,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
              e.currentTarget.style.color = tokens.colors.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = tokens.colors.textMuted;
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isCollapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {/* ERP Dashboard Link */}
        <Link
          href="/erp"
          onClick={handleNavClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: isCollapsed ? '10px' : '10px 12px',
            borderRadius: tokens.radius.md,
            textDecoration: 'none',
            marginBottom: 4,
            backgroundColor: pathname === '/erp' ? `${tokens.colors.brandTurquoise}15` : 'transparent',
            color: pathname === '/erp' ? tokens.colors.brandTurquoise : tokens.colors.textSecondary,
            border: pathname === '/erp' ? `1px solid ${tokens.colors.brandTurquoise}30` : '1px solid transparent',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            transition: 'all 0.15s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          {!isCollapsed && <span style={{ fontSize: 14, fontWeight: 500 }}>Dashboard</span>}
        </Link>

        {/* Agenda Link */}
        <Link
          href="/erp/agenda"
          onClick={handleNavClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: isCollapsed ? '10px' : '10px 12px',
            borderRadius: tokens.radius.md,
            textDecoration: 'none',
            marginBottom: 8,
            backgroundColor: pathname === '/erp/agenda' ? `${tokens.colors.brandTurquoise}15` : 'transparent',
            color: pathname === '/erp/agenda' ? tokens.colors.brandTurquoise : tokens.colors.textSecondary,
            border: pathname === '/erp/agenda' ? `1px solid ${tokens.colors.brandTurquoise}30` : '1px solid transparent',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            transition: 'all 0.15s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {!isCollapsed && <span style={{ fontSize: 14, fontWeight: 500 }}>Agenda</span>}
        </Link>

        {/* Module Navigation */}
        {accessibleModules.map((module) => {
          const config = moduleConfig[module];
          const isActive = isModuleActive(module);
          const isExpanded = expandedModule === module;

          return (
            <div key={module} style={{ marginBottom: 4 }}>
              <button
                onClick={() => !isCollapsed && toggleModule(module)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: isCollapsed ? '10px' : '10px 12px',
                  borderRadius: tokens.radius.md,
                  border: 'none',
                  backgroundColor: isActive ? `${config.color}15` : 'transparent',
                  color: isActive ? config.color : tokens.colors.textSecondary,
                  cursor: 'pointer',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ color: isActive ? config.color : tokens.colors.textMuted }}>
                  {config.icon}
                </span>
                {!isCollapsed && (
                  <>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{config.label}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </>
                )}
              </button>

              {/* Submenu */}
              {!isCollapsed && isExpanded && (
                <div style={{ paddingLeft: 32, marginTop: 4 }}>
                  {moduleSubmenus[module].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        borderRadius: tokens.radius.default,
                        fontSize: 13,
                        textDecoration: 'none',
                        color: pathname === item.href ? config.color : tokens.colors.textMuted,
                        backgroundColor: pathname === item.href ? `${config.color}10` : 'transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div
        style={{
          padding: isCollapsed ? '16px 12px' : '16px 20px',
          borderTop: `1px solid ${tokens.colors.borderSubtle}`,
        }}
      >
        <Link
          href="/dashboard"
          onClick={handleNavClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: tokens.radius.default,
            fontSize: 13,
            textDecoration: 'none',
            color: tokens.colors.textMuted,
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            transition: 'all 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {!isCollapsed && <span>Back to Dashboard</span>}
        </Link>
      </div>
    </aside>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

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
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

interface ERPHeaderProps {
  user: {
    email: string;
    display_name?: string;
    isAdmin?: boolean;
  } | null;
  isMobile?: boolean;
  onMenuToggle?: () => void;
}

export function ERPHeader({ user, isMobile = false, onMenuToggle }: ERPHeaderProps) {
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/erp/search?q=${encodeURIComponent(searchQuery)}`);
      setMobileSearchOpen(false);
    }
  };

  return (
    <header
      style={{
        height: 64,
        backgroundColor: `${tokens.colors.bgPrimary}ee`,
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
      }}
    >
      {/* Hamburger - mobile only */}
      {isMobile && (
        <button
          onClick={onMenuToggle}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: tokens.radius.default,
            border: 'none',
            backgroundColor: 'transparent',
            color: tokens.colors.textSecondary,
            cursor: 'pointer',
            marginRight: 8,
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}

      {/* Logo */}
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 8 : 12,
          textDecoration: 'none',
          marginRight: isMobile ? 'auto' : 32,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 2 }}>
          <div style={{ width: 6, height: 24, backgroundColor: tokens.colors.brandOrange, borderRadius: '3px 0 0 3px' }} />
          <div style={{ width: 6, height: 24, backgroundColor: tokens.colors.brandGreen }} />
          <div style={{ width: 6, height: 24, backgroundColor: tokens.colors.brandTurquoise, borderRadius: '0 3px 3px 0' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: tokens.colors.textPrimary, letterSpacing: '-0.01em' }}>
            HARDWAVE
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: tokens.colors.brandTurquoise, letterSpacing: '0.05em' }}>
            ERP
          </span>
        </div>
      </Link>

      {/* Global Search - desktop: inline form, mobile: expandable */}
      {isMobile ? (
        mobileSearchOpen ? (
          <form
            onSubmit={handleSearch}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              backgroundColor: tokens.colors.bgPrimary,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                backgroundColor: 'transparent',
                color: tokens.colors.textMuted,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <input
              autoFocus
              type="text"
              placeholder="Search across ERP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                backgroundColor: tokens.colors.bgCard,
                color: tokens.colors.textPrimary,
                fontSize: 14,
                outline: 'none',
              }}
            />
          </form>
        ) : null
      ) : (
        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 480 }}>
          <div style={{ position: 'relative' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.colors.textFaint}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search across ERP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px 10px 42px',
                borderRadius: tokens.radius.md,
                border: `1px solid ${tokens.colors.borderSubtle}`,
                backgroundColor: tokens.colors.bgCard,
                color: tokens.colors.textPrimary,
                fontSize: 14,
                outline: 'none',
                transition: 'all 0.15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tokens.colors.brandTurquoise + '50';
                e.currentTarget.style.boxShadow = `0 0 0 3px ${tokens.colors.brandTurquoise}15`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = tokens.colors.borderSubtle;
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: tokens.colors.bgElevated,
                border: `1px solid ${tokens.colors.borderSubtle}`,
              }}
            >
              <span style={{ fontSize: 11, color: tokens.colors.textFaint }}>⌘K</span>
            </div>
          </div>
        </form>
      )}

      {/* Right Side Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, marginLeft: isMobile ? 0 : 'auto' }}>
        {/* Mobile search trigger */}
        {isMobile && (
          <button
            onClick={() => setMobileSearchOpen(true)}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius.default,
              border: 'none',
              backgroundColor: 'transparent',
              color: tokens.colors.textMuted,
              cursor: 'pointer',
            }}
            title="Search"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        )}

        {/* Notifications */}
        <button
          style={{
            width: 36,
            height: 36,
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
          title="Notifications"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>

        {!isMobile && (
          <button
            style={{
              width: 36,
              height: 36,
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
            title="Help"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
        )}

        {/* Separator */}
        <div style={{ width: 1, height: 24, backgroundColor: tokens.colors.borderSubtle, margin: isMobile ? '0 2px' : '0 8px' }} />

        {/* User Menu */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: isMobile ? '6px' : '6px 12px',
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.colors.borderSubtle}`,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: tokens.colors.brandTurquoise + '30',
                color: tokens.colors.brandTurquoise,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {user?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            {!isMobile && (
              <>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, color: tokens.colors.textPrimary, fontWeight: 500 }}>
                    {user?.display_name || 'User'}
                  </div>
                  <div style={{ fontSize: 11, color: tokens.colors.textFaint }}>
                    {user?.isAdmin ? 'Administrator' : 'User'}
                  </div>
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={tokens.colors.textMuted}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 200,
                backgroundColor: tokens.colors.bgCard,
                border: `1px solid ${tokens.colors.borderDefault}`,
                borderRadius: tokens.radius.md,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                zIndex: 100,
              }}
            >
              <div style={{ padding: 8 }}>
                <Link
                  href="/dashboard"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: tokens.radius.default,
                    fontSize: 13,
                    color: tokens.colors.textSecondary,
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                  onClick={() => setDropdownOpen(false)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
                    e.currentTarget.style.color = tokens.colors.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = tokens.colors.textSecondary;
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span>Dashboard</span>
                </Link>

                <Link
                  href="/erp/settings"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: tokens.radius.default,
                    fontSize: 13,
                    color: tokens.colors.textSecondary,
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                  onClick={() => setDropdownOpen(false)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
                    e.currentTarget.style.color = tokens.colors.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = tokens.colors.textSecondary;
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Settings</span>
                </Link>
              </div>

              <div style={{ borderTop: `1px solid ${tokens.colors.borderSubtle}`, padding: 8 }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: tokens.radius.default,
                    fontSize: 13,
                    color: tokens.colors.textSecondary,
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.color = '#EF4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = tokens.colors.textSecondary;
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

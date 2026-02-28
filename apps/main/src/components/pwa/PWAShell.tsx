'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { MobileNav } from './MobileNav';
import { InstallPrompt } from './InstallPrompt';
import { AuthGuard } from './AuthGuard';
import { AudioPlayerProvider } from './AudioPlayerContext';
import { MiniPlayer } from './MiniPlayer';
import { FullPlayer } from './FullPlayer';
import { SyncIndicator } from './SyncIndicator';

interface PWAShellProps {
  children: React.ReactNode;
}

// Pages that should show the full UI (nav bar, etc.)
const FULL_UI_PATHS = ['/app', '/app/collections', '/app/favorites', '/app/profile'];

export function PWAShell({ children }: PWAShellProps) {
  const pathname = usePathname();
  const [showFullPlayer, setShowFullPlayer] = useState(false);

  // Login page has its own layout without nav
  const isLoginPage = pathname === '/app/login';
  const showFullUI = FULL_UI_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );

  return (
    <AuthGuard>
      <AudioPlayerProvider>
        <div className="min-h-screen bg-[#08080c] text-white pwa-layout">
          {/* Sync status indicator */}
          {showFullUI && !isLoginPage && <SyncIndicator />}

          {/* Main content with bottom padding for nav + player */}
          <main className={showFullUI && !isLoginPage ? 'pb-36 safe-area-pt safe-area-pl safe-area-pr' : ''}>
            {children}
          </main>

          {/* Mini player - shows above nav */}
          {showFullUI && !isLoginPage && (
            <MiniPlayer onExpand={() => setShowFullPlayer(true)} />
          )}

          {/* Full screen player */}
          <FullPlayer
            isOpen={showFullPlayer}
            onClose={() => setShowFullPlayer(false)}
          />

          {/* Bottom navigation - only show on authenticated pages */}
          {showFullUI && !isLoginPage && <MobileNav />}

          {/* Install prompt */}
          {!isLoginPage && <InstallPrompt />}
        </div>
      </AudioPlayerProvider>
    </AuthGuard>
  );
}

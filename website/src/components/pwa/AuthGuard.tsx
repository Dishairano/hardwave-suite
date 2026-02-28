'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

// Pages that don't require authentication
const PUBLIC_PATHS = ['/app/login'];

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Skip auth check for public paths
      if (PUBLIC_PATHS.includes(pathname)) {
        setIsChecking(false);
        setIsAuthenticated(true);
        return;
      }

      // Check for token in localStorage
      const token = localStorage.getItem('hardwave_token');

      if (!token) {
        // No token, redirect to login
        router.replace('/app/login');
        return;
      }

      // Optionally verify token is still valid
      try {
        const response = await fetch('/api/subscription', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          setIsAuthenticated(true);
        } else if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('hardwave_token');
          router.replace('/app/login');
          return;
        } else {
          // Other error, still allow access (offline mode)
          setIsAuthenticated(true);
        }
      } catch {
        // Network error, allow access for offline mode
        // User has a token, trust it for now
        setIsAuthenticated(true);
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [pathname, router]);

  // Show loading while checking auth
  if (isChecking && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#08080c]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFA500] to-[#FF6B00] flex items-center justify-center mb-6">
          <span className="text-3xl font-bold text-[#08080c]">H</span>
        </div>
        <Loader2 className="w-6 h-6 text-[#FFA500] animate-spin" />
        <p className="mt-4 text-sm text-white/60">Checking authentication...</p>
      </div>
    );
  }

  // Don't render children until authenticated (unless public path)
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}

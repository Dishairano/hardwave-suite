'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { hapticSuccess, hapticError } from '@/lib/pwa/haptics';
import Link from 'next/link';

export default function PWALoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('hardwave_token');
    if (token) {
      router.replace('/app');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      if (data.token) {
        localStorage.setItem('hardwave_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('hardwave_user', JSON.stringify(data.user));
      }
      if (data.subscription) {
        localStorage.setItem('hardwave_subscription', JSON.stringify(data.subscription));
      }

      hapticSuccess();

      // Redirect to library
      router.replace('/app');
    } catch (err) {
      hapticError();
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 safe-area-pt safe-area-pb">
      {/* Logo */}
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFA500] to-[#FF6B00] flex items-center justify-center mb-8">
        <span className="text-4xl font-bold text-[#08080c]">H</span>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
      <p className="text-sm text-white/60 mb-8 text-center">
        Sign in to access your sample library
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Email input */}
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-white/60 mb-2"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full h-12 px-4 rounded-lg bg-white/5 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#FFA500]/50 transition-all"
          />
        </div>

        {/* Password input */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-white/60 mb-2"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              className="w-full h-12 px-4 pr-12 rounded-lg bg-white/5 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#FFA500]/50 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Forgot password */}
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs text-white/40 underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-lg bg-[#FFA500] text-[#08080c] font-semibold flex items-center justify-center gap-2 active:bg-[#FF8C00] disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      {/* Register link */}
      <p className="mt-6 text-sm text-white/60">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="text-[#FFA500] underline underline-offset-4"
        >
          Subscribe
        </Link>
      </p>

      {/* Subscription info */}
      <div className="mt-8 p-4 rounded-lg bg-white/5 max-w-sm w-full">
        <p className="text-xs text-white/40 text-center">
          Hardwave Suite requires an active subscription.
          <br />
          EUR 10/month for full access to all tools.
        </p>
      </div>

      {/* Footer */}
      <p className="absolute bottom-8 text-xs text-white/20 safe-area-pb">
        Hardwave Studios
      </p>
    </div>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    if (!token || !email) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setIsSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#08080c] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Password Reset!</h1>
        <p className="text-sm text-white/60 text-center mb-8">
          Your password has been successfully reset.
          <br />
          Redirecting to login...
        </p>
        <Link
          href="/login"
          className="text-[#FFA500] text-sm underline underline-offset-4"
        >
          Go to login now
        </Link>
      </div>
    );
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-[#08080c] flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <XCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
        <p className="text-sm text-white/60 text-center mb-8">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="px-6 py-3 rounded-lg bg-[#FFA500] text-[#08080c] font-semibold hover:bg-[#FF8C00] transition-colors"
        >
          Request New Link
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] flex flex-col items-center justify-center px-6">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-[#FFA500]/20 flex items-center justify-center mb-6">
        <Lock className="w-8 h-8 text-[#FFA500]" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
      <p className="text-sm text-white/60 text-center mb-8">
        Enter your new password below.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-white/60 mb-2"
          >
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={8}
              className="w-full h-12 px-4 pr-12 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-[#FFA500]/50 focus:ring-2 focus:ring-[#FFA500]/20 transition-all"
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
          <p className="mt-1 text-xs text-white/40">
            Must be at least 8 characters
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-medium text-white/60 mb-2"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            className="w-full h-12 px-4 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-[#FFA500]/50 focus:ring-2 focus:ring-[#FFA500]/20 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-lg bg-[#FFA500] text-[#08080c] font-semibold flex items-center justify-center gap-2 hover:bg-[#FF8C00] disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Resetting...
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="absolute bottom-8 text-xs text-white/20">
        Hardwave Studios
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#FFA500] animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

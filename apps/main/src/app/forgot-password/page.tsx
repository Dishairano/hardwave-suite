'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      setIsSuccess(true);
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
        <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
        <p className="text-sm text-white/60 text-center mb-8 max-w-sm">
          If an account exists with <span className="text-white">{email}</span>,
          you will receive a password reset link shortly.
        </p>
        <Link
          href="/login"
          className="text-[#FFA500] text-sm underline underline-offset-4"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] flex flex-col items-center justify-center px-6">
      {/* Back link */}
      <Link
        href="/login"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </Link>

      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-[#FFA500]/20 flex items-center justify-center mb-6">
        <Mail className="w-8 h-8 text-[#FFA500]" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-2">Forgot Password?</h1>
      <p className="text-sm text-white/60 text-center mb-8 max-w-sm">
        Enter your email address and we&apos;ll send you a link to reset your password.
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
            htmlFor="email"
            className="block text-xs font-medium text-white/60 mb-2"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
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
              Sending...
            </>
          ) : (
            'Send Reset Link'
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

'use client'

import { useEffect, useState } from 'react'
import { AnalyserCanvas } from '@/components/AnalyserCanvas'

/**
 * VST webview analyser page — minimal chrome, loaded by the wry webview inside the DAW.
 *
 * - No header, no sidebar, no navigation — just the analyser fullscreen.
 * - Auth token is passed via URL query param (?token=xxx) injected by Rust.
 * - If no valid token, shows a compact login form.
 * - Subscription is validated before rendering the analyser.
 */

type AuthState =
  | { status: 'loading' }
  | { status: 'login' }
  | { status: 'upgrade' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

export default function VstAnalyserPage() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    // Mark as VST mode
    ;(window as any).__HARDWAVE_VST = true

    const init = async () => {
      // Try token from URL query param first
      const params = new URLSearchParams(window.location.search)
      let token = params.get('token')

      // Fallback to localStorage
      if (!token) token = localStorage.getItem('hardwave_vst_token')

      if (!token) {
        setAuth({ status: 'login' })
        return
      }

      await validateToken(token)
    }

    init()

    return () => {
      delete (window as any).__HARDWAVE_VST
    }
  }, [])

  const validateToken = async (token: string) => {
    try {
      // Verify token is valid
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!meRes.ok) {
        localStorage.removeItem('hardwave_vst_token')
        setAuth({ status: 'login' })
        return
      }

      // Check subscription
      const subRes = await fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!subRes.ok) {
        setAuth({ status: 'error', message: 'Failed to check subscription.' })
        return
      }
      const subData = await subRes.json()
      if (!subData.hasSubscription) {
        setAuth({ status: 'upgrade' })
        return
      }

      // Store token for persistence
      localStorage.setItem('hardwave_vst_token', token)

      // Notify Rust to persist the token (IPC)
      try {
        ;(window as any).__hardwave?.saveToken?.(token)
      } catch { /* not in VST context */ }

      setAuth({ status: 'ready' })
    } catch {
      setAuth({ status: 'error', message: 'Connection failed. Check your internet.' })
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok || !data.token) {
        setLoginError(data.error || 'Invalid credentials.')
        setLoginLoading(false)
        return
      }

      await validateToken(data.token)
    } catch {
      setLoginError('Connection failed.')
    }
    setLoginLoading(false)
  }

  if (auth.status === 'loading') {
    return (
      <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-zinc-400">Authenticating...</span>
        </div>
      </div>
    )
  }

  if (auth.status === 'login') {
    return (
      <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-80 bg-[#111113] rounded-2xl border border-[#27272a] p-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h2 className="text-base font-bold text-white text-center mb-1">Hardwave Analyser</h2>
          <p className="text-xs text-zinc-500 text-center mb-4">Sign in with your Hardwave account</p>

          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-sm text-white placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-sm text-white placeholder-zinc-500 focus:border-cyan-500/50 focus:outline-none"
            />
            {loginError && <p className="text-xs text-red-400">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-green-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-[10px] text-zinc-600 text-center mt-3">
            Need an account? Visit hardwave.studio
          </p>
        </div>
      </div>
    )
  }

  if (auth.status === 'upgrade') {
    return (
      <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-80 bg-[#111113] rounded-2xl border border-[#27272a] p-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h2 className="text-base font-bold text-white mb-2">Premium Required</h2>
          <p className="text-xs text-zinc-400 mb-4">
            The Hardwave Analyser requires an active Hardwave Pro subscription.
          </p>
          <a
            href="https://hardwave.studio/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-green-500 text-white text-sm font-semibold"
          >
            Upgrade to Pro
          </a>
        </div>
      </div>
    )
  }

  if (auth.status === 'error') {
    return (
      <div className="h-screen w-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-80 bg-[#111113] rounded-2xl border border-[#27272a] p-6 text-center">
          <h2 className="text-base font-bold text-red-400 mb-2">Error</h2>
          <p className="text-xs text-zinc-400 mb-4">{auth.message}</p>
          <button
            onClick={() => setAuth({ status: 'login' })}
            className="px-4 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-sm text-white hover:bg-[#27272a]"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // status === 'ready'
  return (
    <div className="h-screen w-screen bg-[#0a0a0b] overflow-hidden flex flex-col">
      <AnalyserCanvas vstMode />
    </div>
  )
}

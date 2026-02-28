'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnalyserCanvas } from '@/components/AnalyserCanvas'

/**
 * Browser analyser page — accessible at /app/analyser for premium users.
 * Uses the website's existing auth (localStorage token) and normal app layout.
 */

export default function BrowserAnalyserPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'upgrade' | 'ready'>('loading')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/app/login')
      return
    }

    const check = async () => {
      try {
        // Verify token
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!meRes.ok) {
          router.push('/app/login')
          return
        }

        // Check subscription
        const subRes = await fetch('/api/subscription', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (subRes.ok) {
          const subData = await subRes.json()
          if (!subData.hasSubscription) {
            setStatus('upgrade')
            return
          }
        }

        setStatus('ready')
      } catch {
        router.push('/app/login')
      }
    }

    check()
  }, [router])

  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0b]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-zinc-400">Loading analyser...</span>
        </div>
      </div>
    )
  }

  if (status === 'upgrade') {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0b]">
        <div className="w-96 bg-[#111113] rounded-2xl border border-[#27272a] p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Premium Feature</h2>
          <p className="text-zinc-400 text-sm mb-6">
            The Hardwave Analyser is available with a Hardwave Pro subscription. Upgrade to get real-time spectrum analysis, stereo metering, and more.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-green-500 text-white font-semibold hover:shadow-lg hover:shadow-orange-500/25 transition-all"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0b] overflow-hidden">
      <AnalyserCanvas />
    </div>
  )
}

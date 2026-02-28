'use client'

import { Suspense, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import DashboardNav from '@/components/site/DashboardNav'
import { PLAN_DETAILS } from '@/lib/stripe-client'

interface Subscription {
  id: number
  status: string
  planName: string
  price: number
  currency: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  license: { key: string; activations: number; maxActivations: number; status: string } | null
}

interface User { display_name?: string; email?: string }

const features = ['All current plugins', 'All future plugins included', 'Installed automatically via Hardwave Suite', 'Cancel anytime']

function SubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/login'); return }
    setUser(JSON.parse(userStr))
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 5000)
    }
    fetch('/api/subscription', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.success) { setHasSubscription(data.hasSubscription); setSubscription(data.subscription) } })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [router, searchParams])

  const handleSubscribe = async () => {
    setActionLoading(true)
    try {
      const token = localStorage.getItem('token')
      const r = await fetch('/api/stripe/create-checkout', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
      const data = await r.json()
      if (data.success && data.url) window.location.href = data.url
      else alert(data.error || 'Failed to create checkout session')
    } catch { alert('Failed to start checkout') }
    finally { setActionLoading(false) }
  }

  const handleManageSubscription = async () => {
    setActionLoading(true)
    try {
      const token = localStorage.getItem('token')
      const r = await fetch('/api/stripe/portal', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
      const data = await r.json()
      if (data.success && data.url) window.location.href = data.url
      else alert(data.error || 'Failed to open billing portal')
    } catch { alert('Failed to open billing portal') }
    finally { setActionLoading(false) }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const isMonthly = subscription?.planName?.toLowerCase().includes('month')

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardNav user={user} />

      <div className="flex-1 max-w-[1100px] w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-1">Subscription</h1>
          <p className="text-sm text-muted-foreground">Manage your Hardwave subscription.</p>
        </motion.div>

        {showSuccess && (
          <div className="mb-6 px-5 py-4 rounded-xl bg-secondary/10 border border-secondary/30 text-sm text-secondary font-medium">
            Subscription activated successfully! Welcome to Hardwave.
          </div>
        )}

        {hasSubscription && subscription ? (
          <div className="space-y-6">
            {/* Current plan */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="rounded-xl p-[1px] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
              <div className="bg-surface rounded-xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <h2 className="text-lg font-bold text-foreground">{subscription.planName}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">Active</span>
                  {subscription.cancelAtPeriodEnd && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Cancels at period end</span>
                  )}
                </div>
                <div className="mb-1">
                  <span className="text-3xl font-black text-foreground">
                    {subscription.currency.toUpperCase()} {subscription.price}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">/ {isMonthly ? 'month' : 'year'}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-6">
                  {subscription.cancelAtPeriodEnd ? 'Ends on' : 'Renews on'} {formatDate(subscription.currentPeriodEnd)}
                </p>
                <button onClick={handleManageSubscription} disabled={actionLoading}
                  className="inline-flex items-center justify-center font-semibold border border-foreground/20 text-foreground px-5 py-2.5 rounded-md hover:border-foreground/40 transition text-sm disabled:opacity-60">
                  {actionLoading ? 'Loading...' : 'Manage Billing'}
                </button>
                <p className="text-[11px] text-muted-foreground mt-4">
                  Cancelling stops renewal. You keep access until the end of your current period.
                </p>
              </div>
            </motion.div>

            {/* License key */}
            {subscription.license && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }} className="surface-card rounded-xl p-6 sm:p-8">
                <h3 className="text-base font-bold text-foreground mb-2">License Key</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Activations: {subscription.license.activations} / {subscription.license.maxActivations}
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 px-4 py-2.5 bg-background border border-foreground/10 rounded-md text-sm font-mono text-primary truncate">
                    {subscription.license.key}
                  </code>
                  <button onClick={() => navigator.clipboard.writeText(subscription.license!.key)}
                    className="font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-md hover:brightness-110 transition text-sm shrink-0">
                    Copy
                  </button>
                </div>
              </motion.div>
            )}

            {/* Included plugins */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }} className="surface-card rounded-xl p-6 sm:p-8">
              <h3 className="text-base font-bold text-foreground mb-5">Included with your subscription</h3>
              <div className="flex items-center gap-2.5 mb-4">
                <Check size={16} className="text-secondary shrink-0" />
                <span className="text-sm text-foreground">Hardwave Analyser</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">Active</span>
              </div>
              <p className="text-xs text-muted-foreground">New plugins are added automatically when they launch.</p>
            </motion.div>

            {/* Upgrade to yearly */}
            {isMonthly && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="surface-card rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-foreground font-medium">Save 33% by switching to yearly — €99.99/year</p>
                </div>
                <button onClick={handleManageSubscription} disabled={actionLoading}
                  className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:brightness-110 transition text-sm shrink-0 disabled:opacity-60">
                  Switch to Yearly
                </button>
              </motion.div>
            )}
          </div>
        ) : (
          <div>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
              {/* Monthly */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }} className="surface-card rounded-xl p-6 sm:p-8 flex flex-col">
                <p className="text-sm text-muted-foreground font-semibold mb-4">Monthly</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-foreground">€12.49</span>
                  <span className="text-sm text-muted-foreground ml-1">/ month</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Check size={16} className="text-primary shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <button onClick={handleSubscribe} disabled={actionLoading}
                  className="inline-flex items-center justify-center w-full font-semibold border border-foreground/20 text-foreground px-6 py-3 rounded-md hover:border-foreground/40 transition text-sm disabled:opacity-60">
                  {actionLoading ? 'Loading...' : 'Start Monthly'}
                </button>
              </motion.div>

              {/* Yearly */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative rounded-xl p-[1px] overflow-hidden"
                style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
                <div className="bg-surface rounded-xl p-6 sm:p-8 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground font-semibold">Yearly</p>
                    <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full">Best Value — Save 33%</span>
                  </div>
                  <div className="mb-1">
                    <span className="text-4xl font-black text-foreground">€99.99</span>
                    <span className="text-sm text-muted-foreground ml-1">/ year</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">€8.33 / month</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <Check size={16} className="text-primary shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={handleSubscribe} disabled={actionLoading}
                    className="inline-flex items-center justify-center w-full font-semibold bg-primary text-primary-foreground px-6 py-3 rounded-md hover:brightness-110 transition text-sm disabled:opacity-60">
                    {actionLoading ? 'Loading...' : 'Start Yearly'}
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-foreground/5 py-6">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
          <p className="text-xs text-muted-foreground">© 2026 Hardwave Studios</p>
        </div>
      </footer>
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, Download } from 'lucide-react'
import DashboardNav from '@/components/site/DashboardNav'

interface User { display_name?: string; email?: string }

export default function MyPluginsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [hasSubscription, setHasSubscription] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/login'); return }
    setUser(JSON.parse(userStr))
    fetch('/api/subscription', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.success) setHasSubscription(data.hasSubscription) })
      .catch(console.error)
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={user} />

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-1">My Plugins</h1>
          <p className="text-sm text-muted-foreground">Plugins you own or have access to through your subscription.</p>
        </motion.div>

        {/* Install banner */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }} className="mb-10">
          <div className="rounded-xl p-[1px] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
            <div className="bg-surface rounded-xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-2.5 rounded-lg bg-foreground/5 shrink-0">
                <Download size={20} className="text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium">Plugins are installed through the Hardwave Suite desktop app.</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <a href="#"
                  className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-5 py-2 rounded-md hover:brightness-110 transition text-sm">
                  Open Hardwave Suite
                </a>
                <Link href="/downloads"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap hidden sm:block">
                  Download Suite for free →
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Plugin card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }} className="mb-14">
          <div className="surface-card rounded-xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 rounded-lg bg-foreground/5 shrink-0">
                <Activity size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-base font-bold text-foreground">Hardwave Analyser</h3>
                  <span className="text-[10px] font-mono text-muted-foreground">v0.4.x</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">Purchased</span>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  <span className="text-xs text-secondary font-medium">Active</span>
                </div>
                <p className="text-xs text-muted-foreground">Spectrum analyser with stereo metering and phase correlation.</p>
              </div>
              <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                <p className="text-[11px] text-muted-foreground">Install via Suite</p>
                <Link href="/products/analyser" className="text-xs text-primary hover:underline font-medium">View Details →</Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Subscription upsell */}
        {!hasSubscription && (
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.4 }}>
            <div className="surface-card rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-base font-bold text-foreground mb-1">Get all plugins with a subscription</h3>
                <p className="text-sm text-muted-foreground">€12.49/month or €99.99/year. Includes all current and future plugins.</p>
              </div>
              <Link href="/pricing"
                className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:brightness-110 transition text-sm shrink-0">
                Start Subscription
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

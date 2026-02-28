'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, Download, CreditCard, ExternalLink } from 'lucide-react'
import DashboardNav from '@/components/site/DashboardNav'

interface Subscription {
  status: string
  planName: string
  currentPeriodEnd: string
}

interface Order {
  id: number
  number: string | null
  status: string
  amount: number
  currency: string
  description: string
  hostedUrl?: string | null
  createdAt: string
}

interface Product {
  id: number
  name: string
  slug: string
  current_version: string
}

interface User {
  display_name?: string
  email?: string
  isAdmin?: boolean
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [hasSubscription, setHasSubscription] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/login'); return }
    setUser(JSON.parse(userStr))

    Promise.all([
      fetch('/api/subscription', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/downloads', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([subData, ordersData, downloadsData]) => {
      if (subData.success) {
        setHasSubscription(subData.hasSubscription)
        setSubscription(subData.subscription ?? null)
      }
      if (ordersData.success) setOrders(ordersData.orders ?? [])
      if (downloadsData.success) setProducts(downloadsData.products ?? [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [router])

  const firstName = user?.display_name?.split(' ')[0] ?? 'Producer'

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={user} />

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-1">
            Welcome back, {firstName}
          </h1>
          <p className="text-muted-foreground text-sm">Manage your plugins and subscription.</p>
        </motion.div>

        {/* Status cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }} className="surface-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subscription</p>
              <CreditCard size={16} className="text-muted-foreground" />
            </div>
            {hasSubscription && subscription ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">Active</span>
                  <span className="text-sm font-medium text-foreground">{subscription.planName}</span>
                </div>
                <p className="text-xs text-muted-foreground">Renews {formatDate(subscription.currentPeriodEnd)}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-2">No subscription</p>
                <Link href="/pricing" className="text-xs text-primary hover:underline font-medium">Start subscription →</Link>
              </>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }} className="surface-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Plugins</p>
              <Activity size={16} className="text-muted-foreground" />
            </div>
            {products.length > 0 ? (
              <>
                <p className="text-2xl font-black text-foreground mb-1">{products.length} Plugin{products.length !== 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground mb-3">{products.map(p => p.name).join(', ')}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground mb-2">No plugins yet</p>
                <p className="text-xs text-muted-foreground mb-3">Get a subscription to access all plugins</p>
              </>
            )}
            <Link href="/dashboard/products" className="text-xs text-primary hover:underline font-medium">Manage →</Link>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }} className="surface-card rounded-xl p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hardwave Suite</p>
              <Download size={16} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">Install your plugins via Hardwave Suite</p>
            <a href="hardwave-suite://"
              className="inline-flex items-center justify-center w-full font-semibold border border-foreground/20 text-foreground px-4 py-2 rounded-md hover:border-foreground/40 transition text-sm mb-2">
              Open Suite
            </a>
            <Link href="/downloads" className="block text-center text-[11px] text-muted-foreground hover:text-primary transition-colors">
              Don&apos;t have it? Download free →
            </Link>
          </motion.div>
        </div>

        {/* My Plugins */}
        {products.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.4 }} className="mb-14">
            <h2 className="text-lg font-bold text-foreground tracking-tight mb-5">My Plugins</h2>
            <div className="surface-card rounded-xl divide-y divide-foreground/5">
              {products.map(product => (
                <div key={product.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="p-2.5 rounded-lg bg-foreground/5 shrink-0">
                    <Activity size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground">{product.name}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground">v{product.current_version}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">Active</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Install via Hardwave Suite</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary shrink-0 hidden sm:block">Active</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Orders */}
        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.4 }}>
          <h2 className="text-lg font-bold text-foreground tracking-tight mb-5">Recent Orders</h2>
          <div className="surface-card rounded-xl overflow-hidden">
            {orders.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">No orders yet.</div>
            ) : (
              <>
                <div className="hidden sm:grid grid-cols-[1fr_2fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-foreground/5">
                  {['Date', 'Description', 'Amount', 'Status', ''].map((h) => (
                    <span key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</span>
                  ))}
                </div>
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="grid sm:grid-cols-[1fr_2fr_auto_auto_auto] gap-2 sm:gap-4 px-5 py-4 border-b border-foreground/5 last:border-0 items-center">
                    <span className="text-sm text-muted-foreground font-mono">{formatDate(order.createdAt)}</span>
                    <span className="text-sm text-foreground">{order.description}</span>
                    <span className="text-sm text-foreground font-mono">{formatAmount(order.amount, order.currency)}</span>
                    <span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        order.status === 'paid' ? 'bg-secondary/15 text-secondary' : 'bg-foreground/10 text-muted-foreground'
                      }`}>
                        {order.status === 'paid' ? 'Paid' : order.status}
                      </span>
                    </span>
                    {order.hostedUrl ? (
                      <a href={order.hostedUrl} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink size={13} />
                      </a>
                    ) : <span />}
                  </div>
                ))}
              </>
            )}
          </div>
          {orders.length > 5 && (
            <div className="mt-4">
              <Link href="/dashboard/orders" className="text-xs text-primary hover:underline font-medium">View all orders →</Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import DashboardNav from '@/components/site/DashboardNav'

interface User { display_name?: string; email?: string }
interface Order {
  id: number
  number: string
  status: string
  amount: number
  currency: string
  description: string
  pdfUrl: string | null
  hostedUrl: string | null
  createdAt: string
}

const statusStyles: Record<string, string> = {
  paid: 'bg-secondary/15 text-secondary',
  open: 'bg-primary/20 text-primary',
  void: 'bg-muted/30 text-muted-foreground',
  uncollectible: 'bg-destructive/15 text-destructive',
}

export default function OrdersPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/login'); return }
    setUser(JSON.parse(userStr))
    fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.success) setOrders(data.orders) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [router])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-EU', { style: 'currency', currency }).format(amount)

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
          transition={{ duration: 0.4 }} className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-1">Orders</h1>
          <p className="text-sm text-muted-foreground">Your one-time purchase history.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }} className="surface-card rounded-xl overflow-hidden">
          {orders.length > 0 ? (
            <>
              {/* Desktop */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-[1fr_1.5fr_0.8fr_0.8fr_0.6fr] gap-4 px-6 py-3 border-b border-foreground/5">
                  {['Date', 'Product', 'Amount', 'Status', 'Invoice'].map((h) => (
                    <span key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</span>
                  ))}
                </div>
                {orders.map((order, i) => (
                  <div key={order.id}
                    className={`grid grid-cols-[1fr_1.5fr_0.8fr_0.8fr_0.6fr] gap-4 px-6 py-4 hover:bg-foreground/[0.02] transition-colors ${i < orders.length - 1 ? 'border-b border-foreground/5' : ''}`}>
                    <span className="text-sm text-muted-foreground font-mono">{formatDate(order.createdAt)}</span>
                    <span className="text-sm text-foreground">{order.description}</span>
                    <span className="text-sm text-foreground font-mono">{formatAmount(order.amount, order.currency)}</span>
                    <span><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyles[order.status] ?? ''}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span></span>
                    {order.pdfUrl ? (
                      <button onClick={() => window.open(order.pdfUrl!, '_blank')}
                        className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                        <Download size={12} /> PDF
                      </button>
                    ) : order.hostedUrl && order.status === 'open' ? (
                      <button onClick={() => window.open(order.hostedUrl!, '_blank')}
                        className="text-xs text-primary hover:underline font-medium">Pay</button>
                    ) : <span />}
                  </div>
                ))}
              </div>

              {/* Mobile */}
              <div className="sm:hidden divide-y divide-foreground/5">
                {orders.map((order) => (
                  <div key={order.id} className="p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{order.description}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyles[order.status] ?? ''}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">{formatDate(order.createdAt)}</span>
                      <span className="text-sm text-foreground font-mono">{formatAmount(order.amount, order.currency)}</span>
                    </div>
                    {order.pdfUrl && (
                      <button onClick={() => window.open(order.pdfUrl!, '_blank')}
                        className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                        <Download size={12} /> Download Invoice
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted/20 border border-foreground/10 flex items-center justify-center">
                <Download size={20} className="text-muted-foreground" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">No orders yet</h3>
              <p className="text-sm text-muted-foreground mb-6">One-time plugin purchases will appear here.</p>
              <Link href="/products"
                className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:brightness-110 transition text-sm">
                Browse Plugins
              </Link>
            </div>
          )}
        </motion.div>
      </div>

      <footer className="border-t border-foreground/5 py-6">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
          <p className="text-xs text-muted-foreground">© 2026 Hardwave Studios</p>
        </div>
      </footer>
    </div>
  )
}

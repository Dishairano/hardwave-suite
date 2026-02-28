'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { FileText, Download } from 'lucide-react'
import DashboardNav from '@/components/site/DashboardNav'

interface User { display_name?: string; email?: string }
interface Invoice {
  id: number
  number: string
  status: string
  amount: number
  currency: string
  description: string
  pdfUrl: string | null
  hostedUrl: string | null
  paidAt: string | null
  periodStart: string
  periodEnd: string
  createdAt: string
}

const statusStyles: Record<string, string> = {
  paid: 'bg-secondary/15 text-secondary',
  open: 'bg-primary/20 text-primary',
  void: 'bg-muted/30 text-muted-foreground',
  draft: 'bg-accent/15 text-accent',
  uncollectible: 'bg-destructive/15 text-destructive',
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/login'); return }
    setUser(JSON.parse(userStr))
    fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.success) setInvoices(data.invoices) })
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
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-1">Invoices</h1>
          <p className="text-sm text-muted-foreground">Download invoices for your purchases and subscription payments.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }} className="surface-card rounded-xl overflow-hidden">
          {invoices.length > 0 ? (
            <>
              {/* Desktop */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-[0.8fr_0.8fr_1.5fr_0.7fr_0.6fr_0.8fr] gap-4 px-6 py-3 border-b border-foreground/5">
                  {['Invoice #', 'Date', 'Description', 'Amount', 'Status', 'Action'].map((h) => (
                    <span key={h} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</span>
                  ))}
                </div>
                {invoices.map((inv, i) => (
                  <div key={inv.id}
                    className={`grid grid-cols-[0.8fr_0.8fr_1.5fr_0.7fr_0.6fr_0.8fr] gap-4 px-6 py-4 hover:bg-foreground/[0.02] transition-colors ${i < invoices.length - 1 ? 'border-b border-foreground/5' : ''}`}>
                    <span className="text-sm text-foreground font-mono">{inv.number || `INV-${inv.id}`}</span>
                    <span className="text-sm text-muted-foreground font-mono">{formatDate(inv.createdAt)}</span>
                    <span className="text-sm text-foreground truncate">{inv.description || 'Hardwave Subscription'}</span>
                    <span className="text-sm text-foreground font-mono">{formatAmount(inv.amount, inv.currency)}</span>
                    <span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyles[inv.status] ?? ''}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </span>
                    <div className="flex gap-2">
                      {inv.pdfUrl && (
                        <button onClick={() => window.open(inv.pdfUrl!, '_blank')}
                          className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                          <Download size={12} /> PDF
                        </button>
                      )}
                      {inv.hostedUrl && inv.status === 'open' && (
                        <button onClick={() => window.open(inv.hostedUrl!, '_blank')}
                          className="text-xs text-primary hover:underline font-medium">Pay</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile */}
              <div className="sm:hidden divide-y divide-foreground/5">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">{inv.number || `INV-${inv.id}`}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyles[inv.status] ?? ''}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{inv.description || 'Hardwave Subscription'}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">{formatDate(inv.createdAt)}</span>
                      <span className="text-sm text-foreground font-mono">{formatAmount(inv.amount, inv.currency)}</span>
                    </div>
                    {inv.pdfUrl && (
                      <button onClick={() => window.open(inv.pdfUrl!, '_blank')}
                        className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                        <Download size={12} /> Download PDF
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted/20 border border-foreground/10 flex items-center justify-center">
                <FileText size={20} className="text-muted-foreground" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">No invoices yet</h3>
              <p className="text-sm text-muted-foreground">Invoices for purchases and subscription payments will appear here.</p>
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

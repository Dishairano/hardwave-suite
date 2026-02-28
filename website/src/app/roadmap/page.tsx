'use client'

import { motion } from 'framer-motion'
import { HelpCircle } from 'lucide-react'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const columns = [
  {
    title: 'Shipped',
    color: 'bg-secondary',
    items: [
      {
        name: 'Hardwave Analyser v0.4.x',
        desc: 'Full-resolution FFT spectrum, stereo metering, phase correlation. Embedded VST webview.',
        badge: 'Available Now',
        badgeClass: 'bg-secondary/15 text-secondary',
        muted: false,
      },
    ],
  },
  {
    title: 'In Progress',
    color: 'bg-primary',
    items: [
      {
        name: 'Website Redesign',
        desc: 'New marketing site, client dashboard, and purchase flow.',
        badge: 'In Progress',
        badgeClass: 'bg-primary/20 text-primary',
        muted: false,
      },
    ],
  },
  {
    title: 'Planned',
    color: 'bg-accent',
    items: [
      {
        name: 'Hardwave Suite Auto-Installer',
        desc: 'Automatic plugin detection and installation via the Suite desktop app.',
        badge: 'Planned',
        badgeClass: 'bg-accent/15 text-accent',
        muted: false,
      },
      {
        name: 'Second Plugin — TBA',
        desc: 'Details coming soon.',
        badge: 'TBA',
        badgeClass: 'bg-muted/30 text-muted-foreground',
        muted: true,
      },
    ],
  },
]

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-32 sm:pt-40 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }} className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-foreground/10 bg-surface mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Updated February 2026</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-foreground mb-4">
            <span className="gradient-text-brand">Roadmap</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            What we&apos;re building and what&apos;s coming next.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {columns.map((col, ci) => (
            <motion.div key={col.title}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: ci * 0.1 }}>
              <div className="mb-4">
                <div className={`h-[3px] ${col.color} rounded-full mb-3`} />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{col.title}</h2>
              </div>
              <div className="space-y-4">
                {col.items.map((item) => (
                  <div key={item.name}
                    className={`surface-card rounded-xl p-5 transition-all duration-300 ${item.muted ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-foreground">{item.name}</h3>
                      {item.muted && <HelpCircle size={14} className="text-muted-foreground shrink-0 mt-0.5" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{item.desc}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeClass}`}>{item.badge}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="surface-card rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground flex-1">Have a feature request or idea? Join the Discord and let us know.</p>
          <a href="#"
            className="inline-flex items-center justify-center font-semibold border border-foreground/20 text-foreground px-6 py-2.5 rounded-md hover:border-foreground/40 transition text-sm shrink-0">
            Join Discord
          </a>
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}

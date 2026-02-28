'use client'

import { motion } from 'framer-motion'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const typeBadge: Record<string, string> = {
  Feature: 'bg-secondary/15 text-secondary',
  Fix: 'bg-destructive/15 text-destructive',
  Improvement: 'bg-accent/15 text-accent',
  Breaking: 'bg-primary/15 text-primary',
}

const entries = [
  {
    version: 'v0.4.22',
    date: 'February 2026',
    product: 'Hardwave Analyser',
    types: ['Fix', 'Improvement'],
    changes: [
      { type: 'Fix', text: 'Corrected Hann window amplitude scale — tones now read correctly at 0dBFS' },
      { type: 'Improvement', text: 'High-frequency bands now use RMS power averaging instead of peak-of-bins — matches SPAN-quality accuracy' },
    ],
  },
  {
    version: 'v0.4.21',
    date: 'February 2026',
    product: 'Hardwave Analyser',
    types: ['Feature'],
    changes: [
      { type: 'Feature', text: 'Upgraded to full-resolution 2048-bin FFT — SPAN-quality spectrum display' },
      { type: 'Feature', text: 'Backward-compatible with older binary versions' },
    ],
  },
  {
    version: 'v0.4.20',
    date: 'February 2026',
    product: 'Hardwave Analyser',
    types: ['Feature', 'Improvement'],
    changes: [
      { type: 'Feature', text: 'Smooth Catmull-Rom spectrum curves' },
      { type: 'Improvement', text: 'Per-frame meter updates — peak and RMS now update every frame' },
      { type: 'Feature', text: 'Tabbed bottom panel with always 2-column analyser layout' },
    ],
  },
]

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pt-32 sm:pt-40 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground mb-3">
            <span className="gradient-text-brand">Changelog</span>
          </h1>
          <p className="text-lg text-muted-foreground">Every update, every fix, every improvement.</p>
          <div className="h-[2px] mt-6 rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }} />
        </motion.div>

        <div className="relative pl-6 sm:pl-8 border-l border-foreground/10">
          {entries.map((entry, i) => (
            <motion.div key={entry.version}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative mb-10 last:mb-0">
              <div className={`absolute -left-[calc(1.5rem+5px)] sm:-left-[calc(2rem+5px)] top-1 w-2.5 h-2.5 rounded-full border-2 border-background ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
              <div className={`surface-card rounded-xl p-5 sm:p-6 ${i === 0 ? 'ring-1 ring-primary/20' : ''}`}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-base font-black tracking-tight text-foreground">{entry.version}</span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{entry.product}</span>
                  {entry.types.map((t) => (
                    <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeBadge[t] ?? ''}`}>{t}</span>
                  ))}
                </div>
                <ul className="space-y-2">
                  {entry.changes.map((c, ci) => (
                    <li key={ci} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${typeBadge[c.type] ?? ''}`}>{c.type}</span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  )
}

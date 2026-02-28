'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Activity, Download, Lock } from 'lucide-react'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const barHeights = [40, 55, 75, 90, 100, 95, 80, 65, 50, 70, 85, 95, 78, 60, 45, 35, 55, 70, 50, 30]
const tags1 = ['Spectrum', 'Stereo Meter', 'Phase', 'Peak/RMS', 'VST3', 'CLAP']
const tags2 = ['Auto Installer', 'License Manager', 'Windows', 'macOS']

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-32 pb-8 sm:pt-40 sm:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-foreground mb-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            The <span className="gradient-text-brand">Plugins</span>
          </motion.h1>
          <motion.p className="text-lg text-muted-foreground max-w-xl mx-auto"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            Professional tools built for harder styles producers.
          </motion.p>
        </div>
      </section>

      {/* Product Cards */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          {/* Analyser */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="surface-card rounded-2xl overflow-hidden hover:glow-orange transition-all duration-300">
            <div className="grid md:grid-cols-[2fr_3fr]">
              <div className="bg-foreground/[0.02] border-b md:border-b-0 md:border-r border-foreground/5 relative min-h-[200px] flex items-end justify-center gap-[3px] px-6 pb-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
                {barHeights.map((h, i) => (
                  <motion.div key={i} className="w-2 sm:w-3 rounded-t-sm"
                    style={{ background: 'linear-gradient(to top, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))', opacity: 0.7 + (h / 100) * 0.3 }}
                    initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.03, ease: 'easeOut' }} />
                ))}
              </div>
              <div className="p-6 sm:p-8 lg:p-10 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/20 text-primary">Available Now</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-1">Hardwave Analyser</h2>
                <p className="text-sm text-primary font-medium mb-4">See your mix exactly as it is.</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  All-in-one spectrum analyser with full-resolution FFT, stereo metering, phase correlation, and a live VST webview embedded directly in your DAW. No separate window, no Alt+Tab.
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {tags1.map((tag) => (
                    <span key={tag} className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-foreground/10 text-muted-foreground">{tag}</span>
                  ))}
                </div>
                <div className="mb-6">
                  <span className="text-2xl font-black text-foreground">€29.99</span>
                  <span className="text-sm text-muted-foreground ml-2">one-time</span>
                  <p className="text-xs text-muted-foreground mt-1">or from €12.49/mo with subscription</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                  <Link href="/register" className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-6 py-3 rounded-md hover:brightness-110 transition text-sm">Buy Now</Link>
                  <Link href="/products/analyser" className="inline-flex items-center justify-center font-semibold border border-foreground/20 text-foreground px-6 py-3 rounded-md hover:border-foreground/40 transition text-sm">Learn More</Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Suite */}
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="surface-card rounded-2xl overflow-hidden hover:glow-accent transition-all duration-300">
            <div className="grid md:grid-cols-[2fr_3fr]">
              <div className="bg-foreground/[0.02] border-b md:border-b-0 md:border-r border-foreground/5 relative min-h-[200px] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
                <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="relative">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center">
                    <Download size={40} className="text-accent" />
                  </div>
                  <div className="absolute -inset-4 rounded-3xl border border-accent/10 animate-pulse" />
                  <div className="absolute -inset-8 rounded-[2rem] border border-accent/5" />
                </motion.div>
              </div>
              <div className="p-6 sm:p-8 lg:p-10 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary/15 text-secondary">Free</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground mb-1">Hardwave Suite</h2>
                <p className="text-sm text-accent font-medium mb-4">Your plugin manager.</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  The free desktop app that manages and auto-installs all your Hardwave plugins. Buy or subscribe on the website — the Suite handles the rest automatically.
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {tags2.map((tag) => (
                    <span key={tag} className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-foreground/10 text-muted-foreground">{tag}</span>
                  ))}
                </div>
                <div className="mb-6">
                  <span className="text-2xl font-black text-foreground">Free</span>
                  <span className="text-sm text-muted-foreground ml-2">— always</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                  <Link href="/downloads" className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-6 py-3 rounded-md hover:brightness-110 transition text-sm">Download Free</Link>
                  <Link href="/products/suite" className="inline-flex items-center justify-center font-semibold border border-foreground/20 text-foreground px-6 py-3 rounded-md hover:border-foreground/40 transition text-sm">Learn More</Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground mb-2">More Coming Soon</h2>
            <p className="text-sm text-muted-foreground">Subscribe now and get every plugin we ship, automatically.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="surface-card rounded-2xl p-8 sm:p-10 max-w-2xl mx-auto relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center justify-center text-center py-6">
              <div className="w-16 h-16 rounded-full bg-muted/20 border border-foreground/10 flex items-center justify-center mb-5">
                <Lock size={24} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Next Plugin — TBA</h3>
              <p className="text-sm text-muted-foreground">Details coming soon.</p>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.2 }} className="text-center mt-8">
            <Link href="/pricing" className="inline-flex items-center justify-center font-semibold border border-foreground/20 text-foreground px-6 py-3 rounded-md hover:border-foreground/40 transition text-sm">
              View Subscription
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

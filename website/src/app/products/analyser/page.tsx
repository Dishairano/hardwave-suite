'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { BarChart3, Monitor, Headphones, Radio, TrendingUp, Timer } from 'lucide-react'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const barHeights = [25, 40, 60, 80, 95, 100, 92, 78, 88, 100, 90, 72, 58, 75, 85, 95, 80, 65, 50, 70, 82, 90, 75, 55, 40, 60, 78, 88, 70, 48, 35, 55, 68, 45, 30]

const features = [
  { icon: <BarChart3 size={22} className="text-primary" />, title: 'Full-Resolution FFT', desc: '2048-bin spectrum at up to 20kHz. SPAN-quality resolution inside your DAW.' },
  { icon: <Monitor size={22} className="text-accent" />, title: 'Embedded VST Webview', desc: 'The analyser UI loads directly inside the DAW plugin window. No external windows.' },
  { icon: <Headphones size={22} className="text-secondary" />, title: 'Stereo Metering', desc: 'Peak, RMS, true peak, and crest factor for left and right channels independently.' },
  { icon: <Radio size={22} className="text-primary" />, title: 'Phase Correlation', desc: 'Real-time phase correlation meter and per-band stereo width display.' },
  { icon: <TrendingUp size={22} className="text-accent" />, title: 'Smooth Curves', desc: 'Catmull-Rom interpolated spectrum curves with configurable smoothing (Fast / Medium / Slow).' },
  { icon: <Timer size={22} className="text-secondary" />, title: 'Peak Hold', desc: 'Configurable peak hold with slow decay. Catch transients you\'d otherwise miss.' },
]

const specs = [
  { label: 'Format', value: 'VST3, CLAP' },
  { label: 'Platform', value: 'Windows, macOS (Linux coming)' },
  { label: 'FFT Size', value: '4096 points (2048 bins)' },
  { label: 'Frequency Range', value: '20Hz — 20kHz' },
  { label: 'Display Bands', value: '256 log-spaced' },
  { label: 'Tilt', value: 'Flat, -3dB/oct, -4.5dB/oct' },
  { label: 'Weighting', value: 'Flat, A-weighted, C-weighted' },
  { label: 'DAWs tested', value: 'FL Studio, Ableton, Bitwig, Reaper' },
]

export default function AnalyserPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-0 w-[600px] h-[500px] opacity-20">
            <div className="w-full h-full flex items-end justify-center gap-[2px]">
              {barHeights.map((h, i) => (
                <motion.div key={i} className="w-3 rounded-t-sm"
                  style={{ background: 'linear-gradient(to top, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}
                  initial={{ height: 0 }} animate={{ height: `${h}%` }}
                  transition={{ duration: 0.8, delay: i * 0.03, ease: 'easeOut' }} />
              ))}
            </div>
          </div>
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-accent/6 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-primary/20 text-primary mb-6">
              Available Now
            </span>
          </motion.div>

          <motion.h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter text-foreground leading-[0.95] mb-4"
            initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            Hardwave <span className="gradient-text-brand">Analyser</span>
          </motion.h1>

          <motion.p className="text-xl sm:text-2xl text-muted-foreground font-medium tracking-tight mb-5 max-w-2xl"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            Professional spectrum analysis. Embedded in your DAW.
          </motion.p>

          <motion.p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mb-8"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            Full-resolution FFT spectrum, stereo metering, phase correlation, and peak/RMS — all in a single VST3/CLAP plugin. The analyser UI loads directly inside your DAW window. No separate app, no Alt+Tab.
          </motion.p>

          <motion.div className="flex flex-col sm:flex-row gap-3 mb-4"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            <Link href="/register"
              className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-8 py-3 rounded-md hover:brightness-110 transition text-sm">
              Buy Now — €29.99
            </Link>
            <Link href="/pricing"
              className="inline-flex items-center justify-center font-semibold border border-foreground/20 text-foreground px-8 py-3 rounded-md hover:border-foreground/40 transition text-sm">
              Subscribe from €12.49/mo
            </Link>
          </motion.div>

          <motion.p className="text-xs text-muted-foreground"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.5 }}>
            Or get it free with a yearly subscription — €99.99/yr
          </motion.p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-12 text-center"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            Everything You Need
          </motion.h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="surface-card surface-card-hover rounded-xl p-6 transition-all duration-300 hover:glow-orange">
                <div className="p-2.5 rounded-lg bg-foreground/5 w-fit mb-4">{f.icon}</div>
                <h3 className="text-sm font-bold text-foreground mb-2 tracking-tight">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Specs */}
      <section className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-10 text-center"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            Technical Details
          </motion.h2>
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }} className="surface-card rounded-xl overflow-hidden">
            {specs.map((spec, i) => (
              <div key={spec.label}
                className={`flex items-start sm:items-center justify-between gap-4 px-6 py-4 ${i < specs.length - 1 ? 'border-b border-foreground/5' : ''}`}>
                <span className="text-sm text-muted-foreground shrink-0">{spec.label}</span>
                <span className="text-sm text-foreground font-mono text-right">{spec.value}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5 }} className="surface-card rounded-xl p-6 sm:p-8 flex flex-col">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Buy Once</p>
              <div className="mb-2">
                <span className="text-4xl font-black text-foreground">€29.99</span>
                <span className="text-sm text-muted-foreground ml-2">one-time</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8 flex-1">Yours forever. Includes all future updates.</p>
              <Link href="/register"
                className="inline-flex items-center justify-center w-full font-semibold bg-primary text-primary-foreground px-6 py-3 rounded-md hover:brightness-110 transition text-sm">
                Buy Now
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative rounded-xl p-[1px] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
              <div className="bg-surface rounded-xl p-6 sm:p-8 flex flex-col h-full">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Subscribe</p>
                <div className="mb-2">
                  <span className="text-4xl font-black text-foreground">€12.49</span>
                  <span className="text-sm text-muted-foreground ml-2">/ month</span>
                </div>
                <p className="text-sm text-muted-foreground mb-8 flex-1">Includes all current and future Hardwave plugins.</p>
                <Link href="/pricing"
                  className="inline-flex items-center justify-center w-full font-semibold border border-foreground/20 text-foreground px-6 py-3 rounded-md hover:border-foreground/40 transition text-sm">
                  View Subscription
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

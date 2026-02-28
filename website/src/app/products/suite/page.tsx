'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Download, Monitor, Zap, RefreshCw, KeyRound } from 'lucide-react'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const steps = [
  { num: '01', title: 'Download the Suite', desc: 'Install the free Hardwave Suite app on your machine. Takes less than a minute.' },
  { num: '02', title: 'Buy or Subscribe', desc: 'Purchase individual plugins or start a subscription on hardwavestudios.com.' },
  { num: '03', title: 'Auto-Install', desc: 'Open the Suite. It detects your license and installs your plugins automatically. Done.' },
]

const features = [
  { icon: <Zap size={22} className="text-primary" />, title: 'Auto VST Installer', desc: 'Detects your purchased or subscribed plugins and installs them without any manual steps.' },
  { icon: <RefreshCw size={22} className="text-accent" />, title: 'Automatic Updates', desc: 'The Suite keeps your plugins up to date. New version? It installs it for you.' },
  { icon: <KeyRound size={22} className="text-secondary" />, title: 'License Management', desc: 'See exactly which plugins you own or have access to through your subscription.' },
  { icon: <Monitor size={22} className="text-primary" />, title: 'Multi-Platform', desc: 'Available for Windows and macOS. Linux support coming.' },
]

export default function SuitePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/8 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/6 w-[300px] h-[300px] rounded-full bg-accent/5 blur-[100px]" />
        </div>

        <div className="absolute top-1/4 right-[10%] hidden lg:flex items-center justify-center pointer-events-none">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }} className="relative">
            <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center">
              <Download size={56} className="text-accent" />
            </div>
            <div className="absolute -inset-5 rounded-[2rem] border border-accent/10 animate-pulse" />
            <div className="absolute -inset-10 rounded-[2.5rem] border border-accent/5" />
          </motion.div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-secondary/15 text-secondary mb-6">
              Free — Always
            </span>
          </motion.div>

          <motion.h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter text-foreground leading-[0.95] mb-4"
            initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            Hardwave <span className="gradient-text-brand">Suite</span>
          </motion.h1>

          <motion.p className="text-xl sm:text-2xl text-muted-foreground font-medium tracking-tight mb-5 max-w-2xl"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            Your plugin manager. Download once, stay up to date forever.
          </motion.p>

          <motion.p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mb-8"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            Hardwave Suite is the free desktop app that manages all your Hardwave plugins. Buy or subscribe on the website — the Suite detects your license and installs everything automatically. No manual downloads, no digging through release pages.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }} className="mb-3">
            <Link href="/downloads"
              className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-10 py-3.5 rounded-md hover:brightness-110 transition text-sm">
              Download Free
            </Link>
          </motion.div>

          <motion.p className="text-xs text-muted-foreground"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.5 }}>
            Windows & macOS — No account required to download
          </motion.p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-14 text-center"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            How It Works
          </motion.h2>
          <div className="relative grid md:grid-cols-3 gap-8 md:gap-6">
            <div className="hidden md:block absolute top-8 left-[16.67%] right-[16.67%] h-[1px] bg-gradient-to-r from-primary/30 via-secondary/30 to-accent/30" />
            {steps.map((step, i) => (
              <motion.div key={step.num}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative text-center">
                <div className="relative z-10 w-16 h-16 mx-auto mb-5 rounded-full bg-surface border border-foreground/10 flex items-center justify-center">
                  <span className="text-sm font-black gradient-text-brand">{step.num}</span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-2 tracking-tight">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-12 text-center"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            What&apos;s Included
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="surface-card surface-card-hover rounded-xl p-6 transition-all duration-300 hover:glow-accent">
                <div className="p-2.5 rounded-lg bg-foreground/5 w-fit mb-4">{f.icon}</div>
                <h3 className="text-sm font-bold text-foreground mb-2 tracking-tight">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-2xl p-[1px] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
            <div className="bg-surface rounded-2xl p-8 sm:p-12 text-center">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-3">
                Download Hardwave Suite
              </h2>
              <p className="text-muted-foreground mb-8">Free. No account required. No trial.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
                <Link href="/downloads"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto font-semibold bg-primary text-primary-foreground px-8 py-3 rounded-md hover:brightness-110 transition text-sm">
                  <Monitor size={16} />
                  Download for Windows
                </Link>
                <Link href="/downloads"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto font-semibold bg-primary text-primary-foreground px-8 py-3 rounded-md hover:brightness-110 transition text-sm">
                  Download for macOS
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-foreground hover:text-primary transition-colors underline underline-offset-2">
                  Sign in
                </Link>{' '}
                to sync your licenses automatically.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

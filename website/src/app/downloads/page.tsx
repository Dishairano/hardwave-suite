'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Download, Monitor, Info } from 'lucide-react'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const steps = [
  { num: '01', title: 'Download the Suite', desc: 'Install the free Hardwave Suite app. This is your plugin manager.' },
  { num: '02', title: 'Get your plugins', desc: 'Buy individual plugins or subscribe at hardwavestudios.com. Your license is tied to your account.' },
  { num: '03', title: 'Open the Suite', desc: 'The Suite detects your license and installs your plugins automatically. No manual downloads needed for VSTs.' },
]

export default function DownloadsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-32 pb-8 sm:pt-40 sm:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <motion.h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-foreground mb-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="gradient-text-brand">Downloads</span>
          </motion.h1>
          <motion.p className="text-lg text-muted-foreground max-w-xl mx-auto"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            Get the free Hardwave Suite app to manage and install your plugins.
          </motion.p>
        </div>
      </section>

      {/* Main Download Card */}
      <section className="py-8 sm:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative rounded-2xl p-[1px] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
            <div className="bg-surface rounded-2xl p-8 sm:p-10 lg:p-12">
              <div className="grid md:grid-cols-[auto_1fr] gap-8 items-center">
                <div className="flex justify-center md:justify-start">
                  <div className="relative">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center">
                      <Download size={44} className="text-accent" />
                    </div>
                    <div className="absolute -inset-3 rounded-[1.75rem] border border-accent/10 animate-pulse" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Hardwave Suite</h2>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-secondary/15 text-secondary">Free</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 font-mono">Latest version</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-lg">
                    The desktop app that manages and auto-installs all your Hardwave plugins. Required to use any Hardwave VST.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <a href="/api/download-file/hardwave-suite-0.5.7-linux-amd64.deb"
                      className="inline-flex items-center justify-center gap-2 font-semibold bg-primary text-primary-foreground px-8 py-3 rounded-md hover:brightness-110 transition text-sm">
                      <Monitor size={16} />
                      Download for Linux (.deb)
                    </a>
                    <a href="#"
                      className="inline-flex items-center justify-center gap-2 font-semibold border border-foreground/20 text-foreground/40 px-8 py-3 rounded-md cursor-not-allowed text-sm"
                      title="Windows build coming soon">
                      Windows — Coming Soon
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No account required · Linux (Ubuntu/Debian) · Windows build in progress
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground mb-14 text-center"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            How plugin downloads work
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

      {/* Plugin Downloads Note */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="surface-card rounded-xl p-6 sm:p-8 flex gap-4 items-start">
            <div className="p-2 rounded-lg bg-accent/10 shrink-0">
              <Info size={18} className="text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                VST plugins are not available as direct downloads. They are installed automatically through the Hardwave Suite app after purchase or subscription.
              </p>
              <Link href="/products/suite" className="text-sm text-foreground hover:text-primary transition-colors font-medium">
                Learn more about the Suite →
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

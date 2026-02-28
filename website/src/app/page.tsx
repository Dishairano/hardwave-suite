'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Activity, Download } from 'lucide-react'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const products = [
  {
    name: 'Hardwave Analyser',
    tag: 'Available Now',
    tagColor: 'bg-primary/20 text-primary',
    icon: <Activity size={28} className="text-primary" />,
    description: 'All-in-one spectrum analyser with stereo metering, phase correlation, and live VST webview. See your mix exactly as it is.',
    price: '€29.99',
    sub: 'or from €12.49/mo',
    cta: 'Learn More',
    href: '/products/analyser',
    hoverGlow: 'hover:glow-orange',
  },
  {
    name: 'Hardwave Suite',
    tag: 'Free',
    tagColor: 'bg-secondary/15 text-secondary',
    icon: <Download size={28} className="text-accent" />,
    description: 'The desktop app that manages and installs all your Hardwave plugins automatically.',
    price: 'Free',
    sub: null,
    cta: 'Download Free',
    href: '/products/suite',
    hoverGlow: 'hover:glow-accent',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] animate-[float_6s_ease-in-out_infinite]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[120px] animate-[float-slow_8s_ease-in-out_infinite]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-secondary/5 blur-[100px] animate-[float_6s_ease-in-out_infinite]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-foreground/10 bg-surface mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground tracking-wide">Built by Resonance Of Mayhem</span>
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter text-foreground leading-[0.95] mb-6"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
            Professional Tools for{' '}
            <span className="gradient-text-brand">Harder Styles</span>{' '}
            Producers
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}>
            Spectrum analysis, mixing tools, and more — built by a producer who actually uses them.
          </motion.p>

          <motion.div className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
            <Link href="/products" className="w-full sm:w-auto text-center font-semibold bg-primary text-primary-foreground px-8 py-3 rounded-md hover:brightness-110 transition text-sm">
              Browse Plugins
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto text-center font-semibold border border-foreground/20 text-foreground px-8 py-3 rounded-md hover:border-foreground/40 transition text-sm">
              View Pricing
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground">The Plugins</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {products.map((product, i) => (
              <motion.div key={product.name}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.15 }}
                className={`surface-card surface-card-hover rounded-xl p-6 sm:p-8 flex flex-col transition-all duration-300 ${product.hoverGlow}`}>
                <div className="flex items-start justify-between mb-6">
                  <div className="p-3 rounded-lg bg-foreground/5">{product.icon}</div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${product.tagColor}`}>{product.tag}</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-foreground mb-3">{product.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{product.description}</p>
                <div className="mb-6">
                  <span className="text-2xl font-black text-foreground">{product.price}</span>
                  {product.sub && <span className="text-sm text-muted-foreground ml-2">{product.sub}</span>}
                </div>
                <Link href={product.href} className="inline-flex items-center justify-center w-full font-semibold bg-primary text-primary-foreground px-6 py-3 rounded-md hover:brightness-110 transition text-sm">
                  {product.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscription Banner */}
      <section id="pricing" className="py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="relative rounded-2xl p-[1px] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
            <div className="bg-surface rounded-2xl p-8 sm:p-12">
              <div className="text-center mb-10">
                <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-4">Get Everything We Build</h2>
                <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  One subscription covers all current and future Hardwave plugins. Support the development and get every plugin as it drops.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
                <div className="surface-card rounded-xl p-5 text-center hover:border-primary/30 transition-colors cursor-pointer">
                  <p className="text-sm text-muted-foreground mb-1">Monthly</p>
                  <p className="text-2xl font-black text-foreground">€12.49</p>
                  <p className="text-xs text-muted-foreground">/ month</p>
                </div>
                <div className="surface-card rounded-xl p-5 text-center border-primary/30 hover:border-primary/50 transition-colors cursor-pointer relative">
                  <span className="absolute -top-2.5 right-3 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Save 33%</span>
                  <p className="text-sm text-muted-foreground mb-1">Yearly</p>
                  <p className="text-2xl font-black text-foreground">€99.99</p>
                  <p className="text-xs text-muted-foreground">/ year</p>
                </div>
              </div>
              <div className="text-center">
                <Link href="/pricing" className="inline-flex items-center justify-center font-semibold bg-primary text-primary-foreground px-8 py-3 rounded-md hover:brightness-110 transition text-sm">
                  Start Subscription
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 sm:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-6">Built by a Producer, for Producers</h2>
            <p className="text-muted-foreground leading-relaxed text-lg max-w-2xl mx-auto">
              I&apos;m Resonance Of Mayhem. I&apos;ve been producing hardstyle and hardcore for years. I built these tools because the ones that existed didn&apos;t fit my workflow. No bloat, no subscriptions you don&apos;t need — just tools that work.
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

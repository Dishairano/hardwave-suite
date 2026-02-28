'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Check, Activity } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const features = [
  'All current plugins',
  'All future plugins included',
  'Installed automatically via Hardwave Suite',
  'Cancel anytime',
]

const faqs = [
  { q: 'What happens if I cancel my subscription?', a: 'You lose access to subscription plugins. Plugins you bought individually are yours forever.' },
  { q: 'Do I need an account to use the plugins?', a: 'Yes, an account is required to activate your license. It\'s free to create.' },
  { q: 'How do I install the plugins?', a: 'Download the free Hardwave Suite app. It detects your license and installs everything automatically.' },
  { q: 'What DAWs are supported?', a: 'Any DAW that supports VST3 or CLAP. Tested with FL Studio, Ableton, Bitwig, and Reaper.' },
]

export default function PricingPage() {
  const [yearly, setYearly] = useState(true)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Header */}
      <section className="pt-32 pb-8 sm:pt-40 sm:pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-foreground mb-4"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            Simple <span className="gradient-text-brand">Pricing</span>
          </motion.h1>
          <motion.p className="text-lg text-muted-foreground max-w-xl mx-auto"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            Buy the plugins you need, or get everything with a subscription.
          </motion.p>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div className="flex items-center justify-center gap-3 mb-12"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
            <div className="inline-flex items-center rounded-full bg-surface border border-foreground/10 p-1">
              <button onClick={() => setYearly(false)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!yearly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Monthly
              </button>
              <button onClick={() => setYearly(true)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${yearly ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                Yearly
              </button>
            </div>
            {yearly && (
              <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full">
                Save 33%
              </motion.span>
            )}
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Monthly */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="surface-card rounded-xl p-6 sm:p-8 flex flex-col">
              <p className="text-sm text-muted-foreground font-semibold mb-4">Monthly</p>
              <div className="mb-6">
                <span className="text-4xl font-black text-foreground">€12.49</span>
                <span className="text-sm text-muted-foreground ml-1">/ month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Check size={16} className="text-primary shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="inline-flex items-center justify-center w-full font-semibold border border-foreground/20 text-foreground px-6 py-3 rounded-md hover:border-foreground/40 transition text-sm">
                Start Monthly
              </Link>
            </motion.div>

            {/* Yearly */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
              className="relative rounded-xl p-[1px] overflow-hidden md:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
              <div className="bg-surface rounded-xl p-6 sm:p-8 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground font-semibold">Yearly</p>
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-full">Best Value — Save 33%</span>
                </div>
                <div className="mb-1">
                  <span className="text-4xl font-black text-foreground">€99.99</span>
                  <span className="text-sm text-muted-foreground ml-1">/ year</span>
                </div>
                <p className="text-xs text-muted-foreground mb-6">€8.33 / month</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <Check size={16} className="text-primary shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="inline-flex items-center justify-center w-full font-semibold bg-primary text-primary-foreground px-6 py-3 rounded-md hover:brightness-110 transition text-sm">
                  Start Yearly
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Individual */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground mb-2">Or buy individually</h2>
            <p className="text-sm text-muted-foreground">Own it forever. No subscription required.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="surface-card surface-card-hover rounded-xl p-6 sm:p-8 max-w-md mx-auto transition-all duration-300 hover:glow-orange">
            <div className="flex items-start justify-between mb-5">
              <div className="p-3 rounded-lg bg-foreground/5"><Activity size={24} className="text-primary" /></div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/20 text-primary">Available Now</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight text-foreground mb-2">Hardwave Analyser</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">All-in-one spectrum analyser with stereo metering, phase correlation, and live VST webview.</p>
            <div className="mb-1">
              <span className="text-3xl font-black text-foreground">€29.99</span>
              <span className="text-sm text-muted-foreground ml-2">one-time</span>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Includes all future updates</p>
            <Link href="/register" className="inline-flex items-center justify-center w-full font-semibold bg-primary text-primary-foreground px-6 py-3 rounded-md hover:brightness-110 transition text-sm">
              Buy Now
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <motion.h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-foreground mb-8 text-center"
            initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            Frequently Asked Questions
          </motion.h2>
          <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="surface-card rounded-lg px-5 border-none">
                  <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-4">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

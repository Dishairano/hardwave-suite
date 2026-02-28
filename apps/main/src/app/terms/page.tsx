'use client'

import { motion } from 'framer-motion'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const sections = [
  { title: '1. Acceptance of Terms', content: 'By using hardwavestudios.com or any Hardwave Studios software, you agree to these terms.', list: null },
  { title: '2. Accounts', content: null, list: ['You must provide accurate information when creating an account', 'You are responsible for keeping your credentials secure', 'One account per person'] },
  { title: '3. Licenses', content: null, list: ['Purchased plugins: you receive a non-transferable, non-exclusive license to use the plugin on your own machines', 'Subscription: your license is active as long as your subscription is active; it ends when you cancel', 'You may not resell, redistribute, or reverse-engineer our plugins'] },
  { title: '4. Payments & Refunds', content: null, list: ['Payments are processed by Stripe', 'One-time purchases: refunds available within 14 days if the plugin cannot be installed or activated', 'Subscriptions: cancel anytime; no refunds for the current billing period'] },
  { title: '5. Acceptable Use', content: null, list: ['Our software is for personal music production use', 'You may not use our tools for illegal purposes'] },
  { title: '6. Termination', content: null, list: ['We reserve the right to terminate accounts that violate these terms', 'You may delete your account at any time from dashboard settings'] },
  { title: '7. Limitation of Liability', content: 'Hardwave Studios is not liable for any damages arising from the use or inability to use our software.', list: null },
  { title: '8. Changes to Terms', content: 'We may update these terms. Continued use after changes means you accept the new terms.', list: null },
  { title: '9. Contact', content: 'Questions? Email legal@hardwavestudios.com', list: null },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pt-32 sm:pt-40 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }} className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: February 2026</p>
          <div className="h-[2px] mt-6 rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }} className="space-y-10">
          {sections.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-bold text-foreground tracking-tight mb-3">{s.title}</h2>
              {s.content && <p className="text-base text-muted-foreground leading-[1.8]">{s.content}</p>}
              {s.list && (
                <ul className="space-y-2">
                  {s.list.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-base text-muted-foreground leading-[1.8]">
                      <span className="text-primary mt-[10px] shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}

'use client'

import { motion } from 'framer-motion'
import Navbar from '@/components/site/Navbar'
import Footer from '@/components/site/Footer'

const sections = [
  { title: '1. Introduction', content: "Hardwave Studios ('we', 'us', or 'our') operates hardwavestudios.com. This policy explains what data we collect, how we use it, and your rights.", list: null, after: null },
  { title: '2. Data We Collect', content: null, list: ['Account data: name, email address, password (hashed)', 'Purchase data: order history, license keys (processed via Stripe — we do not store card details)', 'Usage data: login timestamps, download records', 'Technical data: IP address, browser type (for security purposes)'], after: null },
  { title: '3. How We Use Your Data', content: null, list: ['To manage your account and licenses', 'To process payments via Stripe', 'To send transactional emails (receipts, license activations)', 'We do not sell your data to third parties'], after: null },
  { title: '4. Third-Party Services', content: null, list: ['Stripe (payment processing) — stripe.com/privacy', 'We do not use advertising trackers or analytics platforms'], after: null },
  { title: '5. Data Retention', content: null, list: ['Account data is kept as long as your account is active', 'You can request deletion at any time'], after: null },
  { title: '6. Your Rights (GDPR)', content: null, list: ['Right to access, correct, or delete your data'], after: 'Contact: privacy@hardwarestudios.com' },
  { title: '7. Cookies', content: null, list: ['We use only essential cookies for authentication (session token)', 'No tracking or advertising cookies'], after: null },
  { title: '8. Contact', content: 'Questions? Email us at privacy@hardwavestudios.com', list: null, after: null },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 pt-32 sm:pt-40 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }} className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-2">Privacy Policy</h1>
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
              {s.after && <p className="text-base text-muted-foreground leading-[1.8] mt-3">{s.after}</p>}
            </div>
          ))}
        </motion.div>
      </div>

      <Footer />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import DashboardNav from '@/components/site/DashboardNav'

interface User { display_name?: string; email?: string }

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) { router.push('/login'); return }
    const u = JSON.parse(userStr)
    setUser(u)
    setDisplayName(u.display_name || '')
    setEmail(u.email || '')
  }, [router])

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileMsg('')
    try {
      const token = localStorage.getItem('token')
      const r = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, email }),
      })
      const data = await r.json()
      if (r.ok) {
        localStorage.setItem('user', JSON.stringify({ ...user, display_name: displayName, email }))
        setProfileMsg('Saved!')
      } else {
        setProfileMsg(data.error || 'Failed to save')
      }
    } catch { setProfileMsg('An error occurred') }
    finally { setProfileLoading(false) }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMsg('Passwords do not match'); return }
    setPwLoading(true)
    setPwMsg('')
    try {
      const token = localStorage.getItem('token')
      const r = await fetch('/api/account/password', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await r.json()
      if (r.ok) { setPwMsg('Password updated!'); setCurrentPw(''); setNewPw(''); setConfirmPw('') }
      else setPwMsg(data.error || 'Failed to update password')
    } catch { setPwMsg('An error occurred') }
    finally { setPwLoading(false) }
  }

  const inputClass = 'w-full bg-background border border-foreground/10 rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardNav user={user} />

      <div className="flex-1 max-w-[700px] w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-foreground mb-1">Account Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and security.</p>
        </motion.div>

        <div className="space-y-6">
          {/* Profile */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }} className="surface-card rounded-xl p-6 sm:p-8">
            <h2 className="text-base font-bold text-foreground mb-6">Profile</h2>
            <form onSubmit={handleProfileSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Display Name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                <p className="text-[11px] text-muted-foreground mt-1.5">Changing email requires verification.</p>
              </div>
              {profileMsg && (
                <p className={`text-sm ${profileMsg === 'Saved!' ? 'text-secondary' : 'text-destructive'}`}>{profileMsg}</p>
              )}
              <div className="flex justify-end">
                <button type="submit" disabled={profileLoading}
                  className="font-semibold bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:brightness-110 transition text-sm disabled:opacity-60">
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Change Password */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }} className="surface-card rounded-xl p-6 sm:p-8">
            <h2 className="text-base font-bold text-foreground mb-6">Change Password</h2>
            <form onSubmit={handlePasswordChange} className="space-y-5">
              {[
                { label: 'Current password', value: currentPw, set: setCurrentPw, show: showCurrent, toggle: setShowCurrent },
                { label: 'New password', value: newPw, set: setNewPw, show: showNew, toggle: setShowNew },
                { label: 'Confirm new password', value: confirmPw, set: setConfirmPw, show: showConfirm, toggle: setShowConfirm },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
                  <div className="relative">
                    <input type={field.show ? 'text' : 'password'} value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                      className={`${inputClass} pr-10`} placeholder="••••••••" />
                    <button type="button" onClick={() => field.toggle(!field.show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {field.show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
              {pwMsg && (
                <p className={`text-sm ${pwMsg === 'Password updated!' ? 'text-secondary' : 'text-destructive'}`}>{pwMsg}</p>
              )}
              <div className="flex justify-end">
                <button type="submit" disabled={pwLoading}
                  className="font-semibold bg-primary text-primary-foreground px-6 py-2.5 rounded-md hover:brightness-110 transition text-sm disabled:opacity-60">
                  {pwLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Danger Zone */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="rounded-xl border border-destructive/20 bg-surface p-6 sm:p-8">
            <h2 className="text-base font-bold text-foreground mb-4">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-5">Permanently delete your account and all associated data. This cannot be undone.</p>
            <button className="inline-flex items-center justify-center font-semibold border border-destructive/40 text-destructive px-5 py-2.5 rounded-md hover:border-destructive/60 hover:bg-destructive/5 transition text-sm">
              Delete Account
            </button>
          </motion.div>
        </div>
      </div>

      <footer className="border-t border-foreground/5 py-6">
        <div className="max-w-[700px] mx-auto px-4 sm:px-6">
          <p className="text-xs text-muted-foreground">© 2026 Hardwave Studios</p>
        </div>
      </footer>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/site/Navbar'

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: displayName }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      router.push('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <Navbar />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] animate-[float_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/3 right-1/4 w-[350px] h-[350px] rounded-full bg-accent/5 blur-[100px] animate-[float-slow_8s_ease-in-out_infinite]" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-24 sm:py-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }} className="w-full max-w-[440px]">
          <div className="rounded-2xl p-[1px] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, hsl(39 100% 50%), hsl(120 100% 50%), hsl(174 71% 56%))' }}>
            <div className="bg-surface rounded-2xl p-8 sm:p-10">
              <div className="flex justify-center mb-8">
                <div className="w-10 h-10 bg-primary rotate-45 rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 bg-background rotate-45 rounded-[2px]" />
                </div>
              </div>

              <h1 className="text-2xl font-black tracking-tight text-foreground text-center mb-2">Create your account</h1>
              <p className="text-sm text-muted-foreground text-center mb-8">Free to join. Required to activate your licenses.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Display name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
                    className="w-full bg-background border border-foreground/10 rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition"
                    placeholder="Resonance Of Mayhem" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full bg-background border border-foreground/10 rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition"
                    placeholder="you@example.com" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                      className="w-full bg-background border border-foreground/10 rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition pr-10"
                      placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">At least 8 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Confirm password</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                      className="w-full bg-background border border-foreground/10 rounded-md px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition pr-10"
                      placeholder="••••••••" />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full font-semibold bg-primary text-primary-foreground py-2.5 rounded-md hover:brightness-110 transition text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-[1px] bg-foreground/10" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-[1px] bg-foreground/10" />
              </div>

              <Link href="/login"
                className="flex items-center justify-center w-full font-semibold border border-foreground/20 text-foreground py-2.5 rounded-md hover:border-foreground/40 transition text-sm">
                Sign in to existing account
              </Link>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="text-foreground hover:text-primary transition-colors underline underline-offset-2">Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-foreground hover:text-primary transition-colors underline underline-offset-2">Privacy Policy</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

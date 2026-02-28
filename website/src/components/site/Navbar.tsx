'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, LayoutDashboard, LogOut } from 'lucide-react'

const navLinks = [
  { label: 'Products', href: '/products' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'Downloads', href: '/downloads' },
]

export default function Navbar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<{ displayName?: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try { setUser(JSON.parse(userStr)) } catch { /* ignore */ }
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setOpen(false)
    router.push('/')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-foreground/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-primary rotate-45 rounded-sm flex items-center justify-center group-hover:glow-orange transition-shadow">
            <div className="w-3 h-3 bg-background rotate-45 rounded-[1px]" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-foreground">Hardwave Studios</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                <LayoutDashboard size={14} /> Dashboard
              </Link>
              <button onClick={handleLogout}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                <LogOut size={14} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/register" className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-md hover:brightness-110 transition">
                Get Started
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-background border-t border-foreground/5 px-4 pb-4">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href}
              className="block py-3 text-sm text-muted-foreground hover:text-foreground transition-colors border-b border-foreground/5 last:border-0"
              onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-4 mt-4">
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm text-muted-foreground flex items-center gap-1.5" onClick={() => setOpen(false)}>
                  <LayoutDashboard size={14} /> Dashboard
                </Link>
                <button onClick={handleLogout} className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <LogOut size={14} /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-muted-foreground" onClick={() => setOpen(false)}>Sign In</Link>
                <Link href="/register" className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-md" onClick={() => setOpen(false)}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

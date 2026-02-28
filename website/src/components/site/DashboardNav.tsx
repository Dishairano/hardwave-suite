'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, ChevronDown, LogOut, Settings, User } from 'lucide-react'

const navLinks = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'My Plugins', href: '/dashboard/products' },
  { label: 'Subscription', href: '/dashboard/subscription' },
  { label: 'Orders', href: '/dashboard/orders' },
  { label: 'Invoices', href: '/dashboard/invoices' },
]

interface DashboardNavProps {
  user?: { display_name?: string; email?: string } | null
}

export default function DashboardNav({ user }: DashboardNavProps) {
  const [open, setOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const initials = user?.display_name
    ? user.display_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'HW'
  const displayName = user?.display_name?.split(' ')[0] ?? 'Producer'

  const handleSignOut = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-foreground/5">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group shrink-0">
          <div className="w-7 h-7 bg-primary rotate-45 rounded-sm flex items-center justify-center">
            <div className="w-3 h-3 bg-background rotate-45 rounded-[1px]" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-foreground">Hardwave Studios</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 ml-10">
          {navLinks.map((link) => (
            <Link key={link.label} href={link.href}
              className={`text-sm transition-colors ${pathname === link.href ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 relative">
          <button onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
            <span className="text-foreground font-medium">{displayName}</span>
            <ChevronDown size={14} />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-48 surface-card rounded-lg py-1 shadow-xl">
                <Link href="/dashboard/settings"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  onClick={() => setDropdownOpen(false)}>
                  <Settings size={14} /> Account Settings
                </Link>
                <Link href="/"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  onClick={() => setDropdownOpen(false)}>
                  <User size={14} /> Public Site
                </Link>
                <div className="h-[1px] bg-foreground/5 my-1" />
                <button onClick={handleSignOut}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-destructive hover:bg-foreground/5 transition-colors">
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
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
              className={`block py-3 text-sm border-b border-foreground/5 last:border-0 transition-colors ${pathname === link.href ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-foreground/5">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{initials}</span>
            </div>
            <span className="text-sm text-foreground font-medium">{displayName}</span>
          </div>
          <Link href="/" className="block py-2 mt-2 text-sm text-muted-foreground" onClick={() => setOpen(false)}>Public Site</Link>
          <button onClick={handleSignOut} className="block py-2 text-sm text-destructive">Sign Out</button>
        </div>
      )}
    </nav>
  )
}

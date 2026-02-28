import Link from 'next/link'

const footerLinks = [
  { label: 'Products', href: '/products' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Downloads', href: '/downloads' },
  { label: 'Login', href: '/login' },
]

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
]

export default function Footer() {
  return (
    <footer className="border-t border-foreground/5 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-primary rotate-45 rounded-sm flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-background rotate-45 rounded-[1px]" />
              </div>
              <span className="font-extrabold text-foreground">Hardwave Studios</span>
            </div>
            <p className="text-sm text-muted-foreground">Made in the Netherlands</p>
          </div>

          <div className="flex flex-wrap gap-6">
            {footerLinks.map((link) => (
              <Link key={link.label} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-foreground/5">
          <p className="text-xs text-muted-foreground">© 2026 Hardwave Studios</p>
          <div className="flex gap-6">
            {legalLinks.map((link) => (
              <Link key={link.label} href={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

import { useState, useEffect, useRef, FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import anime from 'animejs'
import { HwLogo } from './HwLogo'

interface LoginScreenProps {
  onLogin: (email: string, password: string, rememberMe: boolean) => Promise<void>
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const glow1Ref = useRef<HTMLDivElement>(null)
  const glow2Ref = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const footerRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const tl = anime.timeline({ easing: 'easeOutExpo' })

    // Background glows breathe in
    tl.add({
      targets: [glow1Ref.current, glow2Ref.current],
      opacity: [0, 1],
      scale: [0.3, 1],
      duration: 1200,
    }, 0)

    // Continuous glow breathing
    anime({
      targets: glow1Ref.current,
      scale: [1, 1.1, 1],
      opacity: [1, 0.7, 1],
      duration: 4000,
      easing: 'easeInOutSine',
      loop: true,
    })
    anime({
      targets: glow2Ref.current,
      scale: [1, 1.15, 1],
      opacity: [1, 0.6, 1],
      duration: 5000,
      easing: 'easeInOutSine',
      loop: true,
      delay: 1000,
    })

    // Logo drops in with bounce
    tl.add({
      targets: logoRef.current,
      scale: [0, 1.15, 1],
      rotate: ['-20deg', '5deg', '0deg'],
      opacity: [0, 1],
      duration: 900,
      easing: 'easeOutElastic(1, 0.5)',
    }, 200)

    // Logo glow pulse
    tl.add({
      targets: logoRef.current,
      boxShadow: [
        '0 20px 60px rgba(249,115,22,0), 0 0 0px rgba(217,70,239,0)',
        '0 20px 60px rgba(249,115,22,0.3), 0 0 40px rgba(217,70,239,0.15)',
      ],
      duration: 600,
    }, 800)

    // Title
    tl.add({
      targets: titleRef.current,
      translateY: [30, 0],
      opacity: [0, 1],
      filter: ['blur(8px)', 'blur(0px)'],
      duration: 600,
    }, 700)

    // Subtitle
    tl.add({
      targets: subtitleRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 500,
    }, 850)

    // Form fields stagger in
    if (formRef.current) {
      tl.add({
        targets: formRef.current.children,
        translateY: [40, 0],
        opacity: [0, 1],
        duration: 500,
        delay: anime.stagger(80),
        easing: 'easeOutCubic',
      }, 950)
    }

    // Footer
    tl.add({
      targets: footerRef.current,
      opacity: [0, 1],
      duration: 500,
    }, 1300)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Button pulse animation
    const btn = formRef.current?.querySelector('button[type="submit"]')
    if (btn) {
      anime({
        targets: btn,
        scale: [1, 0.96, 1],
        duration: 300,
        easing: 'easeInOutQuad',
      })
    }

    try {
      await onLogin(email, password, rememberMe)
    } catch (err) {
      setError(err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err)))
      // Shake the form on error
      anime({
        targets: formRef.current,
        translateX: [0, -12, 12, -8, 8, -4, 4, 0],
        duration: 500,
        easing: 'easeInOutQuad',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={containerRef} className="flex items-center justify-center h-screen bg-[#08080c] relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div ref={glow1Ref} className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-orange-500/[0.04] rounded-full blur-[120px] opacity-0" />
        <div ref={glow2Ref} className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-fuchsia-500/[0.04] rounded-full blur-[120px] opacity-0" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-8">
          <HwLogo ref={logoRef} size={64} className="mb-4 opacity-0" />
          <h1 ref={titleRef} className="text-2xl font-bold text-white opacity-0">Hardwave Suite</h1>
          <p ref={subtitleRef} className="text-sm text-zinc-500 mt-1 opacity-0">Sign in to access your library</p>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoFocus
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25 transition-all backdrop-blur-sm opacity-0"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25 transition-all backdrop-blur-sm opacity-0"
          />

          <label className="flex items-center gap-2 cursor-pointer select-none py-1 opacity-0">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-4 h-4 rounded border border-white/[0.15] bg-white/[0.04] peer-checked:bg-orange-500 peer-checked:border-orange-500 flex items-center justify-center transition-all">
              {rememberMe && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>
            <span className="text-xs text-zinc-400">Remember me</span>
          </label>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-fuchsia-600 hover:from-orange-400 hover:to-fuchsia-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 opacity-0"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</> : 'Sign In'}
          </button>
        </form>

        <p ref={footerRef} className="text-center text-xs text-zinc-600 mt-6 opacity-0">
          Need an account?{' '}
          <a href="https://hardwavestudios.com" target="_blank" rel="noreferrer" className="text-orange-400 hover:text-orange-300 transition-colors">
            hardwavestudios.com
          </a>
        </p>
      </div>
    </div>
  )
}

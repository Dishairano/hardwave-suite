import { useEffect, useRef, useState } from 'react'
import anime from 'animejs'

interface SplashScreenProps {
  dataReady: boolean
  onFinished: () => void
}

export function SplashScreen({ dataReady, onFinished }: SplashScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const barFillRef = useRef<HTMLDivElement>(null)
  const particlesRef = useRef<HTMLDivElement>(null)
  const glow1Ref = useRef<HTMLDivElement>(null)
  const glow2Ref = useRef<HTMLDivElement>(null)
  const ring1Ref = useRef<HTMLDivElement>(null)
  const ring2Ref = useRef<HTMLDivElement>(null)
  const exitCalledRef = useRef(false)
  const [animDone, setAnimDone] = useState(false)

  useEffect(() => {
    const tl = anime.timeline({ easing: 'easeOutExpo' })

    // Background glows fade in
    tl.add({
      targets: [glow1Ref.current, glow2Ref.current],
      opacity: [0, 1],
      scale: [0.5, 1],
      duration: 1200,
    }, 0)

    // Glow breathing
    anime({
      targets: glow1Ref.current,
      scale: [1, 1.2, 1],
      opacity: [0.8, 1, 0.8],
      duration: 3000,
      easing: 'easeInOutSine',
      loop: true,
    })
    anime({
      targets: glow2Ref.current,
      scale: [1, 1.15, 1],
      opacity: [0.7, 1, 0.7],
      duration: 3500,
      easing: 'easeInOutSine',
      loop: true,
      delay: 500,
    })

    // Particles
    if (particlesRef.current) {
      anime({
        targets: particlesRef.current.children,
        translateY: ['100vh', '-10vh'],
        opacity: [0, 1, 0],
        scale: [0, 1, 0],
        duration: () => 3000 + Math.random() * 3000,
        delay: () => Math.random() * 2000,
        easing: 'easeInOutQuad',
        loop: true,
      })
    }

    // Logo slam in
    tl.add({
      targets: logoRef.current,
      scale: [0, 1.15, 1],
      rotate: ['-15deg', '3deg', '0deg'],
      opacity: [0, 1],
      duration: 900,
      easing: 'easeOutElastic(1, 0.6)',
    }, 200)

    // Logo shadow
    tl.add({
      targets: logoRef.current,
      boxShadow: [
        '0 0 0px rgba(249,115,22,0), 0 0 0px rgba(217,70,239,0)',
        '0 0 80px rgba(249,115,22,0.5), 0 0 160px rgba(217,70,239,0.3)',
        '0 0 40px rgba(249,115,22,0.25), 0 0 80px rgba(217,70,239,0.15)',
      ],
      duration: 800,
      easing: 'easeOutQuad',
    }, 800)

    // Shine sweep
    tl.add({
      targets: shineRef.current,
      translateX: ['-200%', '200%'],
      duration: 700,
      easing: 'easeInOutQuad',
    }, 1000)

    // Expanding rings
    tl.add({
      targets: ring1Ref.current,
      scale: [0.8, 4],
      opacity: [0.5, 0],
      borderWidth: ['2px', '0px'],
      duration: 1200,
      easing: 'easeOutCubic',
    }, 900)
    tl.add({
      targets: ring2Ref.current,
      scale: [0.8, 3.5],
      opacity: [0.3, 0],
      borderWidth: ['2px', '0px'],
      duration: 1200,
      easing: 'easeOutCubic',
    }, 1050)

    // Title
    tl.add({
      targets: titleRef.current,
      translateY: [40, 0],
      opacity: [0, 1],
      filter: ['blur(12px)', 'blur(0px)'],
      duration: 700,
      easing: 'easeOutCubic',
    }, 1100)

    // Subtitle
    tl.add({
      targets: subtitleRef.current,
      translateY: [25, 0],
      opacity: [0, 0.5],
      duration: 600,
      easing: 'easeOutCubic',
    }, 1300)

    // Loading bar appear
    tl.add({
      targets: barRef.current,
      opacity: [0, 1],
      scaleX: [0, 1],
      duration: 500,
      easing: 'easeOutCubic',
    }, 1400)

    // Loading bar: fill to 60% (animation portion)
    tl.add({
      targets: barFillRef.current,
      width: ['0%', '60%'],
      duration: 800,
      easing: 'easeOutCubic',
    }, 1600)

    // Slowly creep to 85% — gives the animation time to breathe
    tl.add({
      targets: barFillRef.current,
      width: '85%',
      duration: 1200,
      easing: 'easeOutSine',
      complete: () => setAnimDone(true),
    }, 2400)

    return () => { tl.pause() }
  }, [])

  // Exit only when BOTH the intro animation is done AND data is ready
  useEffect(() => {
    if (animDone && dataReady && !exitCalledRef.current) {
      exitCalledRef.current = true

      const tl = anime.timeline({ easing: 'easeOutCubic' })

      // Fill bar to 100%
      tl.add({
        targets: barFillRef.current,
        width: '100%',
        duration: 400,
        easing: 'easeOutQuart',
      }, 0)

      // Fade out
      tl.add({
        targets: containerRef.current,
        opacity: [1, 0],
        scale: [1, 1.05],
        duration: 500,
        easing: 'easeInCubic',
        complete: onFinished,
      }, 500)
    }
  }, [animDone, dataReady, onFinished])

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center bg-[#08080c] overflow-hidden">
      {/* Particles */}
      <div ref={particlesRef} className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              bottom: 0,
              background: i % 2 === 0
                ? 'linear-gradient(135deg, #f97316, #ea580c)'
                : 'linear-gradient(135deg, #d946ef, #a855f7)',
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Background glows */}
      <div ref={glow1Ref} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-orange-500/[0.08] blur-[120px] opacity-0" />
      <div ref={glow2Ref} className="absolute top-1/2 left-1/2 -translate-x-[40%] -translate-y-[60%] w-[400px] h-[400px] rounded-full bg-fuchsia-500/[0.08] blur-[120px] opacity-0" />

      {/* Center content */}
      <div className="relative flex flex-col items-center">
        <div ref={ring1Ref} className="absolute w-24 h-24 rounded-full border-2 border-orange-500/40 opacity-0" style={{ top: '0' }} />
        <div ref={ring2Ref} className="absolute w-24 h-24 rounded-full border-2 border-fuchsia-500/30 opacity-0" style={{ top: '0' }} />

        <div
          ref={logoRef}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500 to-fuchsia-600 flex items-center justify-center relative overflow-hidden opacity-0"
        >
          <svg className="w-12 h-12 text-white relative z-10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <div
            ref={shineRef}
            className="absolute inset-0 z-20"
            style={{
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',
              transform: 'translateX(-200%)',
            }}
          />
        </div>

        <h1 ref={titleRef} className="text-3xl font-bold text-white mt-6 opacity-0">Hardwave Suite</h1>
        <p ref={subtitleRef} className="text-sm text-zinc-500 mt-2 opacity-0">Audio Production Hub</p>

        <div ref={barRef} className="mt-8 w-[200px] h-0.5 bg-white/[0.06] rounded-full overflow-hidden opacity-0">
          <div ref={barFillRef} className="h-full bg-gradient-to-r from-orange-500 to-fuchsia-500 rounded-full" style={{ width: '0%' }} />
        </div>
      </div>
    </div>
  )
}

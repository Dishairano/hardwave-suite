import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronRight, ChevronLeft, Download, Shield, RefreshCw, Music } from 'lucide-react'
import anime from 'animejs'

interface OnboardingProps {
  onComplete: () => void
}

const steps = [
  {
    icon: Music,
    title: 'Welcome to Hardwave Suite',
    description:
      'Your central hub for Hardwave Studios audio plugins. Download, install, and manage all your purchased VST3 and CLAP plugins from one place.',
    accent: 'from-red-700 to-red-500',
    glowColor: 'rgba(220, 38, 38, 0.08)',
  },
  {
    icon: Download,
    title: 'One-Click Installs',
    description:
      'Browse your library and install plugins with a single click. Hardwave Suite automatically detects your OS and installs to the correct plugin directories.',
    accent: 'from-red-700 to-red-500',
    glowColor: 'rgba(220, 38, 38, 0.06)',
  },
  {
    icon: RefreshCw,
    title: 'Automatic Updates',
    description:
      'Stay up to date effortlessly. When a new version of a plugin is available, you\'ll see an update button right in your library. The Suite itself also auto-updates.',
    accent: 'from-red-700 to-red-600',
    glowColor: 'rgba(139, 92, 246, 0.08)',
  },
  {
    icon: Shield,
    title: 'You\'re All Set',
    description:
      'Your purchases are tied to your Hardwave Studios account — sign in on any machine to access your full library. Let\'s get started.',
    accent: 'from-red-700 to-red-500',
    glowColor: 'rgba(59, 130, 246, 0.08)',
  },
]

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const current = steps[step]
  const isLast = step === steps.length - 1

  const iconRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const descRef = useRef<HTMLParagraphElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const buttonsRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const orbitsRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const animateIn = useCallback(() => {
    const tl = anime.timeline({ easing: 'easeOutExpo' })

    // Glow shifts color
    tl.add({
      targets: glowRef.current,
      opacity: [0.3, 1],
      scale: [0.8, 1],
      duration: 800,
    }, 0)

    // Icon bounces in with rotation
    tl.add({
      targets: iconRef.current,
      scale: [0, 1.2, 1],
      rotate: ['45deg', '-5deg', '0deg'],
      opacity: [0, 1],
      duration: 800,
      easing: 'easeOutElastic(1, 0.5)',
    }, 100)

    // Orbit rings appear
    if (orbitsRef.current) {
      tl.add({
        targets: orbitsRef.current.children,
        scale: [0, 1],
        opacity: [0, 0.15],
        rotate: [0, 360],
        duration: 1500,
        delay: anime.stagger(150),
        easing: 'easeOutCubic',
      }, 200)
    }

    // Title slides up with blur
    tl.add({
      targets: titleRef.current,
      translateY: [50, 0],
      opacity: [0, 1],
      filter: ['blur(10px)', 'blur(0px)'],
      duration: 700,
    }, 400)

    // Description fades in
    tl.add({
      targets: descRef.current,
      translateY: [30, 0],
      opacity: [0, 1],
      filter: ['blur(6px)', 'blur(0px)'],
      duration: 600,
    }, 550)

    // Dots stagger in
    if (dotsRef.current) {
      tl.add({
        targets: dotsRef.current.children,
        scale: [0, 1],
        opacity: [0, 1],
        duration: 400,
        delay: anime.stagger(60),
        easing: 'easeOutBack',
      }, 600)
    }

    // Buttons slide up
    tl.add({
      targets: buttonsRef.current,
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 500,
    }, 700)

    // Skip link
    if (skipRef.current) {
      tl.add({
        targets: skipRef.current,
        opacity: [0, 1],
        duration: 400,
      }, 850)
    }

    return tl
  }, [])

  const animateOut = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      const tl = anime.timeline({
        easing: 'easeInCubic',
        complete: () => resolve(),
      })

      tl.add({
        targets: [skipRef.current, buttonsRef.current],
        opacity: [1, 0],
        translateY: [0, -15],
        duration: 200,
      }, 0)
      tl.add({
        targets: [descRef.current, dotsRef.current],
        opacity: [1, 0],
        translateY: [0, -20],
        duration: 200,
      }, 50)
      tl.add({
        targets: titleRef.current,
        opacity: [1, 0],
        translateY: [0, -25],
        duration: 200,
      }, 100)
      tl.add({
        targets: iconRef.current,
        scale: [1, 0.5],
        opacity: [1, 0],
        rotate: ['0deg', '-15deg'],
        duration: 300,
      }, 100)
      if (orbitsRef.current) {
        tl.add({
          targets: orbitsRef.current.children,
          scale: [1, 0],
          opacity: [0.15, 0],
          duration: 250,
        }, 100)
      }
    })
  }, [])

  // Initial mount animation
  useEffect(() => {
    // Entrance of the whole screen
    anime({
      targets: containerRef.current,
      opacity: [0, 1],
      duration: 500,
      easing: 'easeOutCubic',
    })
    animateIn()
  }, [])

  // Animate on step change (skip first mount)
  const prevStep = useRef(step)
  useEffect(() => {
    if (prevStep.current !== step) {
      animateIn()
      prevStep.current = step
    }
  }, [step, animateIn])

  const goToStep = async (next: number) => {
    if (transitioning) return
    setTransitioning(true)
    await animateOut()
    setStep(next)
    setTransitioning(false)
  }

  const handleComplete = async () => {
    if (transitioning) return
    setTransitioning(true)
    // Big exit: everything scales up and fades
    anime({
      targets: containerRef.current,
      opacity: [1, 0],
      scale: [1, 1.1],
      filter: ['blur(0px)', 'blur(10px)'],
      duration: 500,
      easing: 'easeInCubic',
      complete: onComplete,
    })
  }

  // Orbit rotation loop
  useEffect(() => {
    if (!orbitsRef.current) return
    const anim = anime({
      targets: orbitsRef.current.children,
      rotate: '+=360',
      duration: 20000,
      easing: 'linear',
      loop: true,
    })
    return () => anim.pause()
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center h-screen bg-[#08080c] relative overflow-hidden select-none opacity-0"
    >
      {/* Background glow (color changes per step) */}
      <div
        ref={glowRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] transition-colors duration-1000"
        style={{ backgroundColor: current.glowColor }}
      />

      <div className="relative w-full max-w-md mx-4">
        {/* Orbiting rings around icon */}
        <div className="flex justify-center mb-8 relative">
          <div ref={orbitsRef} className="absolute w-40 h-40 -top-10">
            <div className="absolute inset-0 rounded-full border border-white/[0.04]" />
            <div className="absolute -inset-4 rounded-full border border-white/[0.03]" />
            <div className="absolute -inset-8 rounded-full border border-white/[0.02] border-dashed" />
          </div>

          {/* Icon */}
          <div
            ref={iconRef}
            className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${current.accent} flex items-center justify-center shadow-2xl relative z-10 opacity-0`}
          >
            <current.icon className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <h1 ref={titleRef} className="text-2xl font-bold text-white mb-3 text-center opacity-0">
          {current.title}
        </h1>

        {/* Description */}
        <p ref={descRef} className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto text-center mb-10 opacity-0">
          {current.description}
        </p>

        {/* Step dots */}
        <div ref={dotsRef} className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => !transitioning && goToStep(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === step
                  ? 'w-8 bg-gradient-to-r from-red-700 to-red-500'
                  : i < step
                    ? 'w-1.5 bg-white/[0.3]'
                    : 'w-1.5 bg-white/[0.1] hover:bg-white/[0.2]'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div ref={buttonsRef} className="flex gap-3 opacity-0">
          {step > 0 && (
            <button
              onClick={() => goToStep(step - 1)}
              disabled={transitioning}
              className="flex-1 py-3 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? handleComplete() : goToStep(step + 1))}
            disabled={transitioning}
            className={`flex-1 py-3 bg-gradient-to-r ${current.accent} hover:opacity-90 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-red-600/15 flex items-center justify-center gap-2`}
          >
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            ref={skipRef}
            onClick={handleComplete}
            disabled={transitioning}
            className="w-full mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors opacity-0"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

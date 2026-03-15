import { useState } from 'react'
import { ChevronRight, ChevronLeft, Download, Shield, RefreshCw, Music } from 'lucide-react'

interface OnboardingProps {
  onComplete: () => void
}

const steps = [
  {
    icon: Music,
    title: 'Welcome to Hardwave Suite',
    description:
      'Your central hub for Hardwave Studios audio plugins. Download, install, and manage all your purchased VST3 and CLAP plugins from one place.',
    accent: 'from-orange-500 to-fuchsia-600',
  },
  {
    icon: Download,
    title: 'One-Click Installs',
    description:
      'Browse your library and install plugins with a single click. Hardwave Suite automatically detects your OS and installs to the correct plugin directories.',
    accent: 'from-fuchsia-500 to-violet-600',
  },
  {
    icon: RefreshCw,
    title: 'Automatic Updates',
    description:
      'Stay up to date effortlessly. When a new version of a plugin is available, you\'ll see an update button right in your library. The Suite itself also auto-updates.',
    accent: 'from-violet-500 to-blue-600',
  },
  {
    icon: Shield,
    title: 'You\'re All Set',
    description:
      'Your purchases are tied to your Hardwave Studios account — sign in on any machine to access your full library. Let\'s get started.',
    accent: 'from-blue-500 to-orange-500',
  },
]

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="flex items-center justify-center h-screen bg-[#08080c] relative overflow-hidden select-none">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-orange-500/[0.03] rounded-full blur-[150px] transition-all duration-1000" />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-fuchsia-500/[0.03] rounded-full blur-[150px] transition-all duration-1000" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div
            className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${current.accent} flex items-center justify-center shadow-2xl shadow-orange-500/20 transition-all duration-500`}
          >
            <current.icon className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-10 min-h-[120px]">
          <h1 className="text-2xl font-bold text-white mb-3 transition-all duration-300">
            {current.title}
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto transition-all duration-300">
            {current.description}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-8 bg-gradient-to-r from-orange-500 to-fuchsia-500'
                  : 'w-1.5 bg-white/[0.15] hover:bg-white/[0.25]'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? onComplete() : setStep(step + 1))}
            className={`flex-1 py-3 bg-gradient-to-r ${current.accent} hover:opacity-90 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2`}
          >
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={onComplete}
            className="w-full mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

"use client"

import { useMemo } from "react"

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

interface WaveformProps {
  seed?: number
  isPlaying?: boolean
}

export function Waveform({ seed = 0, isPlaying = false }: WaveformProps) {
  const bars = useMemo(() => {
    const rng = seededRandom(seed + 1)
    const count = 40
    const result: number[] = []
    for (let i = 0; i < count; i++) {
      const position = i / count
      const envelope =
        Math.sin(position * Math.PI) * 0.6 +
        Math.sin(position * Math.PI * 2.5) * 0.25 +
        0.15
      const randomness = rng() * 0.4 + 0.6
      result.push(Math.min(1, Math.max(0.08, envelope * randomness)))
    }
    return result
  }, [seed])

  return (
    <div
      className="flex items-end gap-[2px] h-full w-full px-1"
      role="img"
      aria-label="Audio waveform"
    >
      {bars.map((height, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm min-w-[2px] transition-colors ${
            isPlaying
              ? 'bg-accent-primary animate-pulse'
              : 'bg-accent-primary/70 group-hover:bg-accent-primary'
          }`}
          style={{ height: `${height * 100}%` }}
        />
      ))}
    </div>
  )
}

/** The Hardwave mark: the wave in a rounded square, as on the site and in the app. */
export function HwWaveMark({ className = 'bigmark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="hw-wv" x1="40" y1="100" x2="160" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#DC2626" stopOpacity=".35" />
          <stop offset=".15" stopColor="#DC2626" />
          <stop offset=".5" stopColor="#EF4444" />
          <stop offset=".85" stopColor="#DC2626" />
          <stop offset="1" stopColor="#DC2626" stopOpacity=".35" />
        </linearGradient>
      </defs>
      <rect x="20" y="20" width="160" height="160" rx="34" fill="#151517" stroke="rgba(255,255,255,.08)" />
      <path d="M40 100 H52 L58 93 L66 58 L74 138 L82 68 L88 130 L94 86 L100 114 L106 94 L112 106 L118 100 H160" stroke="url(#hw-wv)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/** The spectrum that moves under the splash and the done screen. */
export function Bars({ faint = false }: { faint?: boolean }) {
  const bars: Array<[number, number, number]> = [
    [0.3, 0.6, -0.1], [0.5, 0.9, -0.4], [0.7, 1, -0.2], [0.6, 0.95, -0.7], [0.45, 0.8, -0.3], [0.55, 0.85, -0.9], [0.35, 0.7, -0.5],
    [0.5, 0.9, -0.15], [0.65, 1, -0.6], [0.4, 0.75, -0.35], [0.3, 0.6, -0.8], [0.45, 0.8, -0.25], [0.6, 0.9, -0.55], [0.35, 0.65, -0.45],
  ]
  return (
    <div className={`ibars${faint ? ' faint' : ''}`} aria-hidden="true">
      {bars.map(([a, b, d], i) => <i key={i} style={{ ['--a' as string]: a, ['--b' as string]: b, animationDelay: `${d}s` }} />)}
    </div>
  )
}

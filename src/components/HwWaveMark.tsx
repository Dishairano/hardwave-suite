interface HwWaveMarkProps {
  size?: number
}

/**
 * Compact monoline wave used in the sidebar brand row, matching the
 * mockup's inline SVG. Drops the heavy gradient/shine of HwLogo so it
 * reads cleanly at 16px.
 */
export function HwWaveMark({ size = 16 }: HwWaveMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 72" fill="none">
      <path
        d="M0 36 H12 L16 32 L20 6 L24 62 L28 16 L32 52 L36 28 L40 42 L44 34 L48 38 L52 36 H64"
        stroke="#DC2626"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

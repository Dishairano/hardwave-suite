// Live application of the user's theme to the running document. Backend
// stores the canonical theme; this module is the renderer-side bridge that
// reads a UserTheme and writes the corresponding CSS variables onto
// `document.documentElement`. Removing properties (rather than setting
// them to defaults) lets the cascade fall back to the values baked into
// `:root` in index.css.
import type { UserTheme } from './api'

export function applyTheme(theme: UserTheme | null): void {
  if (!theme) {
    clearThemeOverrides()
    return
  }

  const root = document.documentElement.style

  if (theme.applyTo.suite) {
    root.setProperty('--brand', theme.primary)
    root.setProperty('--brand-hover', shade(theme.primary, 0.10))
    root.setProperty('--brand-glow', hexToRgba(theme.primary, theme.glowStrength))
    root.setProperty('--accent', theme.accent)
    root.setProperty('--accent-hover', shade(theme.accent, 0.10))
    root.setProperty('--accent-glow', hexToRgba(theme.accent, theme.glowStrength))
  } else {
    clearThemeOverrides()
  }
}

export function clearThemeOverrides(): void {
  const root = document.documentElement.style
  root.removeProperty('--brand')
  root.removeProperty('--brand-hover')
  root.removeProperty('--brand-glow')
  root.removeProperty('--accent')
  root.removeProperty('--accent-hover')
  root.removeProperty('--accent-glow')
}

// Lighten a HEX colour by `pct` (0..1). Used to derive the *-hover variants
// without forcing the user to pick two shades themselves.
function shade(hex: string, lightenPct: number): string {
  const channels = parseHex(hex)
  if (!channels) return hex
  const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * lightenPct))
  const [r, g, b] = channels
  return `#${[lighten(r), lighten(g), lighten(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`
}

function hexToRgba(hex: string, alpha: number): string {
  const channels = parseHex(hex)
  if (!channels) return `rgba(0, 0, 0, ${alpha})`
  const [r, g, b] = channels
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function parseHex(hex: string): [number, number, number] | null {
  const cleaned = hex.replace('#', '')
  // Support #abc shorthand by expanding each digit (#abc -> #aabbcc)
  const expanded = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned
  if (expanded.length !== 6) return null
  const match = expanded.match(/.{2}/g)
  if (!match) return null
  const parsed = match.map((s) => parseInt(s, 16))
  if (parsed.some((v) => Number.isNaN(v))) return null
  return [parsed[0], parsed[1], parsed[2]]
}

// HEX validation + normalisation helper for the AppearanceTab UI. Returns
// the canonical `#RRGGBB` form (uppercase) or `null` if the input isn't a
// valid 3- or 6-digit hex colour.
export function normalizeHex(input: string): string | null {
  const trimmed = input.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(trimmed)) return null
  const expanded = trimmed.length === 3
    ? trimmed.split('').map((c) => c + c).join('')
    : trimmed
  return `#${expanded.toUpperCase()}`
}

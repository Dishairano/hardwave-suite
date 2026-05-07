import type { Product } from './api'

/**
 * Plug-ins that are always considered beta until explicitly released.
 * Per product roadmap (2026-05): only Analyser + the Suite app itself
 * have hit a stable 1.0+ release. Everything below is still in beta.
 */
export const BETA_SLUGS = new Set([
  'loudlab',
  'wettboi',
  'kickforge',
  'pumpcontrol',
  'wideboi',
])

export function isBetaVersion(version: string | undefined | null): boolean {
  if (!version) return false
  if (version.startsWith('0.')) return true
  return /-beta|-alpha|-rc/i.test(version)
}

export function isBetaProduct(p: Product): boolean {
  if (BETA_SLUGS.has(p.slug)) return true
  return isBetaVersion(p.version)
}

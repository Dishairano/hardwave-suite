// Plug-in versions are semver with an optional pre-release suffix (0.4.0-rc1).
//
// A pre-release sorts BEFORE its release: 0.3.13 < 0.4.0-rc1 < 0.4.0. A tester
// who installed a release candidate from the beta channel must not be offered
// the older stable build as an "update", and must be offered the stable build
// once the same version ships without the suffix.

interface ParsedVersion {
  core: [number, number, number]
  pre: string[]
}

function parseVersion(v: string): ParsedVersion | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(v.trim())
  if (!m) return null
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.') : [],
  }
}

function compareIdentifiers(a: string, b: string): number {
  const aNum = /^\d+$/.test(a)
  const bNum = /^\d+$/.test(b)
  if (aNum && bNum) return Math.sign(Number(a) - Number(b))
  // Numeric identifiers sort before alphanumeric ones (semver 11.4.3).
  if (aNum !== bNum) return aNum ? -1 : 1
  // Natural order, so rc2 < rc10.
  return Math.sign(a.localeCompare(b, 'en', { numeric: true }))
}

/** -1, 0 or 1; null when either side is not a version this can read. */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] < pb.core[i] ? -1 : 1
  }
  // A release outranks any of its pre-releases.
  if (!pa.pre.length || !pb.pre.length) {
    return pa.pre.length === pb.pre.length ? 0 : pa.pre.length ? -1 : 1
  }
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    if (pa.pre[i] === undefined) return -1
    if (pb.pre[i] === undefined) return 1
    const c = compareIdentifiers(pa.pre[i], pb.pre[i])
    if (c !== 0) return c
  }
  return 0
}

/**
 * True when `candidate` is newer than `installed`. Versions this can't read
 * fall back to "different means newer", which is what the library did before.
 */
export function isNewerVersion(candidate: string, installed: string): boolean {
  const c = compareVersions(candidate, installed)
  return c === null ? candidate !== installed : c > 0
}

import { describe, expect, it } from 'vitest'
import { compareVersions, isNewerVersion } from '../version'

describe('compareVersions', () => {
  it('sorts a release candidate between the last stable and its own release', () => {
    expect(compareVersions('0.4.9', '0.5.0-rc1')).toBe(-1)
    expect(compareVersions('0.5.0-rc1', '0.5.0')).toBe(-1)
    expect(compareVersions('1.0.36-rc1', '1.0.35')).toBe(1)
  })

  it('orders candidates naturally', () => {
    expect(compareVersions('0.5.0-rc2', '0.5.0-rc10')).toBe(-1)
    expect(compareVersions('0.5.0-rc1', '0.5.0-rc1')).toBe(0)
  })

  it('reads a leading v and ignores build metadata', () => {
    expect(compareVersions('v0.4.9', '0.4.9+build5')).toBe(0)
  })

  it('answers null for something that is not a version', () => {
    expect(compareVersions('nightly', '0.4.9')).toBeNull()
    expect(compareVersions('', '0.4.9')).toBeNull()
  })
})

describe('isNewerVersion', () => {
  it('never calls the older stable build newer than an installed candidate', () => {
    expect(isNewerVersion('0.4.9', '0.5.0-rc1')).toBe(false)
    expect(isNewerVersion('0.5.0', '0.5.0-rc1')).toBe(true)
  })

  it('falls back to "different means newer" for unreadable versions', () => {
    expect(isNewerVersion('nightly', '0.4.9')).toBe(true)
    expect(isNewerVersion('nightly', 'nightly')).toBe(false)
  })
})

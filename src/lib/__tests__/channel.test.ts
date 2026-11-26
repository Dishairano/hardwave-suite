import { describe as suite, expect, it } from 'vitest'
import type { BetaPlugin, Product } from '../api'
import { betaOffers, betaOnlyProducts, describe, hoursLeft, installErrorText, latestOf, offerFor, tileState } from '../channel'
import type { TileInput } from '../channel'

const NOW = Date.parse('2026-11-26T12:00:00Z')
const SHA = 'a'.repeat(64)

function build(over: Partial<BetaPlugin> = {}): BetaPlugin {
  return {
    id: 74,
    pluginSlug: 'wideboi',
    version: '0.5.0-rc1',
    releasedAt: '2026-11-26T09:45:00Z',
    expiresAt: '2026-12-17T09:45:00Z',
    hoursUntilExpiry: 500,
    hoursUntilSoftWarn: 476,
    artefactUrl: 'https://example.test/wideboi-windows.zip',
    artefactSha256: SHA,
    artefactSize: 4_000_000,
    changelog: '- Mono Width',
    availableHere: true,
    platforms: ['windows', 'macos', 'linux'],
    ...over,
  }
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: 5,
    name: 'Hardwave WideBoi',
    slug: 'wideboi',
    description: '',
    version: '0.4.9',
    downloads: { windows: 'https://example.test/stable-windows.zip', mac: null, linux: null },
    fileSize: null,
    changelog: '- stable notes',
    category: 'vst',
    formats: ['VST3', 'CLAP'],
    ...over,
  }
}

function input(over: Partial<TileInput> = {}): TileInput {
  const p = product()
  return {
    stable: p.version,
    hasStableDownload: true,
    latest: latestOf(p, {}),
    installed: null,
    pro: true,
    neverOpened: false,
    ...over,
  }
}

suite('betaOffers', () => {
  it('offers a build that is made for this computer and has not expired', () => {
    expect(betaOffers([build()], NOW)).toEqual({ wideboi: build() })
  })

  it('offers nothing when the manifest is empty, which is what Beta off looks like', () => {
    expect(betaOffers([], NOW)).toEqual({})
  })

  it('leaves out a build for another system', () => {
    expect(betaOffers([build({ availableHere: false, artefactUrl: '', artefactSha256: '' })], NOW)).toEqual({})
  })

  it('leaves out an expired build', () => {
    expect(betaOffers([build({ expiresAt: '2026-11-26T11:59:00Z' })], NOW)).toEqual({})
  })

  it('leaves out a build without a checksum, the installer would refuse it', () => {
    expect(betaOffers([build({ artefactSha256: '' })], NOW)).toEqual({})
  })

  it('gives no offers to a Suite binary from before per-platform betas', () => {
    const old = build() as Partial<BetaPlugin>
    delete old.availableHere
    expect(betaOffers([old as BetaPlugin], NOW)).toEqual({})
  })

  it('keeps the newest build when a plug-in is listed more than once, in any order', () => {
    const rc1 = build({ id: 1, version: '0.5.0-rc1' })
    const rc2 = build({ id: 2, version: '0.5.0-rc2' })
    const rc10 = build({ id: 3, version: '0.5.0-rc10' })
    expect(betaOffers([rc2, rc10, rc1], NOW).wideboi.version).toBe('0.5.0-rc10')
    expect(betaOffers([rc1, rc2], NOW).wideboi.version).toBe('0.5.0-rc2')
  })

  it('falls back to the server count when the expiry date cannot be read', () => {
    expect(hoursLeft({ expiresAt: 'soon', hoursUntilExpiry: 3 }, NOW)).toBe(3)
    expect(betaOffers([build({ expiresAt: 'soon', hoursUntilExpiry: 0 })], NOW)).toEqual({})
  })
})

suite('offerFor and latestOf', () => {
  const offers = betaOffers([build()], NOW)

  it('makes a newer release candidate the newest version, with its own notes', () => {
    const latest = latestOf(product(), offers)
    expect(latest.version).toBe('0.5.0-rc1')
    expect(latest.changelog).toBe('- Mono Width')
    expect(latest.beta?.artefactSha256).toBe(SHA)
  })

  it('stays on the stable version without offers', () => {
    expect(latestOf(product(), {})).toEqual({ version: '0.4.9', changelog: '- stable notes', beta: null })
  })

  it('prefers the stable release once the same version has shipped', () => {
    expect(offerFor(product({ version: '0.5.0' }), offers)).toBeNull()
    expect(latestOf(product({ version: '0.5.0' }), offers).version).toBe('0.5.0')
  })

  it('does not offer a candidate that is older than the stable version', () => {
    expect(offerFor(product({ version: '0.5.1' }), offers)).toBeNull()
  })

  it('does not offer a candidate whose version cannot be compared', () => {
    expect(offerFor(product(), betaOffers([build({ version: 'nightly' })], NOW))).toBeNull()
  })

  it('does not mix up plug-ins', () => {
    expect(offerFor(product({ slug: 'wettboi' }), offers)).toBeNull()
  })
})

suite('betaOnlyProducts', () => {
  it('adds a tile for a beta of a plug-in the account list does not have yet', () => {
    const offers = betaOffers([build(), build({ id: 9, pluginSlug: 'hard-q', version: '0.1.0-rc1' })], NOW)
    const extra = betaOnlyProducts([product()], offers)
    expect(extra.map((p) => p.slug)).toEqual(['hard-q'])
    expect(extra[0].name).toBe('Hard Q')
    expect(extra[0].id).toBeLessThan(0)
    expect(extra[0].version).toBe('')
    expect(latestOf(extra[0], offers).beta?.version).toBe('0.1.0-rc1')
  })

  it('adds nothing with Beta off', () => {
    expect(betaOnlyProducts([product()], {})).toEqual([])
  })
})

suite('tileState', () => {
  const offers = betaOffers([build()], NOW)
  const beta = latestOf(product(), offers)

  it('Beta on, stable installed: the release candidate is an update', () => {
    const s = tileState(input({ latest: beta, installed: '0.4.9' }))
    expect(s.kind).toBe('update')
    expect(s.latest).toBe('0.5.0-rc1')
    expect(s.beta).toBe(true)
    expect(describe(s).text).toBe('Beta ready · 0.5.0-rc1')
  })

  it('Beta on, not installed: Install puts down the release candidate', () => {
    const s = tileState(input({ latest: beta }))
    expect(s.kind).toBe('not_installed')
    expect(describe(s).text).toBe('Beta · 0.5.0-rc1')
  })

  it('Beta on, release candidate installed: nothing to update, the way back is offered', () => {
    const s = tileState(input({ latest: beta, installed: '0.5.0-rc1' }))
    expect(s.kind).toBe('installed')
    expect(s.canGoStable).toBe(true)
    expect(describe(s).text).toBe('Beta · 0.5.0-rc1')
  })

  it('Beta off, stable installed: up to date, as before', () => {
    const s = tileState(input({ installed: '0.4.9' }))
    expect(s).toMatchObject({ kind: 'installed', latest: '0.4.9', beta: false, canGoStable: false })
    expect(describe(s).text).toBe('Up to date · 0.4.9')
  })

  it('Beta off, older stable installed: the stable update, as before', () => {
    const s = tileState(input({ installed: '0.4.8' }))
    expect(s).toMatchObject({ kind: 'update', latest: '0.4.9', beta: false })
    expect(describe(s).text).toBe('Update ready · 0.4.9')
  })

  it('Beta off, not installed: the stable version, as before', () => {
    expect(describe(tileState(input({ pro: false }))).text).toBe('Not installed · 0.4.9')
    expect(describe(tileState(input({ pro: true }))).text).toBe('Beta · 0.4.9')
  })

  it('Beta off, release candidate still installed: never offered the older stable as an update, but can go back', () => {
    const s = tileState(input({ installed: '0.5.0-rc1' }))
    expect(s.kind).toBe('installed')
    expect(s.canGoStable).toBe(true)
  })

  it('a release candidate is replaced by its stable release', () => {
    const p = product({ version: '0.5.0' })
    const s = tileState(input({ stable: '0.5.0', latest: latestOf(p, offers), installed: '0.5.0-rc1' }))
    expect(s).toMatchObject({ kind: 'update', latest: '0.5.0', beta: false })
  })

  it('offers no way back when there is no stable build for this system', () => {
    expect(tileState(input({ installed: '0.5.0-rc1', hasStableDownload: false })).canGoStable).toBe(false)
    expect(tileState(input({ installed: '0.1.0-rc1', stable: '' })).canGoStable).toBe(false)
  })

  it('keeps the first-run note and the way back together', () => {
    const s = tileState(input({ latest: beta, installed: '0.5.0-rc1', neverOpened: true }))
    expect(s.kind).toBe('never_opened')
    expect(s.canGoStable).toBe(true)
    expect(describe(s).text).toBe('Not opened yet · 0.5.0-rc1')
  })

  it('shows a download in flight before anything else', () => {
    expect(tileState(input({ installed: '0.4.9', download: { status: 'downloading', percent: 41.6 } }))).toMatchObject({ kind: 'downloading', percent: 41.6 })
    expect(tileState(input({ latest: beta, installed: '0.4.9', download: { status: 'installing', percent: 0 } })).kind).toBe('installing')
    const failed = tileState(input({ installed: '0.4.9', download: { status: 'error', percent: 0, error: 'sha256 mismatch' } }))
    expect(describe(failed).text).toBe('sha256 mismatch')
  })

  it('reads a finished download as the installed state', () => {
    expect(tileState(input({ latest: beta, installed: '0.5.0-rc1', download: { status: 'installed', percent: 100 } })).kind).toBe('installed')
  })
})

suite('installErrorText', () => {
  it('says to close the DAW when the file is in use', () => {
    expect(installErrorText('Failed to copy: os error 32')).toBe('The plug-in is in use. Close your DAW and try again.')
    expect(installErrorText(new Error('being used by another process'))).toBe('The plug-in is in use. Close your DAW and try again.')
  })

  it('passes other errors through', () => {
    expect(installErrorText('Beta download failed: HTTP 404')).toBe('Beta download failed: HTTP 404')
  })
})

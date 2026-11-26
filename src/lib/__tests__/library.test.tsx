// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BetaPlugin, Product } from '../api'

// The Suite's backend, as far as the library talks to it.
vi.mock('../api', () => ({
  INSTALLED_CHANGED_EVENT: 'hardwave:installed-changed',
  getProducts: vi.fn(),
  getInstalledVersions: vi.fn(),
  getBetaManifest: vi.fn(),
  installBetaBuild: vi.fn(),
  downloadAndInstall: vi.fn(),
  firstRunCheck: vi.fn(),
  onDownloadProgress: vi.fn(),
  onPluginsCleaned: vi.fn(),
  onBetaExpired: vi.fn(),
  removeStalePlugins: vi.fn(),
  uninstallPlugin: vi.fn(),
}))

import * as api from '../api'
import { useLibrary } from '../library'

const mocked = vi.mocked(api)
const SHA = 'b'.repeat(64)

const wideboi: Product = {
  id: 5, name: 'Hardwave WideBoi', slug: 'wideboi', description: '', version: '0.4.9',
  downloads: { windows: 'https://example.test/wideboi-0.4.9-windows.zip', mac: 'https://example.test/wideboi-0.4.9-macos.zip', linux: 'https://example.test/wideboi-0.4.9-linux.zip' },
  fileSize: null, changelog: '- stable notes', category: 'vst', formats: ['VST3', 'CLAP'],
}

const rc1: BetaPlugin = {
  id: 74, pluginSlug: 'wideboi', version: '0.5.0-rc1', releasedAt: '2026-11-26T09:45:00Z',
  expiresAt: new Date(Date.now() + 21 * 86_400_000).toISOString(), hoursUntilExpiry: 504, hoursUntilSoftWarn: 480,
  artefactUrl: 'https://example.test/wideboi-0.5.0-rc1-windows.zip', artefactSha256: SHA, artefactSize: 4_000_000,
  changelog: '- Mono Width', availableHere: true, platforms: ['windows', 'macos', 'linux'],
}

let expired: (() => void) | undefined

beforeEach(() => {
  vi.clearAllMocks()
  expired = undefined
  mocked.getProducts.mockResolvedValue([wideboi])
  // The registry on disk: an install writes it before it answers.
  const registry: Record<string, string> = { wideboi: '0.4.9' }
  mocked.getInstalledVersions.mockImplementation(async () => ({ ...registry }))
  mocked.getBetaManifest.mockResolvedValue([rc1])
  mocked.installBetaBuild.mockImplementation(async (slug, version) => { registry[slug] = version; return 'C:\\Program Files\\Common Files\\VST3' })
  mocked.downloadAndInstall.mockResolvedValue('C:\\Program Files\\Common Files\\VST3')
  mocked.firstRunCheck.mockResolvedValue([])
  mocked.onDownloadProgress.mockResolvedValue(() => {})
  mocked.onPluginsCleaned.mockResolvedValue(() => {})
  mocked.onBetaExpired.mockImplementation(async (cb) => { expired = () => cb({ slug: 'wideboi', version: '0.5.0-rc1', expires_at: '' }); return () => {} })
})

describe('useLibrary with Beta builds off', () => {
  it('never asks for the beta manifest and stays on the stable version', async () => {
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.4.9' }, false))
    await waitFor(() => expect(mocked.firstRunCheck).toHaveBeenCalled())
    expect(mocked.getBetaManifest).not.toHaveBeenCalled()
    expect(result.current.stateOf(wideboi)).toMatchObject({ kind: 'installed', latest: '0.4.9', beta: false, canGoStable: false })
    expect(result.current.counts.updates).toBe(0)
    expect(result.current.updatable).toEqual([])
    expect(result.current.products).toEqual([wideboi])
  })

  it('installs the stable build through the stable installer', async () => {
    const { result } = renderHook(() => useLibrary([wideboi], {}, false))
    await act(async () => { await result.current.install(wideboi) })
    expect(mocked.installBetaBuild).not.toHaveBeenCalled()
    expect(mocked.downloadAndInstall).toHaveBeenCalledTimes(1)
    expect(mocked.downloadAndInstall.mock.calls[0].slice(-2)).toEqual(['wideboi', '0.4.9'])
    expect(result.current.installedVersions.wideboi).toBe('0.4.9')
  })
})

describe('useLibrary with Beta builds on', () => {
  it('offers the release candidate as the update and counts it', async () => {
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.4.9' }, true))
    await waitFor(() => expect(result.current.stateOf(wideboi).kind).toBe('update'))
    expect(mocked.getBetaManifest).toHaveBeenCalledTimes(1)
    expect(result.current.stateOf(wideboi)).toMatchObject({ latest: '0.5.0-rc1', beta: true })
    expect(result.current.latestOf(wideboi).changelog).toBe('- Mono Width')
    expect(result.current.counts.updates).toBe(1)
    expect(result.current.updatable).toEqual([wideboi])
  })

  it('installs the release candidate, checksum and all, and records its version', async () => {
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.4.9' }, true))
    await waitFor(() => expect(result.current.stateOf(wideboi).kind).toBe('update'))
    await act(async () => { await result.current.install(wideboi) })
    expect(mocked.downloadAndInstall).not.toHaveBeenCalled()
    expect(mocked.installBetaBuild).toHaveBeenCalledWith('wideboi', '0.5.0-rc1', rc1.artefactUrl, SHA, rc1.expiresAt)
    expect(result.current.installedVersions.wideboi).toBe('0.5.0-rc1')
    expect(result.current.stateOf(wideboi)).toMatchObject({ kind: 'installed', canGoStable: true })
    expect(result.current.counts.updates).toBe(0)
  })

  it('Update all takes the release candidate too', async () => {
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.4.9' }, true))
    await waitFor(() => expect(result.current.updatable).toHaveLength(1))
    await act(async () => { await result.current.updateAll() })
    expect(mocked.installBetaBuild).toHaveBeenCalledTimes(1)
    expect(mocked.downloadAndInstall).not.toHaveBeenCalled()
  })

  it('goes back to stable through the stable installer', async () => {
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.5.0-rc1' }, true))
    await waitFor(() => expect(result.current.stateOf(wideboi).canGoStable).toBe(true))
    await act(async () => { await result.current.installStable(wideboi) })
    expect(mocked.installBetaBuild).not.toHaveBeenCalled()
    expect(mocked.downloadAndInstall.mock.calls[0].slice(-2)).toEqual(['wideboi', '0.4.9'])
    expect(result.current.installedVersions.wideboi).toBe('0.4.9')
  })

  it('shows a failed beta install on the tile and leaves the installed version alone', async () => {
    mocked.installBetaBuild.mockRejectedValue('Beta artefact sha256 mismatch')
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.4.9' }, true))
    await waitFor(() => expect(result.current.stateOf(wideboi).kind).toBe('update'))
    await act(async () => { await result.current.install(wideboi) })
    expect(result.current.stateOf(wideboi)).toMatchObject({ kind: 'error', error: 'Beta artefact sha256 mismatch' })
    expect(result.current.installedVersions.wideboi).toBe('0.4.9')
  })

  it('keeps the stable versions and says so when the manifest cannot be read', async () => {
    mocked.getBetaManifest.mockRejectedValue('Beta manifest request failed')
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.4.9' }, true))
    await waitFor(() => expect(result.current.betaError).toBe('Beta manifest request failed'))
    expect(result.current.stateOf(wideboi)).toMatchObject({ kind: 'installed', latest: '0.4.9' })
  })

  it('drops the offers when the switch goes off, and reads them again when it goes on', async () => {
    const { result, rerender } = renderHook(({ beta }) => useLibrary([wideboi], { wideboi: '0.4.9' }, beta), { initialProps: { beta: true } })
    await waitFor(() => expect(result.current.stateOf(wideboi).kind).toBe('update'))
    rerender({ beta: false })
    await waitFor(() => expect(result.current.stateOf(wideboi).kind).toBe('installed'))
    expect(result.current.counts.updates).toBe(0)
    rerender({ beta: true })
    await waitFor(() => expect(result.current.stateOf(wideboi).kind).toBe('update'))
    expect(mocked.getBetaManifest).toHaveBeenCalledTimes(2)
  })

  it('ignores a manifest that arrives after the switch went off', async () => {
    let answer: (list: BetaPlugin[]) => void = () => {}
    mocked.getBetaManifest.mockImplementation(() => new Promise<BetaPlugin[]>((resolve) => { answer = resolve }))
    const { result, rerender } = renderHook(({ beta }) => useLibrary([wideboi], { wideboi: '0.4.9' }, beta), { initialProps: { beta: true } })
    await waitFor(() => expect(mocked.getBetaManifest).toHaveBeenCalled())
    rerender({ beta: false })
    await act(async () => { answer([rc1]) })
    expect(result.current.stateOf(wideboi)).toMatchObject({ kind: 'installed', latest: '0.4.9' })
  })

  it('reads the manifest again when a build expires', async () => {
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.4.9' }, true))
    await waitFor(() => expect(result.current.stateOf(wideboi).kind).toBe('update'))
    mocked.getBetaManifest.mockResolvedValue([])
    await act(async () => { expired?.() })
    await waitFor(() => expect(result.current.stateOf(wideboi).kind).toBe('installed'))
  })

  it('adds a tile for a beta of a plug-in the account list does not have', async () => {
    mocked.getBetaManifest.mockResolvedValue([rc1, { ...rc1, id: 80, pluginSlug: 'hard-q', version: '0.1.0-rc1' }])
    const { result } = renderHook(() => useLibrary([wideboi], { wideboi: '0.4.9' }, true))
    await waitFor(() => expect(result.current.products).toHaveLength(2))
    const hardq = result.current.products[1]
    expect(result.current.stateOf(hardq)).toMatchObject({ kind: 'not_installed', latest: '0.1.0-rc1', beta: true })
    await act(async () => { await result.current.install(hardq) })
    expect(mocked.installBetaBuild).toHaveBeenCalledWith('hard-q', '0.1.0-rc1', rc1.artefactUrl, SHA, rc1.expiresAt)
  })
})

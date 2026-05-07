// Types
export interface User {
  id: number
  email: string
  displayName: string | null
  avatarUrl: string | null
  isAdmin: boolean
}

export interface AuthResponse {
  success: boolean
  token: string | null
  user: User | null
  error: string | null
}

export interface ProductDownloads {
  windows: string | null
  mac: string | null
  linux: string | null
}

export interface Product {
  id: number
  name: string
  slug: string
  description: string
  version: string
  downloads: ProductDownloads
  fileSize: number | null
  changelog: string | null
  category: string
  formats: string[]
}

export interface DownloadProgress {
  file_id: string
  percent: number
  downloaded: number
  total: number
  status: 'downloading' | 'installing' | 'installed' | 'error'
  install_path?: string
}

// Tauri invoke wrapper
const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) throw new Error('Not running in Tauri')
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

// Auth
export async function login(email: string, password: string): Promise<AuthResponse> {
  return invoke<AuthResponse>('login', { email, password })
}

export async function logout(): Promise<void> {
  return invoke('logout')
}

export async function setToken(token: string): Promise<void> {
  return invoke('set_token', { token })
}

export async function getAuthStatus(): Promise<boolean> {
  return invoke<boolean>('get_auth_status')
}

// Products / Downloads
export async function getProducts(): Promise<Product[]> {
  return invoke<Product[]>('get_purchases')
}

// Download + Install
export async function downloadAndInstall(
  fileId: string,
  url: string,
  filename: string,
  category: string,
  productName: string,
  productSlug?: string,
  productVersion?: string,
): Promise<string> {
  try {
    return await invoke<string>('download_and_install', {
      fileId,
      url,
      filename,
      category,
      productName,
      productSlug,
      productVersion,
    })
  } catch (e) {
    // Fallback for older binaries that don't have productSlug/productVersion params
    if (typeof e === 'string' && e.includes('invalid args')) {
      return invoke<string>('download_and_install', {
        fileId,
        url,
        filename,
        category,
        productName,
      })
    }
    throw e
  }
}

// Installed versions registry (slug → version)
export async function getInstalledVersions(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('get_installed_versions')
}

export async function uninstallPlugin(slug: string, category: string): Promise<void> {
  return invoke('uninstall_plugin', { slug, category })
}

export async function openInstallFolder(category: string): Promise<void> {
  return invoke('open_install_folder', { category })
}

// Install path settings
export async function getInstallPaths(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('get_install_paths')
}

export async function setInstallPath(key: string, path: string): Promise<void> {
  return invoke('set_install_path', { key, path })
}

/**
 * The canonical system VST3 path on this platform (Windows: Common Files,
 * macOS: /Library/Audio/Plug-Ins/VST3, Linux: /usr/lib/vst3). Used by the
 * Per-user / System scope toggle in Settings → Paths.
 */
export async function getSystemVst3Dir(): Promise<string> {
  return invoke<string>('system_vst3_dir')
}

/**
 * Probe whether the current user can write to the system VST3 folder
 * without UAC. The v0.18 installer grants `(OI)(CI)(M)` Modify rights
 * via icacls during install (one-time elevated step). On non-Windows
 * this always returns true. On Windows pre-v0.18 installs, returns
 * false and the System toggle is disabled.
 */
export async function probeSystemVst3Writable(): Promise<boolean> {
  return invoke<boolean>('probe_system_vst3_writable')
}

export async function pickFolder(title: string): Promise<string | null> {
  return invoke<string | null>('pick_folder', { title })
}

// Crash report
export interface CrashReport {
  plugin: string
  version: string
  timestamp: string
  logPath: string
}

export async function checkCrashReport(): Promise<CrashReport | null> {
  return invoke<CrashReport | null>('check_crash_report')
}

export async function uploadCrashReport(): Promise<string> {
  return invoke<string>('upload_crash_report')
}

export async function dismissCrashReport(): Promise<void> {
  return invoke('dismiss_crash_report')
}

// Progress event listener
export async function onDownloadProgress(
  callback: (p: DownloadProgress) => void,
): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<DownloadProgress>('dl:progress', (e) => callback(e.payload))
}

// Shared auth cookie on .hardwavestudios.com — all webviews + Suite share one session
const HW_COOKIE = 'hw_auth'
function setHwCookie(t: string) { document.cookie = `${HW_COOKIE}=${encodeURIComponent(t)}; domain=.hardwavestudios.com; path=/; max-age=${7*86400}; secure; samesite=lax` }
function clearHwCookie() { document.cookie = `${HW_COOKIE}=; domain=.hardwavestudios.com; path=/; max-age=0; secure; samesite=lax` }

// Session helpers (persist token across restarts)
export function saveSession(token: string, user: User) {
  localStorage.setItem('hw_token', token)
  localStorage.setItem('hw_user', JSON.stringify(user))
  setHwCookie(token)
}

export function loadSession(): { token: string; user: User } | null {
  const token = localStorage.getItem('hw_token')
  const raw = localStorage.getItem('hw_user')
  if (!token || !raw) return null
  try {
    return { token, user: JSON.parse(raw) as User }
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem('hw_token')
  localStorage.removeItem('hw_user')
  clearHwCookie()
}

// ── Beta channel ──

export type UpdateChannel = 'stable' | 'beta'

export interface SubscriptionInfo {
  hasSubscription: boolean
  betaEligible: boolean
  planName: string | null
  status: string | null
  currentPeriodEnd: string | null
}

export interface BetaPlugin {
  id: number
  pluginSlug: string
  version: string
  releasedAt: string
  expiresAt: string
  hoursUntilExpiry: number
  hoursUntilSoftWarn: number
  artefactUrl: string
  artefactSha256: string
  artefactSize: number
  changelog: string | null
}

export interface BetaWarningEvent {
  slug: string
  version: string
  expires_at: string
}

export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  return invoke<SubscriptionInfo>('get_subscription_info')
}

export async function getBetaManifest(): Promise<BetaPlugin[]> {
  return invoke<BetaPlugin[]>('get_beta_manifest')
}

export async function getUpdateChannel(): Promise<UpdateChannel> {
  const v = await invoke<string>('get_update_channel')
  return v === 'beta' ? 'beta' : 'stable'
}

export async function setUpdateChannel(channel: UpdateChannel): Promise<void> {
  return invoke('set_update_channel', { channel })
}

export async function getAutoAttachCrashLogs(): Promise<boolean> {
  return invoke<boolean>('get_auto_attach_crash_logs')
}

export async function setAutoAttachCrashLogs(enabled: boolean): Promise<void> {
  return invoke('set_auto_attach_crash_logs', { enabled })
}

export async function installBetaBuild(
  slug: string,
  version: string,
  url: string,
  sha256: string,
  expiresAt: string,
): Promise<string> {
  return invoke<string>('install_beta_build', {
    slug,
    version,
    url,
    sha256,
    expiresAt,
  })
}

export async function openExternalUrl(url: string): Promise<void> {
  return invoke('open_external_url', { url })
}

export async function onBetaSoftWarning(
  callback: (e: BetaWarningEvent) => void,
): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<BetaWarningEvent>('beta:soft-warning', (e) => callback(e.payload))
}

export async function onBetaExpired(
  callback: (e: BetaWarningEvent) => void,
): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<BetaWarningEvent>('beta:expired', (e) => callback(e.payload))
}

// ── User theme (per-user palette) ──
//
// Backend contract (mirrored exactly here — do NOT drift):
//   GET    /api/user/theme  → UserTheme
//   POST   /api/user/theme  → { ok: true, theme: UserTheme }
//   DELETE /api/user/theme  → resets to default, returns UserTheme

export interface UserThemeApplyTo {
  suite: boolean
  plugins: boolean
  splash: boolean
}

export interface UserTheme {
  primary: string       // '#RRGGBB'
  accent: string        // '#RRGGBB'
  glowStrength: number  // 0..1
  applyTo: UserThemeApplyTo
}

export type UserThemePatch = Partial<{
  primary: string
  accent: string
  glowStrength: number
  applyTo: Partial<UserThemeApplyTo>
}>

const THEME_API = 'https://hardwavestudios.com/api/user/theme'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('hw_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getUserTheme(): Promise<UserTheme> {
  const res = await fetch(THEME_API, {
    method: 'GET',
    credentials: 'include',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to load theme (${res.status})`)
  return res.json() as Promise<UserTheme>
}

export async function setUserTheme(patch: UserThemePatch): Promise<UserTheme> {
  const res = await fetch(THEME_API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Failed to save theme (${res.status})`)
  const body = await res.json() as { ok: boolean; theme: UserTheme }
  return body.theme
}

export async function resetUserTheme(): Promise<UserTheme> {
  const res = await fetch(THEME_API, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to reset theme (${res.status})`)
  return res.json() as Promise<UserTheme>
}

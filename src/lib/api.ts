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
): Promise<string> {
  return invoke<string>('download_and_install', {
    fileId,
    url,
    filename,
    category,
    productName,
  })
}

export async function openInstallFolder(category: string): Promise<void> {
  return invoke('open_install_folder', { category })
}

// Progress event listener
export async function onDownloadProgress(
  callback: (p: DownloadProgress) => void,
): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<DownloadProgress>('dl:progress', (e) => callback(e.payload))
}

// Session helpers (persist token across restarts)
export function saveSession(token: string, user: User) {
  localStorage.setItem('hw_token', token)
  localStorage.setItem('hw_user', JSON.stringify(user))
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
}

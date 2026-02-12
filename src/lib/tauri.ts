// Tauri API wrapper - replaces Electron IPC calls
import type { File, Tag, Collection } from '../types'

// Check if running in Tauri or browser
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

// Tauri API types
type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
type OpenFn = (options: unknown) => Promise<unknown>
// Dynamic imports for Tauri APIs (only when in Tauri)
let invoke: InvokeFn | null = null
let open: OpenFn | null = null

if (isTauri) {
  import('@tauri-apps/api/core').then(m => { invoke = m.invoke as InvokeFn })
  import('@tauri-apps/plugin-dialog').then(m => { open = m.open as OpenFn })
}

// Browser mock data for UI preview
const mockFiles: File[] = [
  { id: 1, filename: 'Hardstyle_Kick_01.wav', file_path: '/samples/kicks/Hardstyle_Kick_01.wav', file_type: 'sample', file_extension: 'wav', file_size: 245000, hash: 'abc123', created_at: Date.now(), modified_at: Date.now(), indexed_at: Date.now(), bpm: 150, detected_key: 'F', rating: 4, is_favorite: true, use_count: 12 },
  { id: 2, filename: 'Raw_Kick_Layered.wav', file_path: '/samples/kicks/Raw_Kick_Layered.wav', file_type: 'sample', file_extension: 'wav', file_size: 312000, hash: 'def456', created_at: Date.now(), modified_at: Date.now(), indexed_at: Date.now(), bpm: 155, detected_key: 'G', rating: 5, is_favorite: true, use_count: 28 },
  { id: 3, filename: 'Euphoric_Lead_Melody.wav', file_path: '/samples/leads/Euphoric_Lead_Melody.wav', file_type: 'sample', file_extension: 'wav', file_size: 1240000, hash: 'ghi789', created_at: Date.now(), modified_at: Date.now(), indexed_at: Date.now(), bpm: 150, detected_key: 'A', rating: 3, is_favorite: false, use_count: 5 },
  { id: 4, filename: 'Screechy_Lead_01.wav', file_path: '/samples/leads/Screechy_Lead_01.wav', file_type: 'sample', file_extension: 'wav', file_size: 890000, hash: 'jkl012', created_at: Date.now(), modified_at: Date.now(), indexed_at: Date.now(), bpm: 160, detected_key: 'E', rating: 4, is_favorite: false, use_count: 8 },
  { id: 5, filename: 'Hardcore_Snare_Hit.wav', file_path: '/samples/snares/Hardcore_Snare_Hit.wav', file_type: 'sample', file_extension: 'wav', file_size: 156000, hash: 'mno345', created_at: Date.now(), modified_at: Date.now(), indexed_at: Date.now(), bpm: 180, rating: 5, is_favorite: true, use_count: 45 },
  { id: 6, filename: 'Reverse_FX_Buildup.wav', file_path: '/samples/fx/Reverse_FX_Buildup.wav', file_type: 'sample', file_extension: 'wav', file_size: 2100000, hash: 'pqr678', created_at: Date.now(), modified_at: Date.now(), indexed_at: Date.now(), bpm: 150, rating: 3, is_favorite: false, use_count: 3 },
  { id: 7, filename: 'Distorted_Bass_Loop.wav', file_path: '/samples/bass/Distorted_Bass_Loop.wav', file_type: 'loop', file_extension: 'wav', file_size: 3200000, hash: 'stu901', created_at: Date.now(), modified_at: Date.now(), indexed_at: Date.now(), bpm: 150, detected_key: 'F', rating: 4, is_favorite: false, use_count: 15 },
  { id: 8, filename: 'Atmospheric_Pad.wav', file_path: '/samples/pads/Atmospheric_Pad.wav', file_type: 'sample', file_extension: 'wav', file_size: 4500000, hash: 'vwx234', created_at: Date.now(), modified_at: Date.now(), indexed_at: Date.now(), detected_key: 'C', rating: 2, is_favorite: false, use_count: 1 },
]

const mockTags: Tag[] = [
  { id: 1, name: 'Hardstyle', category: 'genre', color: '#00d4ff', created_at: Date.now() },
  { id: 2, name: 'Rawstyle', category: 'genre', color: '#a855f7', created_at: Date.now() },
  { id: 3, name: 'Hardcore', category: 'genre', color: '#ef4444', created_at: Date.now() },
  { id: 4, name: 'Kick', category: 'instrument', color: '#f97316', created_at: Date.now() },
  { id: 5, name: 'Lead', category: 'instrument', color: '#00d4ff', created_at: Date.now() },
  { id: 6, name: 'FX', category: 'instrument', color: '#a855f7', created_at: Date.now() },
  { id: 7, name: 'Dark', category: 'energy', color: '#64748b', created_at: Date.now() },
  { id: 8, name: 'Euphoric', category: 'energy', color: '#eab308', created_at: Date.now() },
]

const mockCollections: Collection[] = [
  { id: 1, name: 'Bangers 2024', color: '#ef4444', file_count: 234, created_at: Date.now(), updated_at: Date.now(), is_smart: false },
  { id: 2, name: 'Kicks WIP', color: '#00d4ff', file_count: 89, created_at: Date.now(), updated_at: Date.now(), is_smart: false },
  { id: 3, name: 'Collab Project', color: '#22c55e', file_count: 45, created_at: Date.now(), updated_at: Date.now(), is_smart: false },
]

// Types matching Rust backend
interface RustFile {
  id?: number
  file_path: string
  filename: string
  file_type: string
  file_extension: string
  file_size: number
  hash: string
  created_at: number
  modified_at: number
  indexed_at: number
  duration?: number
  sample_rate?: number
  bit_depth?: number
  channels?: number
  bpm?: number
  detected_key?: string
  detected_scale?: string
  energy_level?: number
  notes?: string
  rating: number
  color_code?: string
  is_favorite: boolean
  use_count: number
}

interface RustTag {
  id: number
  name: string
  category?: string
  color?: string
  created_at: number
}

interface RustCollection {
  id: number
  name: string
  description?: string
  color?: string
  is_smart: boolean
  smart_query?: string
  created_at: number
  updated_at: number
  file_count: number
}

interface RustCollectionWithFiles {
  collection: RustCollection
  files: RustFile[]
}

interface RustStats {
  totalFiles: number
  totalTags: number
  totalCollections: number
  totalFavorites: number
}

interface RustScanResult {
  indexed: number
  duplicates: number
  errors: number
}

interface RustAuthResponse {
  success: boolean
  token?: string
  user?: {
    id: number
    email: string
    display_name?: string
  }
  error?: string
}

interface FileUpdatePayload {
  notes?: string
  rating?: number
  color_code?: string
  is_favorite?: boolean
  bpm?: number
  detected_key?: string
}

// Transform Rust types to frontend types
function toFile(rust: RustFile): File {
  return {
    id: rust.id ?? 0,
    file_path: rust.file_path,
    filename: rust.filename,
    file_type: rust.file_type as File['file_type'],
    file_extension: rust.file_extension,
    file_size: rust.file_size,
    hash: rust.hash,
    created_at: rust.created_at,
    modified_at: rust.modified_at,
    indexed_at: rust.indexed_at,
    duration: rust.duration,
    sample_rate: rust.sample_rate,
    bit_depth: rust.bit_depth,
    channels: rust.channels,
    bpm: rust.bpm,
    detected_key: rust.detected_key,
    detected_scale: rust.detected_scale,
    energy_level: rust.energy_level,
    notes: rust.notes,
    rating: rust.rating,
    color_code: rust.color_code,
    is_favorite: rust.is_favorite,
    use_count: rust.use_count,
  }
}

function toTag(rust: RustTag): Tag {
  return {
    id: rust.id,
    name: rust.name,
    category: (rust.category || 'custom') as Tag['category'],
    color: rust.color,
    created_at: rust.created_at,
  }
}

function toCollection(rust: RustCollection): Collection {
  return {
    id: rust.id,
    name: rust.name,
    description: rust.description,
    color: rust.color,
    file_count: rust.file_count,
    created_at: rust.created_at,
    updated_at: rust.updated_at,
    is_smart: rust.is_smart,
  }
}

// Store token in memory for session
let authToken: string | null = null
let userData: RustAuthResponse['user'] | null = null

// Auth API
export const auth = {
  async login(email: string, password: string): Promise<{
    success: boolean
    error?: string
    data?: {
      user: { email: string; displayName: string | null; isAdmin: boolean }
      subscription?: { status: string }
    }
  }> {
    // Browser mock - auto success
    if (!isTauri) {
      localStorage.setItem('auth_token', 'mock_token')
      localStorage.setItem('auth_user', JSON.stringify({ email, display_name: 'Demo User' }))
      return {
        success: true,
        data: {
          user: { email, displayName: 'Demo User', isAdmin: false },
          subscription: { status: 'active' },
        },
      }
    }

    try {
      const response = await invoke!<RustAuthResponse>('login', { email, password })
      if (response.success && response.token) {
        authToken = response.token
        userData = response.user || null
        localStorage.setItem('auth_token', response.token)
        if (response.user) {
          localStorage.setItem('auth_user', JSON.stringify(response.user))
        }
        return {
          success: true,
          data: {
            user: {
              email: response.user?.email || email,
              displayName: response.user?.display_name || null,
              isAdmin: false,
            },
            subscription: { status: 'active' },
          },
        }
      }
      return { success: false, error: response.error || 'Login failed' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },

  async logout(): Promise<{ success: boolean }> {
    if (!isTauri) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      return { success: true }
    }

    try {
      await invoke!('logout')
      authToken = null
      userData = null
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      return { success: true }
    } catch {
      return { success: false }
    }
  },

  async verify(): Promise<{
    valid: boolean
    hasSubscription: boolean
    data?: {
      user: { email: string; displayName: string | null }
    }
  }> {
    // Browser mock - check localStorage
    if (!isTauri) {
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('auth_user')
      if (storedToken && storedUser) {
        const user = JSON.parse(storedUser)
        return {
          valid: true,
          hasSubscription: true,
          data: { user: { email: user.email, displayName: user.display_name || null } },
        }
      }
      return { valid: false, hasSubscription: false }
    }

    try {
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('auth_user')

      if (storedToken && storedUser) {
        authToken = storedToken
        userData = JSON.parse(storedUser)

        const isValid = await invoke!<boolean>('get_auth_status')
        if (isValid) {
          return {
            valid: true,
            hasSubscription: true,
            data: {
              user: {
                email: userData?.email || '',
                displayName: userData?.display_name || null,
              },
            },
          }
        }
      }
      return { valid: false, hasSubscription: false }
    } catch {
      return { valid: false, hasSubscription: false }
    }
  },

  async getUser() {
    if (userData) {
      return {
        user: userData,
        subscription: { status: 'active' },
      }
    }
    return null
  },

  async hasSubscription(): Promise<boolean> {
    return authToken !== null
  },

  async openSubscribe(): Promise<void> {
    const { open: openUrl } = await import('@tauri-apps/plugin-shell')
    await openUrl('https://hardwavestudios.com/subscribe')
  },
}

// Files API
export const files = {
  async getAll(limit?: number, offset?: number): Promise<File[]> {
    if (!isTauri) {
      const start = offset || 0
      const end = start + (limit || 100)
      return mockFiles.slice(start, end)
    }

    try {
      const rustFiles = await invoke!<RustFile[]>('get_files', { limit, offset })
      return rustFiles.map(toFile)
    } catch (error) {
      console.error('Error getting files:', error)
      return []
    }
  },

  async getById(id: number): Promise<File | null> {
    if (!isTauri) return mockFiles.find(f => f.id === id) || null

    try {
      const rustFile = await invoke!<RustFile | null>('get_file_by_id', { id })
      return rustFile ? toFile(rustFile) : null
    } catch {
      return null
    }
  },

  async search(query: string, filters: Record<string, unknown>): Promise<{ files: File[] }> {
    if (!isTauri) {
      const q = query.toLowerCase()
      const filtered = mockFiles.filter(f => f.filename.toLowerCase().includes(q))
      return { files: filtered }
    }

    try {
      const limit = (filters.limit as number) || 100
      const offset = (filters.offset as number) || 0
      const rustFiles = await invoke!<RustFile[]>('search_files', { query, limit, offset })
      return { files: rustFiles.map(toFile) }
    } catch (error) {
      console.error('Error searching files:', error)
      return { files: [] }
    }
  },

  async update(id: number, data: Partial<FileUpdatePayload>): Promise<void> {
    if (!isTauri) {
      const file = mockFiles.find(f => f.id === id)
      if (file) Object.assign(file, data)
      return
    }
    await invoke!('update_file', { id, updates: data })
  },

  async delete(id: number): Promise<void> {
    if (!isTauri) return
    await invoke!('delete_file', { id })
  },

  async deleteMany(ids: number[]): Promise<{ deleted: number }> {
    if (!isTauri) return { deleted: ids.length }
    const deleted = await invoke!<number>('delete_files', { ids })
    return { deleted }
  },

  async bulkTag(fileIds: number[], tagIds: number[]): Promise<void> {
    if (!isTauri) return
    await invoke!('tag_files', { fileIds, tagIds })
  },

  async bulkUntag(fileIds: number[], tagIds: number[]): Promise<void> {
    if (!isTauri) return
    await invoke!('untag_files', { fileIds, tagIds })
  },

  async getFileTags(fileId: number): Promise<Tag[]> {
    if (!isTauri) return mockTags.slice(0, 2)

    try {
      const rustTags = await invoke!<RustTag[]>('get_file_tags', { fileId })
      return rustTags.map(toTag)
    } catch {
      return []
    }
  },

  async sync(_files: unknown[]): Promise<{ results: unknown[] }> {
    return { results: [] }
  },
}

// Tags API
export const tags = {
  async getAll(): Promise<Tag[]> {
    if (!isTauri) return mockTags

    try {
      const rustTags = await invoke!<RustTag[]>('get_tags')
      return rustTags.map(toTag)
    } catch (error) {
      console.error('Error getting tags:', error)
      return []
    }
  },

  async create(data: { name: string; category: string; color: string }): Promise<Tag> {
    if (!isTauri) {
      const newTag: Tag = { id: mockTags.length + 1, name: data.name, category: data.category as Tag['category'], color: data.color, created_at: Date.now() }
      mockTags.push(newTag)
      return newTag
    }

    const rustTag = await invoke!<RustTag>('create_tag', {
      name: data.name,
      category: data.category,
      color: data.color,
    })
    return toTag(rustTag)
  },

  async update(id: number, data: { name?: string; category?: string; color?: string }): Promise<void> {
    if (!isTauri) return
    await invoke!('update_tag', { id, updates: data })
  },

  async delete(id: number): Promise<void> {
    if (!isTauri) return
    await invoke!('delete_tag', { id })
  },

  async getFilesByTag(tagId: number, limit?: number, offset?: number): Promise<File[]> {
    if (!isTauri) return mockFiles.slice(0, 3)

    try {
      const rustFiles = await invoke!<RustFile[]>('get_files_by_tag', { tagId, limit, offset })
      return rustFiles.map(toFile)
    } catch {
      return []
    }
  },
}

// Collections API
export const collections = {
  async getAll(): Promise<Collection[]> {
    if (!isTauri) return mockCollections

    try {
      const rustCollections = await invoke!<RustCollection[]>('get_collections')
      return rustCollections.map(toCollection)
    } catch (error) {
      console.error('Error getting collections:', error)
      return []
    }
  },

  async getById(collectionId: number): Promise<{ collection: Collection; files: File[] } | null> {
    if (!isTauri) {
      const col = mockCollections.find(c => c.id === collectionId)
      if (col) return { collection: col, files: mockFiles.slice(0, 4) }
      return null
    }

    try {
      const result = await invoke!<RustCollectionWithFiles | null>('get_collection_by_id', { id: collectionId })
      if (result) {
        return {
          collection: toCollection(result.collection),
          files: result.files.map(toFile),
        }
      }
      return null
    } catch {
      return null
    }
  },

  async create(data: { name: string; color?: string; description?: string }): Promise<Collection> {
    if (!isTauri) {
      const newCol: Collection = { id: mockCollections.length + 1, name: data.name, color: data.color, description: data.description, file_count: 0, created_at: Date.now(), updated_at: Date.now(), is_smart: false }
      mockCollections.push(newCol)
      return newCol
    }

    const rustCollection = await invoke!<RustCollection>('create_collection', {
      name: data.name,
      color: data.color,
      description: data.description,
    })
    return toCollection(rustCollection)
  },

  async update(id: number, data: { name?: string; description?: string; color?: string }): Promise<void> {
    if (!isTauri) return
    await invoke!('update_collection', { id, updates: data })
  },

  async delete(id: number): Promise<void> {
    if (!isTauri) return
    await invoke!('delete_collection', { id })
  },

  async addFiles(collectionId: number, fileIds: number[]): Promise<void> {
    if (!isTauri) return
    await invoke!('add_files_to_collection', { collectionId, fileIds })
  },

  async removeFiles(collectionId: number, fileIds: number[]): Promise<void> {
    if (!isTauri) return
    await invoke!('remove_files_from_collection', { collectionId, fileIds })
  },

  async getFiles(collectionId: number): Promise<File[]> {
    if (!isTauri) return mockFiles.slice(0, 4)

    try {
      const rustFiles = await invoke!<RustFile[]>('get_collection_files', { collectionId })
      return rustFiles.map(toFile)
    } catch {
      return []
    }
  },
}

// Stats API
export const stats = {
  async get(): Promise<RustStats> {
    if (!isTauri) {
      return {
        totalFiles: mockFiles.length,
        totalTags: mockTags.length,
        totalCollections: mockCollections.length,
        totalFavorites: mockFiles.filter(f => f.is_favorite).length,
      }
    }

    try {
      return await invoke!<RustStats>('get_stats')
    } catch (error) {
      console.error('Error getting stats:', error)
      return {
        totalFiles: 0,
        totalTags: 0,
        totalCollections: 0,
        totalFavorites: 0,
      }
    }
  },
}

// Scan progress type
interface ScanProgress {
  total: number
  indexed: number
  current_file?: string
  status: 'scanning' | 'analyzing' | 'complete' | 'error'
}

// Folders API
export const folders = {
  async selectFolder(): Promise<string | null> {
    if (!isTauri) {
      alert('Folder selection not available in browser preview mode')
      return null
    }

    const result = await open!({
      directory: true,
      multiple: false,
      title: 'Select folder to import',
    })
    return result as string | null
  },

  async scan(folderPath: string, _options?: unknown): Promise<RustScanResult> {
    if (!isTauri) return { indexed: 0, duplicates: 0, errors: 0 }
    return await invoke!<RustScanResult>('scan_folder', { path: folderPath })
  },

  async scanMultiple(folderPaths: string[], options?: unknown): Promise<RustScanResult[]> {
    const results: RustScanResult[] = []
    for (const path of folderPaths) {
      const result = await this.scan(path, options)
      results.push(result)
    }
    return results
  },

  onScanProgress(_callback: (progress: ScanProgress) => void): () => void {
    // TODO: Implement progress events with Tauri events
    return () => {}
  },
}

// Update types
interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

// Store update state and callbacks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pendingUpdate: any = null
let updateCallbacks: {
  onChecking: (() => void)[]
  onAvailable: ((info: UpdateInfo) => void)[]
  onNotAvailable: (() => void)[]
  onProgress: ((progress: UpdateProgress) => void)[]
  onDownloaded: ((info: UpdateInfo) => void)[]
  onError: ((error: { message: string }) => void)[]
} = {
  onChecking: [],
  onAvailable: [],
  onNotAvailable: [],
  onProgress: [],
  onDownloaded: [],
  onError: [],
}

// Updates API
export const updates = {
  async check(): Promise<void> {
    if (!isTauri) return

    // Notify checking
    updateCallbacks.onChecking.forEach(cb => cb())

    try {
      // Dynamic import to avoid SSR issues
      const { check: checkUpdate } = await import('@tauri-apps/plugin-updater')
      const update = await checkUpdate()

      if (update) {
        pendingUpdate = update
        updateCallbacks.onAvailable.forEach(cb => cb({
          version: update.version,
          releaseNotes: update.body || undefined,
        }))
      } else {
        updateCallbacks.onNotAvailable.forEach(cb => cb())
      }
    } catch (error) {
      console.error('Error checking for updates:', error)
      updateCallbacks.onError.forEach(cb => cb({ message: String(error) }))
    }
  },

  async checkManual(): Promise<void> {
    await this.check()
  },

  async download(): Promise<void> {
    if (!isTauri || !pendingUpdate) return

    try {
      let contentLength = 0
      let downloaded = 0
      await pendingUpdate.downloadAndInstall((event: { event: string; data: { contentLength?: number; chunkLength?: number } }) => {
        // Handle DownloadEvent from Tauri updater
        if (event.event === 'Started') {
          contentLength = event.data.contentLength || 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength || 0
          const percent = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
          updateCallbacks.onProgress.forEach(cb => cb({
            percent,
            bytesPerSecond: 0,
            transferred: downloaded,
            total: contentLength,
          }))
        } else if (event.event === 'Finished') {
          updateCallbacks.onProgress.forEach(cb => cb({
            percent: 100,
            bytesPerSecond: 0,
            transferred: contentLength,
            total: contentLength,
          }))
        }
      })

      // Download complete
      updateCallbacks.onDownloaded.forEach(cb => cb({
        version: pendingUpdate?.version || '',
      }))
    } catch (error) {
      console.error('Error downloading update:', error)
      updateCallbacks.onError.forEach(cb => cb({ message: String(error) }))
    }
  },

  async install(): Promise<void> {
    // In Tauri 2, downloadAndInstall handles both
    // After download completes, app will restart automatically
    await this.download()
  },

  onChecking(callback: () => void): () => void {
    updateCallbacks.onChecking.push(callback)
    return () => {
      updateCallbacks.onChecking = updateCallbacks.onChecking.filter(cb => cb !== callback)
    }
  },

  onAvailable(callback: (info: UpdateInfo) => void): () => void {
    updateCallbacks.onAvailable.push(callback)
    return () => {
      updateCallbacks.onAvailable = updateCallbacks.onAvailable.filter(cb => cb !== callback)
    }
  },

  onNotAvailable(callback: () => void): () => void {
    updateCallbacks.onNotAvailable.push(callback)
    return () => {
      updateCallbacks.onNotAvailable = updateCallbacks.onNotAvailable.filter(cb => cb !== callback)
    }
  },

  onProgress(callback: (progress: UpdateProgress) => void): () => void {
    updateCallbacks.onProgress.push(callback)
    return () => {
      updateCallbacks.onProgress = updateCallbacks.onProgress.filter(cb => cb !== callback)
    }
  },

  onDownloaded(callback: (info: UpdateInfo) => void): () => void {
    updateCallbacks.onDownloaded.push(callback)
    return () => {
      updateCallbacks.onDownloaded = updateCallbacks.onDownloaded.filter(cb => cb !== callback)
    }
  },

  onError(callback: (error: { message: string }) => void): () => void {
    updateCallbacks.onError.push(callback)
    return () => {
      updateCallbacks.onError = updateCallbacks.onError.filter(cb => cb !== callback)
    }
  },
}

// Audio API
export const audio = {
  async analyze(_fileId: number, _filePath: string): Promise<boolean> {
    // Audio analysis happens during scanning in Rust
    return true
  },

  async batchAnalyze(_files: Array<{ id: number; file_path: string }>): Promise<{ success: number; failed: number }> {
    return { success: 0, failed: 0 }
  },

  onProgress(_callback: (progress: unknown) => void): () => void {
    return () => {}
  },
}

// FL Studio integration
export const fl = {
  async dragFile(_fileId: number): Promise<unknown> {
    // TODO: Implement drag support
    return null
  },
}

// Cloud types
interface UploadProgress {
  current: number
  total: number
  currentFile: {
    filename: string
    loaded: number
    total: number
    percent: number
    status: 'pending' | 'uploading' | 'complete' | 'error'
    error?: string
  } | null
  completed: unknown[]
  failed: { filename: string; error: string }[]
}

interface DownloadProgress {
  percent: number
  bytesPerSecond: number
}

interface StorageInfo {
  used_bytes: number
  used_formatted: string
  file_count: number
  quota_bytes: number
  quota_formatted: string
  quota_unlimited: boolean
  usage_percent: number
}

interface ShareResult {
  share_token: string
  share_url: string
  is_public: boolean
}

// Cloud API (placeholder for cloud sync)
export const cloud = {
  async selectFilesForUpload(): Promise<string[] | null> {
    if (!isTauri || !open) return null

    const result = await open({
      directory: false,
      multiple: true,
      title: 'Select files to upload',
      filters: [{ name: 'Audio Files', extensions: ['wav', 'mp3', 'flac', 'ogg', 'aiff'] }],
    })
    return result as string[] | null
  },

  async uploadFiles(_filePaths: string[]): Promise<{
    current: number
    total: number
    currentFile: unknown
    completed: unknown[]
    failed: { filename: string; error: string }[]
  }> {
    throw new Error('Cloud upload not yet implemented')
  },

  async uploadFile(_filePath: string): Promise<{ success: boolean; file?: unknown; error?: string }> {
    throw new Error('Cloud upload not yet implemented')
  },

  async getFiles(_page?: number, _limit?: number): Promise<{ files: unknown[]; pagination: unknown }> {
    return { files: [], pagination: {} }
  },

  async getFile(_id: number): Promise<unknown> {
    return null
  },

  async deleteFile(_id: number): Promise<{ success: boolean }> {
    return { success: false }
  },

  async downloadFile(
    _id: number,
    _originalFilename: string
  ): Promise<{
    success: boolean
    canceled?: boolean
    error?: string
  }> {
    return { success: false }
  },

  async shareFile(_id: number): Promise<ShareResult> {
    throw new Error('Cloud sharing not yet implemented')
  },

  async revokeShare(_id: number): Promise<{ success: boolean }> {
    return { success: false }
  },

  async getSharedWithMe(): Promise<unknown[]> {
    return []
  },

  async getStorage(): Promise<StorageInfo> {
    return {
      used_bytes: 0,
      used_formatted: '0 B',
      file_count: 0,
      quota_bytes: 0,
      quota_formatted: '0 B',
      quota_unlimited: false,
      usage_percent: 0,
    }
  },

  async copyShareLink(_shareUrl: string): Promise<{ success: boolean }> {
    return { success: false }
  },

  async openShareLink(_shareUrl: string): Promise<{ success: boolean }> {
    return { success: false }
  },

  onUploadProgress(_callback: (progress: UploadProgress) => void): () => void {
    return () => {}
  },

  onDownloadProgress(_callback: (progress: DownloadProgress) => void): () => void {
    return () => {}
  },
}

// Export unified API that mimics window.electron
export const tauri = {
  getVersion: async () => {
    if (!isTauri) return 'dev'
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      return await getVersion()
    } catch {
      return 'unknown'
    }
  },
  getPlatform: async () => 'tauri',
  ping: async () => 'pong',
  auth,
  updates,
  files,
  tags,
  collections,
  stats,
  folders,
  audio,
  fl,
  cloud,
}

// Attach to window for compatibility
declare global {
  interface Window {
    electron: typeof tauri
  }
}

if (typeof window !== 'undefined') {
  window.electron = tauri
}

export default tauri

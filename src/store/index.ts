import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { File, Tag, Collection, Purchase, DownloadState } from '../types'
import type { FilterState } from '../components/FilterPanel'
import type { Tool } from '../components/ToolSwitcher'

// ==================== Types ====================

interface AuthState {
  isAuthenticated: boolean
  hasSubscription: boolean
  isLoading: boolean
  user: { email: string; displayName: string | null } | null
  error?: string
}

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

interface UpdateState {
  available: boolean
  downloading: boolean
  downloaded: boolean
  info: UpdateInfo | null
  progress: UpdateProgress | null
  error?: string
  showPopup: boolean
}

interface Stats {
  totalFiles: number
  totalTags: number
  totalCollections: number
  totalFavorites: number
}

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
  fileId: number | null
}

const defaultFilters: FilterState = {
  bpmMin: null,
  bpmMax: null,
  keys: [],
  fileTypes: [],
  tagIds: [],
  isFavorite: null,
  minRating: null,
}

const PAGE_SIZE = 100

// ==================== Store Interface ====================

interface AppStore {
  // Auth
  auth: AuthState
  setAuth: (auth: Partial<AuthState>) => void
  verifyAuth: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>

  // Updates
  update: UpdateState
  setUpdate: (update: Partial<UpdateState>) => void
  downloadUpdate: () => void
  installUpdate: () => void
  dismissUpdate: () => void
  checkUpdates: () => void

  // Navigation
  currentTool: Tool
  setCurrentTool: (tool: Tool) => void

  // Files
  files: File[]
  setFiles: (files: File[]) => void
  hasMoreFiles: boolean
  isLoadingMore: boolean
  loadData: () => Promise<void>
  loadMoreFiles: () => Promise<void>
  searchFiles: (query: string) => Promise<void>
  toggleFavorite: (fileId: number) => Promise<void>
  deleteFiles: (fileIds: number[]) => Promise<void>

  // Tags
  tags: Tag[]
  setTags: (tags: Tag[]) => void
  createTag: (name: string, category: string, color: string) => Promise<void>
  deleteTag: (id: number) => Promise<void>
  addTagsToFiles: (fileIds: number[], tagIds: number[]) => Promise<void>

  // Collections
  collections: Collection[]
  setCollections: (collections: Collection[]) => void
  createCollection: (name: string, color: string, description: string) => Promise<void>
  addFilesToCollection: (collectionId: number, fileIds: number[]) => Promise<void>

  // Stats
  stats: Stats
  setStats: (stats: Stats) => void

  // Search & Filters
  searchQuery: string
  setSearchQuery: (query: string) => void
  filters: FilterState
  setFilters: (filters: FilterState) => void
  applyFilters: (filters: FilterState) => Promise<void>
  resetFilters: () => void

  // View State
  currentView: 'all' | 'samples' | 'projects' | 'favorites' | 'recent'
  setCurrentView: (view: 'all' | 'samples' | 'projects' | 'favorites' | 'recent') => void
  selectedCollectionId: number | null
  setSelectedCollectionId: (id: number | null) => void
  selectedTagId: number | null
  setSelectedTagId: (id: number | null) => void

  // Selection
  selectedFiles: number[]
  setSelectedFiles: (files: number[]) => void
  toggleFileSelection: (fileId: number) => void
  clearSelection: () => void

  // Audio Playback
  currentlyPlaying: number | null
  audioElement: HTMLAudioElement | null
  playFile: (file: File) => void
  stopPlayback: () => void

  // Modal States
  modals: {
    import: boolean
    tagManagement: boolean
    createCollection: boolean
    addTags: boolean
    addToCollection: boolean
    filterPanel: boolean
    confirmDelete: boolean
  }
  openModal: (modal: keyof AppStore['modals']) => void
  closeModal: (modal: keyof AppStore['modals']) => void

  // Details Panel
  detailsPanelFile: File | null
  setDetailsPanelFile: (file: File | null) => void
  updateFileRating: (rating: number) => Promise<void>

  // Context Menu
  contextMenu: ContextMenuState
  openContextMenu: (x: number, y: number, fileId: number) => void
  closeContextMenu: () => void

  // Collection/Tag Click Handlers
  handleCollectionClick: (collectionId: number) => Promise<void>
  handleTagClick: (tagId: number) => Promise<void>

  // Import
  importFolder: () => Promise<void>

  // Purchases / Downloads
  purchases: Purchase[]
  activeDownloads: Record<string, DownloadState>
  loadPurchases: () => Promise<void>
  downloadAndInstall: (fileId: string, url: string, filename: string, category: string, productName: string) => Promise<void>
  openInstallFolder: (category: string) => Promise<void>
}

// ==================== Store Implementation ====================

export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => ({
    // ==================== Auth ====================
    auth: {
      isAuthenticated: false,
      hasSubscription: false,
      isLoading: true,
      user: null,
    },

    setAuth: (auth) => set((state) => ({ auth: { ...state.auth, ...auth } })),

    verifyAuth: async () => {
      try {
        const result = await window.electron.auth.verify()
        if (result.valid && result.data) {
          set({
            auth: {
              isAuthenticated: true,
              hasSubscription: result.hasSubscription,
              isLoading: false,
              user: {
                email: result.data.user.email,
                displayName: result.data.user.displayName,
              },
            },
          })
          if (result.hasSubscription) {
            get().loadData()
          }
        } else {
          set({
            auth: {
              isAuthenticated: false,
              hasSubscription: false,
              isLoading: false,
              user: null,
            },
          })
        }
      } catch (error) {
        console.error('Auth verification error:', error)
        set({
          auth: {
            isAuthenticated: false,
            hasSubscription: false,
            isLoading: false,
            user: null,
          },
        })
      }
    },

    login: async (email, password) => {
      const result = await window.electron.auth.login(email, password)
      if (result.success && result.data) {
        const hasSubscription =
          result.data.subscription?.status === 'active' ||
          result.data.subscription?.status === 'trialing' ||
          result.data.user.isAdmin
        set({
          auth: {
            isAuthenticated: true,
            hasSubscription,
            isLoading: false,
            user: {
              email: result.data.user.email,
              displayName: result.data.user.displayName,
            },
          },
        })
        if (hasSubscription) {
          get().loadData()
        }
      } else {
        set((state) => ({
          auth: { ...state.auth, error: result.error || 'Login failed' },
        }))
        throw new Error(result.error || 'Login failed')
      }
    },

    logout: async () => {
      await window.electron.auth.logout()
      set({
        auth: {
          isAuthenticated: false,
          hasSubscription: false,
          isLoading: false,
          user: null,
        },
        files: [],
        tags: [],
        collections: [],
      })
    },

    // ==================== Updates ====================
    update: {
      available: false,
      downloading: false,
      downloaded: false,
      info: null,
      progress: null,
      showPopup: false,
    },

    setUpdate: (update) => set((state) => ({ update: { ...state.update, ...update } })),

    downloadUpdate: () => {
      window.electron.updates.download()
      set((state) => ({ update: { ...state.update, downloading: true } }))
    },

    installUpdate: () => {
      window.electron.updates.install()
    },

    dismissUpdate: () => {
      set((state) => ({ update: { ...state.update, showPopup: false } }))
    },

    checkUpdates: () => {
      window.electron.updates.checkManual()
    },

    // ==================== Navigation ====================
    currentTool: 'hub',
    setCurrentTool: (tool) => set({ currentTool: tool }),

    // ==================== Files ====================
    files: [],
    setFiles: (files) => set({ files }),
    hasMoreFiles: true,
    isLoadingMore: false,

    loadData: async () => {
      try {
        const [loadedFiles, loadedTags, loadedCollections, loadedStats] = await Promise.all([
          window.electron.files.getAll(PAGE_SIZE, 0),
          window.electron.tags.getAll(),
          window.electron.collections.getAll(),
          window.electron.stats.get(),
        ])
        set({
          files: loadedFiles,
          tags: loadedTags,
          collections: loadedCollections,
          stats: loadedStats,
          hasMoreFiles: loadedFiles.length >= PAGE_SIZE,
        })
      } catch (error) {
        console.error('Error loading data:', error)
      }
    },

    loadMoreFiles: async () => {
      const { isLoadingMore, hasMoreFiles, files } = get()
      if (isLoadingMore || !hasMoreFiles) return

      set({ isLoadingMore: true })
      try {
        const moreFiles = await window.electron.files.getAll(PAGE_SIZE, files.length)
        set({
          files: [...files, ...moreFiles],
          hasMoreFiles: moreFiles.length >= PAGE_SIZE,
          isLoadingMore: false,
        })
      } catch (error) {
        console.error('Error loading more files:', error)
        set({ isLoadingMore: false })
      }
    },

    searchFiles: async (query) => {
      if (!query.trim()) {
        const allFiles = await window.electron.files.getAll(PAGE_SIZE, 0)
        set({ files: allFiles, hasMoreFiles: allFiles.length >= PAGE_SIZE })
      } else {
        const results = await window.electron.files.search(query, {})
        set({ files: results.files, hasMoreFiles: false })
      }
    },

    toggleFavorite: async (fileId) => {
      const { files } = get()
      const file = files.find((f) => f.id === fileId)
      if (!file) return

      try {
        await window.electron.files.update(fileId, { is_favorite: !file.is_favorite })
        set({
          files: files.map((f) => (f.id === fileId ? { ...f, is_favorite: !f.is_favorite } : f)),
        })
        const loadedStats = await window.electron.stats.get()
        set({ stats: loadedStats })
      } catch (error) {
        console.error('Error toggling favorite:', error)
      }
    },

    deleteFiles: async (fileIds) => {
      try {
        for (const fileId of fileIds) {
          await window.electron.files.delete(fileId)
        }
        await get().loadData()
        set({ selectedFiles: [] })
      } catch (error) {
        console.error('Error deleting files:', error)
      }
    },

    // ==================== Tags ====================
    tags: [],
    setTags: (tags) => set({ tags }),

    createTag: async (name, category, color) => {
      try {
        await window.electron.tags.create({ name, category, color })
        const loadedTags = await window.electron.tags.getAll()
        set({ tags: loadedTags })
      } catch (error) {
        console.error('Error creating tag:', error)
      }
    },

    deleteTag: async (id) => {
      try {
        await window.electron.tags.delete(id)
        const loadedTags = await window.electron.tags.getAll()
        set({ tags: loadedTags })
      } catch (error) {
        console.error('Error deleting tag:', error)
      }
    },

    addTagsToFiles: async (fileIds, tagIds) => {
      try {
        await window.electron.files.bulkTag(fileIds, tagIds)
        await get().loadData()
        set({ selectedFiles: [] })
      } catch (error) {
        console.error('Error adding tags:', error)
      }
    },

    // ==================== Collections ====================
    collections: [],
    setCollections: (collections) => set({ collections }),

    createCollection: async (name, color, description) => {
      try {
        await window.electron.collections.create({ name, color, description })
        const loadedCollections = await window.electron.collections.getAll()
        set({ collections: loadedCollections })
      } catch (error) {
        console.error('Error creating collection:', error)
      }
    },

    addFilesToCollection: async (collectionId, fileIds) => {
      try {
        await window.electron.collections.addFiles(collectionId, fileIds)
        const loadedCollections = await window.electron.collections.getAll()
        set({ collections: loadedCollections, selectedFiles: [] })
      } catch (error) {
        console.error('Error adding to collection:', error)
      }
    },

    // ==================== Stats ====================
    stats: { totalFiles: 0, totalTags: 0, totalCollections: 0, totalFavorites: 0 },
    setStats: (stats) => set({ stats }),

    // ==================== Search & Filters ====================
    searchQuery: '',
    setSearchQuery: (searchQuery) => set({ searchQuery }),

    filters: defaultFilters,
    setFilters: (filters) => set({ filters }),

    applyFilters: async (newFilters) => {
      set({ filters: newFilters })
      try {
        const filterParams: Record<string, unknown> = {}
        if (newFilters.bpmMin) filterParams.bpmMin = newFilters.bpmMin
        if (newFilters.bpmMax) filterParams.bpmMax = newFilters.bpmMax
        if (newFilters.keys.length) filterParams.keys = newFilters.keys
        if (newFilters.fileTypes.length) filterParams.fileTypes = newFilters.fileTypes
        if (newFilters.tagIds.length) filterParams.tagIds = newFilters.tagIds
        if (newFilters.isFavorite) filterParams.isFavorite = true
        if (newFilters.minRating) filterParams.minRating = newFilters.minRating

        const results = await window.electron.files.search(get().searchQuery, filterParams)
        set({ files: results.files })
      } catch (error) {
        console.error('Error applying filters:', error)
      }
    },

    resetFilters: () => {
      set({ filters: defaultFilters })
      get().loadData()
    },

    // ==================== View State ====================
    currentView: 'all',
    setCurrentView: (currentView) => set({ currentView }),

    selectedCollectionId: null,
    setSelectedCollectionId: (selectedCollectionId) => set({ selectedCollectionId }),

    selectedTagId: null,
    setSelectedTagId: (selectedTagId) => set({ selectedTagId }),

    // ==================== Selection ====================
    selectedFiles: [],
    setSelectedFiles: (selectedFiles) => set({ selectedFiles }),

    toggleFileSelection: (fileId) => {
      const { selectedFiles } = get()
      if (selectedFiles.includes(fileId)) {
        set({ selectedFiles: selectedFiles.filter((id) => id !== fileId) })
      } else {
        set({ selectedFiles: [...selectedFiles, fileId] })
      }
    },

    clearSelection: () => set({ selectedFiles: [] }),

    // ==================== Audio Playback ====================
    currentlyPlaying: null,
    audioElement: null,

    playFile: (file) => {
      const { audioElement, currentlyPlaying } = get()

      if (audioElement) {
        audioElement.pause()
        audioElement.src = ''
      }

      if (currentlyPlaying === file.id) {
        set({ currentlyPlaying: null, audioElement: null })
        return
      }

      const filePath = file.file_path.replace(/\\/g, '/')
      const fileUrl = filePath.startsWith('/') ? `file://${filePath}` : `file:///${filePath}`
      const audio = new Audio(fileUrl)

      audio.addEventListener('ended', () => {
        set({ currentlyPlaying: null, audioElement: null })
      })
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e)
        set({ currentlyPlaying: null, audioElement: null })
      })

      audio.play().catch((err) => {
        console.error('Failed to play audio:', err)
      })

      set({ audioElement: audio, currentlyPlaying: file.id })
    },

    stopPlayback: () => {
      const { audioElement } = get()
      if (audioElement) {
        audioElement.pause()
        audioElement.src = ''
      }
      set({ currentlyPlaying: null, audioElement: null })
    },

    // ==================== Modal States ====================
    modals: {
      import: false,
      tagManagement: false,
      createCollection: false,
      addTags: false,
      addToCollection: false,
      filterPanel: false,
      confirmDelete: false,
    },

    openModal: (modal) =>
      set((state) => ({ modals: { ...state.modals, [modal]: true } })),

    closeModal: (modal) =>
      set((state) => ({ modals: { ...state.modals, [modal]: false } })),

    // ==================== Details Panel ====================
    detailsPanelFile: null,
    setDetailsPanelFile: (detailsPanelFile) => set({ detailsPanelFile }),

    updateFileRating: async (rating) => {
      const { detailsPanelFile, files } = get()
      if (!detailsPanelFile) return

      try {
        await window.electron.files.update(detailsPanelFile.id, { rating })
        set({
          files: files.map((f) => (f.id === detailsPanelFile.id ? { ...f, rating } : f)),
          detailsPanelFile: { ...detailsPanelFile, rating },
        })
      } catch (error) {
        console.error('Error updating rating:', error)
      }
    },

    // ==================== Context Menu ====================
    contextMenu: { isOpen: false, x: 0, y: 0, fileId: null },

    openContextMenu: (x, y, fileId) =>
      set({ contextMenu: { isOpen: true, x, y, fileId } }),

    closeContextMenu: () =>
      set({ contextMenu: { isOpen: false, x: 0, y: 0, fileId: null } }),

    // ==================== Collection/Tag Click ====================
    handleCollectionClick: async (collectionId) => {
      const { selectedCollectionId } = get()

      if (selectedCollectionId === collectionId) {
        set({ selectedCollectionId: null })
        const loadedFiles = await window.electron.files.getAll(PAGE_SIZE, 0)
        set({ files: loadedFiles, hasMoreFiles: loadedFiles.length >= PAGE_SIZE })
      } else {
        set({ selectedCollectionId: collectionId, selectedTagId: null, currentView: 'all' })
        try {
          const collection = await window.electron.collections.getById(collectionId)
          if (collection?.files) {
            set({ files: collection.files, hasMoreFiles: false })
          }
        } catch (error) {
          console.error('Error loading collection files:', error)
        }
      }
    },

    handleTagClick: async (tagId) => {
      const { selectedTagId } = get()

      if (selectedTagId === tagId) {
        set({ selectedTagId: null })
        const loadedFiles = await window.electron.files.getAll(PAGE_SIZE, 0)
        set({ files: loadedFiles, hasMoreFiles: loadedFiles.length >= PAGE_SIZE })
      } else {
        set({ selectedTagId: tagId, selectedCollectionId: null, currentView: 'all' })
        try {
          const results = await window.electron.files.search('', { tagIds: [tagId] })
          set({ files: results.files, hasMoreFiles: false })
        } catch (error) {
          console.error('Error filtering by tag:', error)
        }
      }
    },

    // ==================== Import ====================
    importFolder: async () => {
      try {
        const folderPath = await window.electron.folders.selectFolder()
        if (!folderPath) return

        await window.electron.folders.scan(folderPath, {
          recursive: true,
          autoTag: true,
        })

        await get().loadData()
      } catch (error) {
        console.error('Import error:', error)
        throw error
      }
    },

    // ==================== Purchases / Downloads ====================
    purchases: [],
    activeDownloads: {},

    loadPurchases: async () => {
      try {
        const result = await window.electron.purchases.getAll()
        set({ purchases: result })
      } catch (error) {
        console.error('Error loading purchases:', error)
      }
    },

    downloadAndInstall: async (fileId, url, filename, category, productName) => {
      set((state) => ({
        activeDownloads: {
          ...state.activeDownloads,
          [fileId]: { percent: 0, status: 'downloading' },
        },
      }))

      const unsubscribe = await window.electron.purchases.onProgress((progress) => {
        if (progress.file_id === fileId) {
          set((state) => ({
            activeDownloads: {
              ...state.activeDownloads,
              [fileId]: {
                percent: progress.percent,
                status: progress.status,
                installPath: progress.install_path,
              },
            },
          }))
        }
      })

      try {
        await window.electron.purchases.downloadAndInstall(fileId, url, filename, category, productName)
      } catch (error) {
        set((state) => ({
          activeDownloads: {
            ...state.activeDownloads,
            [fileId]: { percent: 0, status: 'error', error: String(error) },
          },
        }))
      } finally {
        unsubscribe()
      }
    },

    openInstallFolder: async (category) => {
      try {
        await window.electron.purchases.openInstallFolder(category)
      } catch (error) {
        console.error('Error opening install folder:', error)
      }
    },
  }))
)

// ==================== Selectors ====================

export const useAuth = () => useAppStore((state) => state.auth)
export const useFiles = () => useAppStore((state) => state.files)
export const useTags = () => useAppStore((state) => state.tags)
export const useCollections = () => useAppStore((state) => state.collections)
export const useStats = () => useAppStore((state) => state.stats)
export const useCurrentTool = () => useAppStore((state) => state.currentTool)
export const useModals = () => useAppStore((state) => state.modals)

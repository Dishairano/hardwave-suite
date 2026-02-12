// TypeScript type definitions for window.electron (Tauri compatibility layer)
// These match the API exposed by src/lib/tauri.ts

import type { File, Tag, Collection } from './index'

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

interface ScanProgress {
  total: number
  indexed: number
  current_file?: string
  status: 'scanning' | 'analyzing' | 'complete' | 'error'
}

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

interface FileUpdate {
  notes?: string
  rating?: number
  color_code?: string
  is_favorite?: boolean
  bpm?: number
  detected_key?: string
}

declare global {
  interface Window {
    electron: {
      getVersion: () => Promise<string>
      getPlatform: () => Promise<string>
      ping: () => Promise<string>
      auth: {
        login: (email: string, password: string) => Promise<{
          success: boolean
          error?: string
          data?: {
            user: { email: string; displayName: string | null; isAdmin: boolean }
            subscription?: { status: string }
          }
        }>
        logout: () => Promise<{ success: boolean }>
        verify: () => Promise<{
          valid: boolean
          hasSubscription: boolean
          data?: { user: { email: string; displayName: string | null } }
        }>
        getUser: () => Promise<{ user: unknown; subscription: { status: string } } | null>
        hasSubscription: () => Promise<boolean>
        openSubscribe: () => Promise<void>
      }
      updates: {
        check: () => Promise<void>
        checkManual: () => Promise<void>
        download: () => Promise<void>
        install: () => Promise<void>
        onChecking: (callback: () => void) => () => void
        onAvailable: (callback: (info: UpdateInfo) => void) => () => void
        onNotAvailable: (callback: () => void) => () => void
        onProgress: (callback: (progress: UpdateProgress) => void) => () => void
        onDownloaded: (callback: (info: UpdateInfo) => void) => () => void
        onError: (callback: (error: { message: string }) => void) => () => void
      }
      files: {
        getAll: (limit?: number, offset?: number) => Promise<File[]>
        search: (query: string, filters: Record<string, unknown>) => Promise<{ files: File[] }>
        getById: (id: number) => Promise<File | null>
        update: (id: number, data: Partial<FileUpdate>) => Promise<void>
        delete: (id: number) => Promise<void>
        bulkTag: (fileIds: number[], tagIds: number[]) => Promise<void>
        sync: (files: unknown[]) => Promise<{ results: unknown[] }>
      }
      tags: {
        getAll: () => Promise<Tag[]>
        create: (data: { name: string; category: string; color: string }) => Promise<Tag>
        update: (id: number, data: unknown) => Promise<void>
        delete: (id: number) => Promise<void>
      }
      collections: {
        getAll: () => Promise<Collection[]>
        getById: (collectionId: number) => Promise<{ files?: File[] }>
        create: (data: { name: string; color: string; description: string }) => Promise<Collection>
        update: (id: number, data: unknown) => Promise<void>
        delete: (id: number) => Promise<void>
        addFiles: (collectionId: number, fileIds: number[]) => Promise<void>
        removeFiles: (collectionId: number, fileIds: number[]) => Promise<void>
      }
      stats: {
        get: () => Promise<{
          totalFiles: number
          totalTags: number
          totalCollections: number
          totalFavorites: number
        }>
      }
      folders: {
        selectFolder: () => Promise<string | null>
        scan: (folderPath: string, options?: unknown) => Promise<{
          indexed: number
          duplicates: number
          errors: number
        }>
        scanMultiple: (folderPaths: string[], options?: unknown) => Promise<unknown[]>
        onScanProgress: (callback: (progress: ScanProgress) => void) => () => void
      }
      audio: {
        analyze: (fileId: number, filePath: string) => Promise<boolean>
        batchAnalyze: (files: Array<{ id: number; file_path: string }>) => Promise<{ success: number; failed: number }>
        onProgress: (callback: (progress: unknown) => void) => () => void
      }
      fl: {
        dragFile: (fileId: number) => Promise<unknown>
      }
      cloud: {
        selectFilesForUpload: () => Promise<string[] | null>
        uploadFiles: (filePaths: string[]) => Promise<{
          current: number
          total: number
          currentFile: unknown
          completed: unknown[]
          failed: { filename: string; error: string }[]
        }>
        uploadFile: (filePath: string) => Promise<{ success: boolean; file?: unknown; error?: string }>
        getFiles: (page?: number, limit?: number) => Promise<{ files: unknown[]; pagination: unknown }>
        getFile: (id: number) => Promise<unknown>
        deleteFile: (id: number) => Promise<{ success: boolean }>
        downloadFile: (id: number, originalFilename: string) => Promise<{
          success: boolean
          canceled?: boolean
          error?: string
        }>
        shareFile: (id: number) => Promise<ShareResult>
        revokeShare: (id: number) => Promise<{ success: boolean }>
        getSharedWithMe: () => Promise<unknown[]>
        getStorage: () => Promise<StorageInfo>
        copyShareLink: (shareUrl: string) => Promise<{ success: boolean }>
        openShareLink: (shareUrl: string) => Promise<{ success: boolean }>
        onUploadProgress: (callback: (progress: UploadProgress) => void) => () => void
        onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
      }
    }
  }
}

export {}

// Core data types based on database schema

export interface File {
  id: number
  file_path: string
  filename: string
  file_type: 'sample' | 'one_shot' | 'loop' | 'project' | 'flp' | 'preset' | 'midi' | 'kickchain'
  file_extension: string
  file_size: number
  created_at: number
  modified_at: number
  last_accessed?: number
  hash?: string
  indexed_at: number

  // Audio metadata
  duration?: number
  sample_rate?: number
  bit_depth?: number
  channels?: number

  // Musical metadata
  bpm?: number
  detected_key?: string
  detected_scale?: string
  energy_level?: number

  // Custom fields
  notes?: string
  rating: number
  color_code?: string
  is_favorite: boolean
  use_count: number

  // Relations
  tags?: Tag[]
  collections?: Collection[]
}

export interface Tag {
  id: number
  name: string
  category?: 'genre' | 'instrument' | 'energy' | 'custom'
  color?: string
  created_at: number
}

export interface Collection {
  id: number
  name: string
  description?: string
  color?: string
  icon?: string
  created_at: number
  updated_at: number
  is_smart: boolean
  smart_query?: string
  file_count?: number
}

export interface WatchedFolder {
  id: number
  folder_path: string
  is_active: boolean
  auto_tag_pattern?: string
  added_at: number
  last_scanned?: number
  file_count?: number
}

export interface SearchQuery {
  text?: string
  filters: {
    bpmRange?: [number, number]
    keys?: string[]
    tags?: number[]
    fileTypes?: string[]
    dateRange?: [Date, Date]
    minRating?: number
    minEnergy?: number
    maxEnergy?: number
    isFavorite?: boolean
    collections?: number[]
  }
  sort?: {
    field: 'name' | 'bpm' | 'modified_at' | 'use_count' | 'rating'
    direction: 'asc' | 'desc'
  }
  limit?: number
  offset?: number
}

export interface SearchResults {
  files: File[]
  total: number
  query: SearchQuery
}

export interface ScanProgress {
  total: number
  indexed: number
  current_file?: string
  bpm_detected: number
  duplicates_found: number
  auto_tagged: number
  status: 'scanning' | 'analyzing' | 'complete' | 'error'
}

// Cloud file types
export interface CloudFile {
  id: number
  user_id: number
  filename: string
  original_filename: string
  file_type: 'wav' | 'mp3' | 'flac' | 'ogg' | 'aiff'
  file_size_bytes: number
  mime_type: string
  duration_seconds?: number
  bpm?: number
  detected_key?: string
  is_public: boolean
  share_token?: string
  download_count: number
  uploaded_at: string
}

export interface StorageUsage {
  used_bytes: number
  used_formatted: string
  file_count: number
  quota_bytes: number
  quota_formatted: string
  quota_unlimited: boolean
  usage_percent: number
}

// User types
export interface User {
  id: number;
  email: string;
  password_hash?: string;
  oauth_provider: 'local' | 'google' | 'discord';
  oauth_id?: string;
  display_name?: string;
  avatar_url?: string;
  email_verified: boolean;
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Admin {
  id: number;
  user_id: number;
  role: 'admin' | 'super_admin';
  permissions?: any;
  granted_by?: number;
  created_at: Date;
  updated_at: Date;
}

// File types
export interface UserFile {
  id: number;
  user_id: number;
  file_path: string;
  filename: string;
  file_type: string;
  file_size_bytes?: number;
  duration_seconds?: number;
  sample_rate?: number;
  bit_depth?: number;
  bpm?: number;
  detected_key?: string;
  tags?: any;
  custom_metadata?: any;
  notes?: string;
  category?: string;
  collection_id?: number;
  favorite: boolean;
  last_synced_at?: Date;
  sync_hash?: string;
  created_at: Date;
  updated_at: Date;
}

// Collection types
export interface Collection {
  id: number;
  user_id: number;
  collection_name: string;
  description?: string;
  color?: string;
  file_count: number;
  is_favorite: boolean;
  created_at: Date;
  updated_at: Date;
}

// Tag types
export interface Tag {
  id: number;
  user_id: number;
  tag_name: string;
  category?: string;
  color?: string;
  description?: string;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

// Stats types
export interface UserStats {
  totalFiles: number;
  totalTags: number;
  collections: number;
  storageUsed: number;
  storageTotal: number;
}

export interface AdminStats {
  totalUsers: number;
  totalFiles: number;
  totalTags: number;
  activeUsers: number;
  newUsersToday: number;
  filesUploadedToday: number;
  usersChange: number;
  filesChange: number;
  tagsChange: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  display_name?: string;
}

export interface JWTPayload {
  userId: number;
  email: string;
  isAdmin: boolean;
}

/**
 * Sync utility for PWA offline support
 * Handles syncing local data with the backend API
 */

import {
  AudioFile,
  Collection,
  LibraryMetadata,
  PendingSyncItem,
  saveFiles,
  saveCollections,
  saveLibraryMetadata,
  getPendingSyncItems,
  removePendingSyncItem,
  addPendingSync,
  getLibraryMetadata,
} from './storage';

const API_BASE = '/api/library';
const MAX_RETRIES = 3;

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  pendingChanges: number;
  error: string | null;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// Global sync state
let syncStatus: SyncStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  lastSync: null,
  pendingChanges: 0,
  error: null,
};

const syncListeners: Set<(status: SyncStatus) => void> = new Set();

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(
  callback: (status: SyncStatus) => void
): () => void {
  syncListeners.add(callback);
  callback(syncStatus);
  return () => syncListeners.delete(callback);
}

/**
 * Update sync status and notify listeners
 */
function updateSyncStatus(updates: Partial<SyncStatus>): void {
  syncStatus = { ...syncStatus, ...updates };
  syncListeners.forEach((callback) => callback(syncStatus));
}

/**
 * Initialize sync listeners
 */
export function initSync(): void {
  if (typeof window === 'undefined') return;

  // Listen for online/offline events
  window.addEventListener('online', () => {
    updateSyncStatus({ isOnline: true, error: null });
    // Auto-sync when coming back online
    syncPendingChanges();
  });

  window.addEventListener('offline', () => {
    updateSyncStatus({ isOnline: false });
  });

  // Listen for service worker messages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_FAVORITES') {
        syncPendingChanges();
      }
      if (event.data.type === 'SYNC_METADATA') {
        syncPendingChanges();
      }
    });
  }

  // Check pending changes count
  updatePendingCount();
}

/**
 * Update pending changes count
 */
async function updatePendingCount(): Promise<void> {
  try {
    const items = await getPendingSyncItems();
    updateSyncStatus({ pendingChanges: items.length });
  } catch {
    // Ignore errors
  }
}

/**
 * Fetch library data from API and store locally
 */
export async function fetchAndStoreLibrary(
  token: string
): Promise<{ files: number; collections: number }> {
  updateSyncStatus({ isSyncing: true, error: null });

  try {
    // Fetch files
    const filesResponse = await fetch(`${API_BASE}/files`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!filesResponse.ok) {
      throw new Error('Failed to fetch files');
    }

    const filesData = await filesResponse.json();
    const files: AudioFile[] = filesData.files || [];
    await saveFiles(files);

    // Fetch collections
    const collectionsResponse = await fetch(`${API_BASE}/collections`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!collectionsResponse.ok) {
      throw new Error('Failed to fetch collections');
    }

    const collectionsData = await collectionsResponse.json();
    const collections: Collection[] = collectionsData.collections || [];
    await saveCollections(collections);

    // Update metadata
    const metadata: LibraryMetadata = {
      lastSync: Date.now(),
      totalFiles: files.length,
      totalFavorites: files.filter((f) => f.isFavorite).length,
      totalCollections: collections.length,
      version: '1.0.0',
    };
    await saveLibraryMetadata(metadata);

    updateSyncStatus({
      isSyncing: false,
      lastSync: new Date(),
      error: null,
    });

    return {
      files: files.length,
      collections: collections.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    updateSyncStatus({
      isSyncing: false,
      error: message,
    });
    throw error;
  }
}

/**
 * Sync pending changes to the backend
 */
export async function syncPendingChanges(token?: string): Promise<SyncResult> {
  if (!syncStatus.isOnline) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: ['Device is offline'],
    };
  }

  if (syncStatus.isSyncing) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: ['Sync already in progress'],
    };
  }

  updateSyncStatus({ isSyncing: true, error: null });

  const pendingItems = await getPendingSyncItems();
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  // Get auth token if not provided
  const authToken = token || getStoredToken();
  if (!authToken && pendingItems.length > 0) {
    updateSyncStatus({ isSyncing: false, error: 'Not authenticated' });
    return {
      success: false,
      synced: 0,
      failed: pendingItems.length,
      errors: ['Authentication required'],
    };
  }

  // Process each pending item
  for (const item of pendingItems) {
    try {
      await processSyncItem(item, authToken!);
      await removePendingSyncItem(item.id);
      result.synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`${item.type}: ${message}`);
      result.failed++;

      // Retry logic
      if (item.retries < MAX_RETRIES) {
        await addPendingSync({
          ...item,
          retries: item.retries + 1,
          timestamp: Date.now(),
        });
        await removePendingSyncItem(item.id);
      }
    }
  }

  result.success = result.failed === 0;

  updateSyncStatus({
    isSyncing: false,
    lastSync: result.success ? new Date() : syncStatus.lastSync,
    error: result.errors.length > 0 ? result.errors[0] : null,
  });

  await updatePendingCount();

  return result;
}

/**
 * Process a single sync item
 */
async function processSyncItem(
  item: PendingSyncItem,
  token: string
): Promise<void> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  switch (item.type) {
    case 'favorite': {
      const { fileId, isFavorite } = item.data as {
        fileId: string;
        isFavorite: boolean;
      };
      // Use PATCH endpoint with is_favorite field
      const response = await fetch(`${API_BASE}/files/${fileId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_favorite: isFavorite ? 1 : 0 }),
      });
      if (!response.ok) throw new Error('Failed to sync favorite');
      break;
    }

    case 'metadata': {
      const { fileId, ...metadata } = item.data as {
        fileId: string;
        [key: string]: unknown;
      };
      const response = await fetch(`${API_BASE}/files/${fileId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(metadata),
      });
      if (!response.ok) throw new Error('Failed to sync metadata');
      break;
    }

    case 'collection': {
      const { action, fileId, collectionId, collection } = item.data as {
        action: string;
        fileId?: string;
        collectionId?: string;
        collection?: { name: string; description?: string; color?: string };
      };

      if (action === 'add' && collection) {
        // Create new collection
        const response = await fetch(`${API_BASE}/collections`, {
          method: 'POST',
          headers,
          body: JSON.stringify(collection),
        });
        if (!response.ok) throw new Error('Failed to create collection');
      } else if (action === 'add' && fileId && collectionId) {
        // Add file to collection
        const response = await fetch(`${API_BASE}/collections/${collectionId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ addFileIds: [fileId] }),
        });
        if (!response.ok) throw new Error('Failed to add file to collection');
      } else if (action === 'delete' && fileId && collectionId) {
        // Remove file from collection
        const response = await fetch(`${API_BASE}/collections/${collectionId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ removeFileIds: [fileId] }),
        });
        if (!response.ok) throw new Error('Failed to remove file from collection');
      }
      break;
    }

    default:
      throw new Error(`Unknown sync type: ${item.type}`);
  }
}

/**
 * Get stored auth token (from localStorage or cookie)
 */
function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;

  // Try localStorage first
  const token = localStorage.getItem('hardwave_token');
  if (token) return token;

  // Try to get from cookie (session token)
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'next-auth.session-token' || name === 'authjs.session-token') {
      return value;
    }
  }

  return null;
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

/**
 * Force a full sync with the backend
 */
export async function forceFullSync(token: string): Promise<void> {
  // First sync pending changes
  await syncPendingChanges(token);

  // Then fetch fresh data
  await fetchAndStoreLibrary(token);
}

/**
 * Check if data needs to be synced (stale data)
 */
export async function needsSync(staleThreshold = 3600000): Promise<boolean> {
  const metadata = await getLibraryMetadata();
  if (!metadata) return true;

  const now = Date.now();
  return now - metadata.lastSync > staleThreshold;
}

/**
 * Register for background sync (if supported)
 */
export async function registerBackgroundSync(tag: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register(tag);
      return true;
    }
  } catch {
    // Background sync not supported or failed
  }

  return false;
}

/**
 * Inline sync favorite - immediately syncs to server, falls back to queue if offline
 */
export async function syncFavoriteInline(
  fileId: string,
  isFavorite: boolean
): Promise<{ success: boolean; error?: string }> {
  const token = getStoredToken();

  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!syncStatus.isOnline) {
    // Queue for later sync
    await queueFavoriteSync(fileId, isFavorite);
    return { success: true }; // Optimistically return success
  }

  try {
    const response = await fetch(`${API_BASE}/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ is_favorite: isFavorite ? 1 : 0 }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to sync favorite');
    }

    return { success: true };
  } catch (error) {
    console.error('Inline favorite sync failed:', error);
    // Queue for retry
    await queueFavoriteSync(fileId, isFavorite);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Queue a favorite change for syncing (fallback)
 */
export async function queueFavoriteSync(
  fileId: string,
  isFavorite: boolean
): Promise<void> {
  await addPendingSync({
    id: `fav-${fileId}-${Date.now()}`,
    type: 'favorite',
    action: 'update',
    data: { fileId, isFavorite },
    timestamp: Date.now(),
    retries: 0,
  });

  await updatePendingCount();

  // Try to sync immediately if online
  if (syncStatus.isOnline) {
    syncPendingChanges();
  } else {
    // Register for background sync
    registerBackgroundSync('sync-favorites');
  }
}

/**
 * Queue a metadata change for syncing
 */
export async function queueMetadataSync(
  fileId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await addPendingSync({
    id: `meta-${fileId}-${Date.now()}`,
    type: 'metadata',
    action: 'update',
    data: { fileId, ...metadata },
    timestamp: Date.now(),
    retries: 0,
  });

  await updatePendingCount();

  if (syncStatus.isOnline) {
    syncPendingChanges();
  } else {
    registerBackgroundSync('sync-metadata');
  }
}

/**
 * Sync library - convenience function that syncs pending changes
 * and optionally fetches fresh data from the server
 */
export async function syncLibrary(token?: string): Promise<SyncResult> {
  const authToken = token || getStoredToken();

  // First sync any pending local changes
  const syncResult = await syncPendingChanges(authToken || undefined);

  // If we have a token, also fetch fresh data from server
  if (authToken && syncStatus.isOnline) {
    try {
      await fetchAndStoreLibrary(authToken);
    } catch (error) {
      console.error('Failed to fetch fresh library data:', error);
    }
  }

  return syncResult;
}

/**
 * Inline sync add file to collection - immediately syncs to server
 */
export async function syncAddToCollectionInline(
  fileId: string,
  collectionId: string
): Promise<{ success: boolean; error?: string }> {
  const token = getStoredToken();

  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!syncStatus.isOnline) {
    // Queue for later sync
    await addPendingSync({
      id: `col-${fileId}-${collectionId}-${Date.now()}`,
      type: 'collection',
      action: 'add',
      data: { fileId, collectionId },
      timestamp: Date.now(),
      retries: 0,
    });
    await updatePendingCount();
    return { success: true };
  }

  try {
    const response = await fetch(`${API_BASE}/collections/${collectionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ addFileIds: [fileId] }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to add to collection');
    }

    return { success: true };
  } catch (error) {
    console.error('Inline collection sync failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Inline sync create collection - immediately syncs to server
 */
export async function syncCreateCollectionInline(
  name: string,
  description?: string,
  color?: string
): Promise<{ success: boolean; collection?: { id: string }; error?: string }> {
  const token = getStoredToken();

  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!syncStatus.isOnline) {
    // Queue for later sync
    await addPendingSync({
      id: `col-create-${Date.now()}`,
      type: 'collection',
      action: 'add',
      data: { collection: { name, description, color } },
      timestamp: Date.now(),
      retries: 0,
    });
    await updatePendingCount();
    // Return a temporary ID
    return {
      success: true,
      collection: { id: `temp-${Date.now()}` },
    };
  }

  try {
    const response = await fetch(`${API_BASE}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, description, color }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create collection');
    }

    const data = await response.json();
    return { success: true, collection: { id: data.id } };
  } catch (error) {
    console.error('Inline create collection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create collection',
    };
  }
}

/**
 * Fetch collections from server
 */
export async function fetchCollections(): Promise<{
  success: boolean;
  collections?: Array<{
    id: string;
    name: string;
    description?: string;
    color?: string;
    file_count: number;
  }>;
  error?: string;
}> {
  const token = getStoredToken();

  if (!token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_BASE}/collections`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch collections');
    }

    const data = await response.json();
    return { success: true, collections: data.collections || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch',
    };
  }
}

/**
 * IndexedDB storage utility for PWA offline support
 * Handles caching of library data for offline browsing
 */

const DB_NAME = 'hardwave-suite';
const DB_VERSION = 1;

// Store names
const STORES = {
  FILES: 'files',
  COLLECTIONS: 'collections',
  FAVORITES: 'favorites',
  PENDING_SYNC: 'pendingSync',
  METADATA: 'metadata',
} as const;

export interface AudioFile {
  id: string;
  filename: string;
  path: string;
  bpm?: number;
  key?: string;
  notes?: string;
  rating?: number;
  tags?: string[];
  duration?: number;
  fileSize?: number;
  dateAdded: string;
  dateModified: string;
  isFavorite: boolean;
  collectionIds?: string[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PendingSyncItem {
  id: string;
  type: 'favorite' | 'metadata' | 'collection';
  action: 'add' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

export interface LibraryMetadata {
  lastSync: number;
  totalFiles: number;
  totalFavorites: number;
  totalCollections: number;
  version: string;
}

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Files store with indexes
      if (!database.objectStoreNames.contains(STORES.FILES)) {
        const filesStore = database.createObjectStore(STORES.FILES, {
          keyPath: 'id',
        });
        filesStore.createIndex('filename', 'filename', { unique: false });
        filesStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        filesStore.createIndex('bpm', 'bpm', { unique: false });
        filesStore.createIndex('key', 'key', { unique: false });
        filesStore.createIndex('dateAdded', 'dateAdded', { unique: false });
      }

      // Collections store
      if (!database.objectStoreNames.contains(STORES.COLLECTIONS)) {
        const collectionsStore = database.createObjectStore(STORES.COLLECTIONS, {
          keyPath: 'id',
        });
        collectionsStore.createIndex('name', 'name', { unique: false });
      }

      // Favorites store (for quick access)
      if (!database.objectStoreNames.contains(STORES.FAVORITES)) {
        database.createObjectStore(STORES.FAVORITES, { keyPath: 'id' });
      }

      // Pending sync store
      if (!database.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const syncStore = database.createObjectStore(STORES.PENDING_SYNC, {
          keyPath: 'id',
        });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Metadata store
      if (!database.objectStoreNames.contains(STORES.METADATA)) {
        database.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Get a transaction for the specified stores
 */
async function getTransaction(
  storeNames: string | string[],
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBTransaction> {
  const database = await initDB();
  return database.transaction(storeNames, mode);
}

/**
 * Generic store operations
 */
async function getStore(
  storeName: string,
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBObjectStore> {
  const transaction = await getTransaction(storeName, mode);
  return transaction.objectStore(storeName);
}

// ============================================
// Files operations
// ============================================

export async function getAllFiles(): Promise<AudioFile[]> {
  const store = await getStore(STORES.FILES);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getFileById(id: string): Promise<AudioFile | undefined> {
  const store = await getStore(STORES.FILES);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFiles(files: AudioFile[]): Promise<void> {
  const store = await getStore(STORES.FILES, 'readwrite');
  const transaction = store.transaction;

  return new Promise((resolve, reject) => {
    files.forEach((file) => {
      store.put(file);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function searchFiles(query: string): Promise<AudioFile[]> {
  const files = await getAllFiles();
  const lowerQuery = query.toLowerCase();

  return files.filter(
    (file) =>
      file.filename.toLowerCase().includes(lowerQuery) ||
      file.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
      file.notes?.toLowerCase().includes(lowerQuery)
  );
}

export async function getFilesByBpmRange(
  minBpm: number,
  maxBpm: number
): Promise<AudioFile[]> {
  const files = await getAllFiles();
  return files.filter(
    (file) => file.bpm && file.bpm >= minBpm && file.bpm <= maxBpm
  );
}

export async function getFilesByKey(key: string): Promise<AudioFile[]> {
  const files = await getAllFiles();
  return files.filter((file) => file.key === key);
}

// ============================================
// Favorites operations
// ============================================

export async function getFavorites(): Promise<AudioFile[]> {
  const files = await getAllFiles();
  return files.filter((file) => file.isFavorite);
}

export async function toggleFavorite(
  fileId: string,
  isFavorite: boolean
): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction(STORES.FILES, 'readwrite');
  const store = transaction.objectStore(STORES.FILES);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(fileId);

    getRequest.onsuccess = () => {
      const file = getRequest.result;
      if (file) {
        file.isFavorite = isFavorite;
        file.dateModified = new Date().toISOString();

        const putRequest = store.put(file);
        putRequest.onsuccess = () => {
          // Add to pending sync (fire and forget)
          addPendingSync({
            id: `fav-${fileId}-${Date.now()}`,
            type: 'favorite',
            action: 'update',
            data: { fileId, isFavorite },
            timestamp: Date.now(),
            retries: 0,
          }).catch(console.error);
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve(); // File not found, just resolve
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// ============================================
// Collections operations
// ============================================

export async function getAllCollections(): Promise<Collection[]> {
  const store = await getStore(STORES.COLLECTIONS);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCollectionById(
  id: string
): Promise<Collection | undefined> {
  const store = await getStore(STORES.COLLECTIONS);
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  const store = await getStore(STORES.COLLECTIONS, 'readwrite');
  const transaction = store.transaction;

  return new Promise((resolve, reject) => {
    collections.forEach((collection) => {
      store.put(collection);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getFilesInCollection(
  collectionId: string
): Promise<AudioFile[]> {
  const files = await getAllFiles();
  return files.filter((file) => file.collectionIds?.includes(collectionId));
}

export async function addFileToCollection(
  fileId: string,
  collectionId: string
): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction(STORES.FILES, 'readwrite');
  const store = transaction.objectStore(STORES.FILES);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(fileId);

    getRequest.onsuccess = () => {
      const file = getRequest.result;
      if (file) {
        const collectionIds = file.collectionIds || [];
        if (!collectionIds.includes(collectionId)) {
          collectionIds.push(collectionId);
          file.collectionIds = collectionIds;
          file.dateModified = new Date().toISOString();

          const putRequest = store.put(file);
          putRequest.onsuccess = () => {
            // Add to pending sync
            addPendingSync({
              id: `col-${fileId}-${collectionId}-${Date.now()}`,
              type: 'collection',
              action: 'add',
              data: { fileId, collectionId },
              timestamp: Date.now(),
              retries: 0,
            }).catch(console.error);
            resolve();
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(); // Already in collection
        }
      } else {
        resolve(); // File not found
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function removeFileFromCollection(
  fileId: string,
  collectionId: string
): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction(STORES.FILES, 'readwrite');
  const store = transaction.objectStore(STORES.FILES);

  return new Promise((resolve, reject) => {
    const getRequest = store.get(fileId);

    getRequest.onsuccess = () => {
      const file = getRequest.result;
      if (file && file.collectionIds) {
        file.collectionIds = file.collectionIds.filter((id: string) => id !== collectionId);
        file.dateModified = new Date().toISOString();

        const putRequest = store.put(file);
        putRequest.onsuccess = () => {
          addPendingSync({
            id: `col-${fileId}-${collectionId}-${Date.now()}`,
            type: 'collection',
            action: 'delete',
            data: { fileId, collectionId },
            timestamp: Date.now(),
            retries: 0,
          }).catch(console.error);
          resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function createCollection(
  name: string,
  description?: string,
  color?: string
): Promise<Collection> {
  const database = await initDB();
  const transaction = database.transaction(STORES.COLLECTIONS, 'readwrite');
  const store = transaction.objectStore(STORES.COLLECTIONS);

  const collection: Collection = {
    id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    color: color || '#FFA500',
    fileCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const request = store.put(collection);
    request.onsuccess = () => {
      addPendingSync({
        id: `col-create-${collection.id}-${Date.now()}`,
        type: 'collection',
        action: 'add',
        data: { collection },
        timestamp: Date.now(),
        retries: 0,
      }).catch(console.error);
      resolve(collection);
    };
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Pending sync operations
// ============================================

export async function addPendingSync(item: PendingSyncItem): Promise<void> {
  const store = await getStore(STORES.PENDING_SYNC, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingSyncItems(): Promise<PendingSyncItem[]> {
  const store = await getStore(STORES.PENDING_SYNC);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingSyncItem(id: string): Promise<void> {
  const store = await getStore(STORES.PENDING_SYNC, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearPendingSync(): Promise<void> {
  const store = await getStore(STORES.PENDING_SYNC, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Metadata operations
// ============================================

export async function getLibraryMetadata(): Promise<LibraryMetadata | null> {
  const store = await getStore(STORES.METADATA);
  return new Promise((resolve, reject) => {
    const request = store.get('library');
    request.onsuccess = () =>
      resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLibraryMetadata(
  metadata: LibraryMetadata
): Promise<void> {
  const store = await getStore(STORES.METADATA, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put({ key: 'library', value: metadata });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// Utility functions
// ============================================

export async function clearAllData(): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction(
    Object.values(STORES),
    'readwrite'
  );

  return new Promise((resolve, reject) => {
    Object.values(STORES).forEach((storeName) => {
      transaction.objectStore(storeName).clear();
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getStorageStats(): Promise<{
  filesCount: number;
  collectionsCount: number;
  favoritesCount: number;
  pendingSyncCount: number;
}> {
  const [files, collections, favorites, pendingSync] = await Promise.all([
    getAllFiles(),
    getAllCollections(),
    getFavorites(),
    getPendingSyncItems(),
  ]);

  return {
    filesCount: files.length,
    collectionsCount: collections.length,
    favoritesCount: favorites.length,
    pendingSyncCount: pendingSync.length,
  };
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

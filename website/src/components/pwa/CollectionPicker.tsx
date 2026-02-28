'use client';

import { useState, useEffect } from 'react';
import { X, Plus, FolderPlus, Check, Loader2 } from 'lucide-react';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/pwa/haptics';
import {
  Collection,
  getAllCollections,
  addFileToCollection,
  createCollection,
  saveCollections,
} from '@/lib/pwa/storage';
import {
  fetchCollections,
  syncAddToCollectionInline,
  syncCreateCollectionInline,
} from '@/lib/pwa/sync';

interface CollectionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  filename: string;
  currentCollectionIds?: string[];
  onSuccess?: () => void;
}

export function CollectionPicker({
  isOpen,
  onClose,
  fileId,
  filename,
  currentCollectionIds = [],
  onSuccess,
}: CollectionPickerProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [addedTo, setAddedTo] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadCollections();
      setAddedTo([]);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      // Try to fetch from server first
      const serverResult = await fetchCollections();
      if (serverResult.success && serverResult.collections) {
        // Map server format to local format
        const cols: Collection[] = serverResult.collections.map((c) => ({
          id: String(c.id),
          name: c.name,
          description: c.description,
          color: c.color || '#FFA500',
          fileCount: c.file_count || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        setCollections(cols);
        // Also save to IndexedDB for offline access
        await saveCollections(cols);
      } else {
        // Fallback to local storage
        const cols = await getAllCollections();
        setCollections(cols);
      }
    } catch (err) {
      console.error('Failed to load collections:', err);
      // Fallback to local storage
      const cols = await getAllCollections();
      setCollections(cols);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    hapticTap();
    try {
      // Inline sync to server
      const result = await syncAddToCollectionInline(fileId, collectionId);
      if (result.success) {
        // Also update local IndexedDB
        await addFileToCollection(fileId, collectionId);
        setAddedTo((prev) => [...prev, collectionId]);
        hapticSuccess();
        onSuccess?.();
      } else {
        console.error('Failed to add to collection:', result.error);
        hapticError();
      }
    } catch (err) {
      console.error('Failed to add to collection:', err);
      hapticError();
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    hapticTap();
    try {
      // Create on server first
      const result = await syncCreateCollectionInline(
        newCollectionName.trim(),
        undefined,
        '#FFA500'
      );

      if (result.success && result.collection) {
        const serverId = String(result.collection.id);

        // Create locally with server ID
        const collection = await createCollection(newCollectionName.trim());
        // Update with server ID if available
        const finalCollection = {
          ...collection,
          id: serverId,
        };
        setCollections((prev) => [...prev, finalCollection]);

        // Add file to the new collection
        const addResult = await syncAddToCollectionInline(fileId, serverId);
        if (addResult.success) {
          await addFileToCollection(fileId, serverId);
          setAddedTo((prev) => [...prev, serverId]);
        }

        setNewCollectionName('');
        setIsCreating(false);
        hapticSuccess();
        onSuccess?.();
      } else {
        console.error('Failed to create collection:', result.error);
        hapticError();
      }
    } catch (err) {
      console.error('Failed to create collection:', err);
      hapticError();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      hapticTap();
      onClose();
    }
  };

  if (!isOpen) return null;

  const isInCollection = (collectionId: string) =>
    currentCollectionIds.includes(collectionId) || addedTo.includes(collectionId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-lg bg-[#12121a] rounded-t-2xl shadow-xl max-h-[70vh] flex flex-col"
        style={{
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-sm font-medium text-white">Add to Collection</h3>
            <p className="text-xs text-white/50 truncate max-w-[200px]">{filename}</p>
          </div>
          <button
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="p-1 rounded-full active:bg-white/10"
          >
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#FFA500] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : collections.length === 0 && !isCreating ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <FolderPlus className="w-12 h-12 text-white/20 mb-3" />
              <p className="text-sm text-white/60 text-center mb-4">
                No collections yet. Create your first one!
              </p>
              <button
                onClick={() => {
                  hapticTap();
                  setIsCreating(true);
                }}
                className="px-4 py-2 rounded-lg bg-[#FFA500] text-[#08080c] text-sm font-medium active:opacity-80"
              >
                Create Collection
              </button>
            </div>
          ) : (
            <>
              {/* Create new collection */}
              {isCreating ? (
                <div className="px-4 py-3 border-b border-white/10">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Collection name"
                    className="w-full px-3 py-2 rounded-lg bg-white/10 text-white text-sm placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#FFA500]/50"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateCollection();
                      } else if (e.key === 'Escape') {
                        setIsCreating(false);
                        setNewCollectionName('');
                      }
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        hapticTap();
                        setIsCreating(false);
                        setNewCollectionName('');
                      }}
                      className="flex-1 py-2 rounded-lg bg-white/10 text-white text-sm font-medium active:bg-white/20"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateCollection}
                      disabled={!newCollectionName.trim()}
                      className="flex-1 py-2 rounded-lg bg-[#FFA500] text-[#08080c] text-sm font-medium active:opacity-80 disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    hapticTap();
                    setIsCreating(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/10 transition-colors border-b border-white/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#FFA500]/20 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-[#FFA500]" />
                  </div>
                  <span className="text-sm font-medium text-[#FFA500]">
                    Create New Collection
                  </span>
                </button>
              )}

              {/* Collection list */}
              {collections.map((collection) => {
                const alreadyIn = isInCollection(collection.id);
                return (
                  <button
                    key={collection.id}
                    onClick={() => !alreadyIn && handleAddToCollection(collection.id)}
                    disabled={alreadyIn}
                    className={`w-full flex items-center gap-3 px-4 py-3 active:bg-white/10 transition-colors ${
                      alreadyIn ? 'opacity-60' : ''
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${collection.color}20` }}
                    >
                      <FolderPlus
                        className="w-5 h-5"
                        style={{ color: collection.color }}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white">{collection.name}</p>
                      <p className="text-xs text-white/50">
                        {collection.fileCount} {collection.fileCount === 1 ? 'file' : 'files'}
                      </p>
                    </div>
                    {alreadyIn && (
                      <Check className="w-5 h-5 text-[#00D4AA]" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Done button */}
        <div className="px-3 pb-3 pt-1 border-t border-white/10 flex-shrink-0">
          <button
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-white/10 text-white text-sm font-medium active:bg-white/20 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { FileList } from '@/components/pwa/FileList';
import { SyncStatus } from '@/components/pwa/SyncStatus';
import {
  AudioFile,
  getFavorites,
  toggleFavorite,
  initDB,
} from '@/lib/pwa/storage';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFavorites() {
      try {
        await initDB();
        const data = await getFavorites();
        setFavorites(data);
      } catch (err) {
        console.error('Failed to load favorites:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadFavorites();
  }, []);

  // Handle unfavorite
  const handleFavoriteToggle = useCallback(
    async (id: string, isFavorite: boolean) => {
      try {
        await toggleFavorite(id, isFavorite);
        if (!isFavorite) {
          // Remove from list immediately
          setFavorites((prev) => prev.filter((f) => f.id !== id));
        }
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    },
    []
  );

  // Handle file tap
  const handleFileTap = useCallback((id: string) => {
    console.log('File tapped:', id);
    // TODO: Show file details modal
  }, []);

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FFA500]/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-[#FFA500] fill-current" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Favorites</h1>
            <p className="text-xs text-white/60 mt-0.5">
              {favorites.length} sample{favorites.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <SyncStatus />
      </header>

      {/* Favorites list */}
      <FileList
        files={favorites}
        isLoading={isLoading}
        onFavoriteToggle={handleFavoriteToggle}
        onFileTap={handleFileTap}
        emptyMessage="No favorites yet"
      />

      {/* Tip for empty state */}
      {!isLoading && favorites.length === 0 && (
        <p className="text-center text-xs text-white/40 mt-4 px-8">
          Tap the heart icon on any sample to add it to your favorites
        </p>
      )}
    </div>
  );
}

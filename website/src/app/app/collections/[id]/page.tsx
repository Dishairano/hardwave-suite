'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FolderOpen, Loader2 } from 'lucide-react';
import { FileList } from '@/components/pwa/FileList';
import { SearchBar, SearchFilters } from '@/components/pwa/SearchBar';
import {
  Collection,
  AudioFile,
  getCollectionById,
  getFilesInCollection,
  toggleFavorite,
  initDB,
} from '@/lib/pwa/storage';

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'name',
    sortOrder: 'asc',
  });

  useEffect(() => {
    async function loadCollection() {
      try {
        await initDB();
        const [collectionData, filesData] = await Promise.all([
          getCollectionById(collectionId),
          getFilesInCollection(collectionId),
        ]);
        setCollection(collectionData || null);
        setFiles(filesData);
      } catch (err) {
        console.error('Failed to load collection:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCollection();
  }, [collectionId]);

  // Filter files based on search and filters
  const filteredFiles = files.filter((file) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      file.filename.toLowerCase().includes(query) ||
      file.tags?.some((t) => t.toLowerCase().includes(query))
    );
  });

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback(
    async (id: string, isFavorite: boolean) => {
      try {
        await toggleFavorite(id, isFavorite);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, isFavorite } : f))
        );
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
      }
    },
    []
  );

  // Get collection color
  const getColor = () => {
    if (!collection) return '#FFA500';
    if (collection.color) return collection.color;
    const colors = [
      '#FFA500', '#00C9FF', '#FF6B6B', '#4CAF50', '#9C27B0', '#FF9800',
    ];
    const index = collection.name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const color = getColor();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#FFA500] animate-spin" />
        <p className="mt-4 text-sm text-white/60">Loading collection...</p>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <FolderOpen className="w-8 h-8 text-white/40" />
        </div>
        <p className="text-sm text-white/60">Collection not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-[#FFA500] underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full active:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${color}20` }}
        >
          <FolderOpen className="w-6 h-6" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">
            {collection.name}
          </h1>
          <p className="text-xs text-white/60">
            {files.length} sample{files.length !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      {/* Description */}
      {collection.description && (
        <p className="text-sm text-white/60 mb-4">{collection.description}</p>
      )}

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        placeholder="Search in collection..."
      />

      {/* Files */}
      <div className="mt-4">
        <FileList
          files={filteredFiles}
          onFavoriteToggle={handleFavoriteToggle}
          emptyMessage="No samples in this collection"
        />
      </div>
    </div>
  );
}

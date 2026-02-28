'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Collection, getAllCollections, initDB } from '@/lib/pwa/storage';

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadCollections() {
      try {
        await initDB();
        const data = await getAllCollections();
        setCollections(data);
      } catch (err) {
        console.error('Failed to load collections:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCollections();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#FFA500] animate-spin" />
        <p className="mt-4 text-sm text-white/60">Loading collections...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-xl font-bold text-white">Collections</h1>
        <p className="text-xs text-white/60 mt-0.5">
          {collections.length} collection{collections.length !== 1 ? 's' : ''}
        </p>
      </header>

      {/* Collections list */}
      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-white/40" />
          </div>
          <p className="text-sm text-white/60">No collections yet</p>
          <p className="text-xs text-white/40 mt-1">
            Create collections in the desktop app
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionCard({ collection }: { collection: Collection }) {
  // Generate a color from the collection name if not set
  const getColor = () => {
    if (collection.color) return collection.color;
    const colors = [
      '#FFA500', // Orange
      '#00C9FF', // Cyan
      '#FF6B6B', // Red
      '#4CAF50', // Green
      '#9C27B0', // Purple
      '#FF9800', // Amber
    ];
    const index = collection.name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const color = getColor();

  return (
    <Link
      href={`/app/collections/${collection.id}`}
      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 active:bg-white/10 transition-colors"
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <FolderOpen className="w-6 h-6" style={{ color }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-white truncate">
          {collection.name}
        </h3>
        {collection.description && (
          <p className="text-xs text-white/60 truncate mt-0.5">
            {collection.description}
          </p>
        )}
        <p className="text-xs text-white/40 mt-0.5">
          {collection.fileCount} sample{collection.fileCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="w-5 h-5 text-white/40 flex-shrink-0" />
    </Link>
  );
}

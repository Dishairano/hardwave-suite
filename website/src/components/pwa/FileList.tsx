'use client';

import { useEffect, useRef } from 'react';
import { FileCard, FileCardProps } from './FileCard';
import { Loader2, FolderOpen } from 'lucide-react';

export interface FileListProps {
  files: Omit<FileCardProps, 'onFavoriteToggle' | 'onTap' | 'onMorePress' | 'onAddToCollection' | 'onDelete' | 'onPlay' | 'onSelect' | 'onLongPress'>[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  onFileTap?: (id: string) => void;
  onFileMorePress?: (id: string) => void;
  onAddToCollection?: (id: string) => void;
  onPlay?: (id: string) => void;
  onSelect?: (id: string, selected: boolean) => void;
  onLongPress?: (id: string) => void;
  emptyMessage?: string;
}

export function FileList({
  files,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onFavoriteToggle,
  onFileTap,
  onFileMorePress,
  onAddToCollection,
  onPlay,
  onSelect,
  onLongPress,
  emptyMessage = 'No files found',
}: FileListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, onLoadMore, isLoading]);

  // Show loading state
  if (isLoading && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-[#FFA500] animate-spin" />
        <p className="mt-4 text-sm text-white/60">Loading library...</p>
      </div>
    );
  }

  // Show empty state
  if (!isLoading && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <FolderOpen className="w-8 h-8 text-white/40" />
        </div>
        <p className="text-sm text-white/60">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {/* File list */}
      {files.map((file) => (
        <FileCard
          key={file.id}
          {...file}
          onFavoriteToggle={onFavoriteToggle}
          onTap={onFileTap}
          onMorePress={onFileMorePress}
          onAddToCollection={onAddToCollection}
          onPlay={onPlay}
          onSelect={onSelect}
          onLongPress={onLongPress}
        />
      ))}

      {/* Load more trigger */}
      {hasMore && (
        <div
          ref={loadMoreRef}
          className="flex items-center justify-center py-4"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-[#FFA500] animate-spin" />
          ) : (
            <span className="text-xs text-white/40">Scroll for more</span>
          )}
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && files.length > 10 && (
        <div className="flex items-center justify-center py-4">
          <span className="text-xs text-white/40">
            {files.length} files
          </span>
        </div>
      )}
    </div>
  );
}

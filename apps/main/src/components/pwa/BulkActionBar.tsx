'use client';

import { X, Heart, FolderPlus, Trash2, Share2, CheckSquare } from 'lucide-react';
import { hapticTap } from '@/lib/pwa/haptics';

interface BulkActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onSelectAll: () => void;
  onFavorite: () => void;
  onAddToCollection: () => void;
  onShare: () => void;
  onDelete?: () => void;
}

export function BulkActionBar({
  selectedCount,
  onCancel,
  onSelectAll,
  onFavorite,
  onAddToCollection,
  onShare,
  onDelete,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-40 bg-[#1a1a24] border-b border-white/10 safe-area-pt"
      style={{ animation: 'slideDown 0.2s ease-out' }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Cancel and count */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              hapticTap();
              onCancel();
            }}
            className="p-2 rounded-full active:bg-white/10"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <span className="text-sm font-medium text-white">
            {selectedCount} selected
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              hapticTap();
              onSelectAll();
            }}
            className="p-2 rounded-full active:bg-white/10"
            title="Select All"
          >
            <CheckSquare className="w-5 h-5 text-white/60" />
          </button>
          <button
            onClick={() => {
              hapticTap();
              onFavorite();
            }}
            className="p-2 rounded-full active:bg-white/10"
            title="Add to Favorites"
          >
            <Heart className="w-5 h-5 text-white/60" />
          </button>
          <button
            onClick={() => {
              hapticTap();
              onAddToCollection();
            }}
            className="p-2 rounded-full active:bg-white/10"
            title="Add to Collection"
          >
            <FolderPlus className="w-5 h-5 text-white/60" />
          </button>
          <button
            onClick={() => {
              hapticTap();
              onShare();
            }}
            className="p-2 rounded-full active:bg-white/10"
            title="Share"
          >
            <Share2 className="w-5 h-5 text-white/60" />
          </button>
          {onDelete && (
            <button
              onClick={() => {
                hapticTap();
                onDelete();
              }}
              className="p-2 rounded-full active:bg-white/10"
              title="Delete"
            >
              <Trash2 className="w-5 h-5 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

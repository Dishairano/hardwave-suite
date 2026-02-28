'use client';

import { Heart, Play, Pause, Check, MoreVertical } from 'lucide-react';
import { hapticTap, haptic } from '@/lib/pwa/haptics';
import { useRef, useState } from 'react';

export interface FileGridItemProps {
  id: string;
  filename: string;
  bpm?: number;
  musicalKey?: string;
  duration?: number;
  isFavorite: boolean;
  isPlaying?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onPlay?: (id: string) => void;
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  onMorePress?: (id: string) => void;
  onSelect?: (id: string, selected: boolean) => void;
  onLongPress?: (id: string) => void;
}

const LONG_PRESS_DURATION = 500;

export function FileGridItem({
  id,
  filename,
  bpm,
  musicalKey,
  duration,
  isFavorite,
  isPlaying = false,
  isSelected = false,
  selectionMode = false,
  onPlay,
  onFavoriteToggle,
  onMorePress,
  onSelect,
  onLongPress,
}: FileGridItemProps) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = () => {
    setIsPressed(true);
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      haptic('heavy');
      onLongPress?.(id);
    }, LONG_PRESS_DURATION);
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
    setIsPressed(false);
  };

  const handleClick = () => {
    hapticTap();
    if (selectionMode) {
      onSelect?.(id, !isSelected);
    } else {
      onPlay?.(id);
    }
  };

  // Get filename without extension
  const displayName = filename.replace(/\.[^/.]+$/, '');

  return (
    <div
      className={`relative rounded-xl overflow-hidden ${
        isSelected ? 'ring-2 ring-[#FFA500]' : ''
      } ${isPressed ? 'scale-95' : ''} transition-transform`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleClick}
    >
      {/* Artwork / Waveform placeholder */}
      <div
        className={`aspect-square bg-gradient-to-br from-[#FFA500]/20 to-[#FF6B00]/10 flex items-center justify-center relative ${
          isSelected ? 'bg-[#FFA500]/30' : ''
        }`}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div
            className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center ${
              isSelected ? 'bg-[#FFA500]' : 'bg-black/50 border border-white/30'
            }`}
          >
            {isSelected && <Check className="w-4 h-4 text-[#08080c]" />}
          </div>
        )}

        {/* Play indicator */}
        {isPlaying ? (
          <div className="w-14 h-14 rounded-full bg-[#FFA500] flex items-center justify-center">
            <Pause className="w-7 h-7 text-[#08080c]" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-black/30 flex items-center justify-center">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
        )}

        {/* Favorite button */}
        {!selectionMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              hapticTap();
              onFavoriteToggle?.(id, !isFavorite);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 active:bg-black/70"
          >
            <Heart
              className={`w-4 h-4 ${
                isFavorite ? 'fill-[#FFA500] text-[#FFA500]' : 'text-white/70'
              }`}
            />
          </button>
        )}

        {/* More button */}
        {!selectionMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              hapticTap();
              onMorePress?.(id);
            }}
            className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/50 active:bg-black/70"
          >
            <MoreVertical className="w-4 h-4 text-white/70" />
          </button>
        )}

        {/* BPM/Key badge */}
        {(bpm || musicalKey) && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {bpm && (
              <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white font-medium">
                {bpm}
              </span>
            )}
            {musicalKey && (
              <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] text-white font-medium">
                {musicalKey}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 bg-white/5">
        <h3
          className={`text-xs font-medium truncate ${
            isPlaying ? 'text-[#FFA500]' : 'text-white'
          }`}
        >
          {displayName}
        </h3>
        <p className="text-[10px] text-white/40 mt-0.5">
          {formatDuration(duration)}
        </p>
      </div>
    </div>
  );
}

interface FileGridProps {
  children: React.ReactNode;
}

export function FileGrid({ children }: FileGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {children}
    </div>
  );
}

'use client';

import { Heart, Music, MoreVertical, Play, Pause, Check, FolderPlus } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { hapticTap, hapticSuccess, haptic } from '@/lib/pwa/haptics';

export interface FileCardProps {
  id: string;
  filename: string;
  bpm?: number;
  key?: string;
  duration?: number;
  isFavorite: boolean;
  tags?: string[];
  isPlaying?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onFavoriteToggle?: (id: string, isFavorite: boolean) => void;
  onTap?: (id: string) => void;
  onPlay?: (id: string) => void;
  onMorePress?: (id: string) => void;
  onAddToCollection?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (id: string, selected: boolean) => void;
  onLongPress?: (id: string) => void;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;
const LONG_PRESS_DURATION = 500;

export function FileCard({
  id,
  filename,
  bpm,
  key: musicalKey,
  duration,
  isFavorite,
  tags,
  isPlaying = false,
  isSelected = false,
  selectionMode = false,
  onFavoriteToggle,
  onTap,
  onPlay,
  onMorePress,
  onAddToCollection,
  onDelete,
  onSelect,
  onLongPress,
}: FileCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const swipeDirectionRef = useRef<'left' | 'right' | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticTap();
    onFavoriteToggle?.(id, !isFavorite);
  };

  const handlePlayClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    hapticTap();
    onPlay?.(id);
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticTap();
    onMorePress?.(id);
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
    swipeDirectionRef.current = null;
    setIsPressed(true);

    // Start long press timer
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      if (!isSwipingRef.current) {
        haptic('heavy');
        onLongPress?.(id);
      }
    }, LONG_PRESS_DURATION);
  }, [id, onLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Cancel long press if moving
    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      clearLongPressTimer();
    }

    // Determine swipe direction on first significant movement
    if (!swipeDirectionRef.current && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        swipeDirectionRef.current = diffX > 0 ? 'right' : 'left';
        isSwipingRef.current = true;
      } else {
        return;
      }
    }

    if (isSwipingRef.current) {
      setIsPressed(false);
      const clampedX = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diffX));
      setSwipeX(clampedX);

      if (Math.abs(clampedX) >= SWIPE_THRESHOLD && Math.abs(swipeX) < SWIPE_THRESHOLD) {
        haptic('medium');
      }
    }
  }, [swipeX]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
    setIsPressed(false);

    if (Math.abs(swipeX) >= SWIPE_THRESHOLD) {
      if (swipeX > 0) {
        hapticSuccess();
        onFavoriteToggle?.(id, !isFavorite);
      } else {
        hapticSuccess();
        if (onAddToCollection) {
          onAddToCollection(id);
        } else if (onMorePress) {
          onMorePress(id);
        }
      }
    }

    setIsAnimating(true);
    setSwipeX(0);
    setTimeout(() => setIsAnimating(false), 200);
  }, [swipeX, id, isFavorite, onFavoriteToggle, onAddToCollection, onMorePress]);

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    setIsPressed(false);
    setIsAnimating(true);
    setSwipeX(0);
    setTimeout(() => setIsAnimating(false), 200);
  }, []);

  const handleClick = () => {
    if (!isSwipingRef.current) {
      hapticTap();
      if (selectionMode) {
        onSelect?.(id, !isSelected);
      } else {
        onTap?.(id);
      }
    }
  };

  const swipeProgress = Math.abs(swipeX) / SWIPE_THRESHOLD;
  const isSwipedRight = swipeX > 0;
  const isSwipedLeft = swipeX < 0;

  return (
    <div className={`relative overflow-hidden rounded-lg ${isSelected ? 'ring-2 ring-[#FFA500]' : ''}`}>
      {/* Background actions */}
      <div className="absolute inset-0 flex items-stretch">
        <div
          className={`flex items-center justify-start pl-4 w-1/2 transition-colors ${
            isSwipedRight && swipeProgress >= 1
              ? isFavorite ? 'bg-white/20' : 'bg-[#FFA500]'
              : 'bg-[#FFA500]/50'
          }`}
          style={{ opacity: isSwipedRight ? Math.min(swipeProgress, 1) : 0 }}
        >
          <Heart
            className={`w-6 h-6 ${isFavorite ? 'text-white' : 'text-[#08080c]'}`}
            fill={swipeProgress >= 1 ? 'currentColor' : 'none'}
          />
          <span className="ml-2 text-sm font-medium text-[#08080c]">
            {isFavorite ? 'Unfavorite' : 'Favorite'}
          </span>
        </div>

        <div
          className={`flex items-center justify-end pr-4 w-1/2 ml-auto transition-colors ${
            isSwipedLeft && swipeProgress >= 1 ? 'bg-[#00D4AA]' : 'bg-[#00D4AA]/50'
          }`}
          style={{ opacity: isSwipedLeft ? Math.min(swipeProgress, 1) : 0 }}
        >
          <span className="mr-2 text-sm font-medium text-[#08080c]">Add to...</span>
          <FolderPlus className="w-6 h-6 text-[#08080c]" />
        </div>
      </div>

      {/* Card content */}
      <div
        className={`relative flex items-center gap-3 p-3 bg-white/5 ${
          isPressed ? 'bg-white/10 scale-[0.98]' : 'active:bg-white/10'
        } ${isAnimating ? 'transition-transform duration-200 ease-out' : ''} ${
          isSelected ? 'bg-[#FFA500]/10' : ''
        }`}
        style={{ transform: `translateX(${swipeX}px)` }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {/* Selection checkbox or Play button */}
        {selectionMode ? (
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
              isSelected ? 'bg-[#FFA500]' : 'bg-white/10'
            }`}
          >
            {isSelected && <Check className="w-6 h-6 text-[#08080c]" />}
          </div>
        ) : (
          <button
            onClick={handlePlayClick}
            onTouchEnd={(e) => {
              e.stopPropagation();
              handlePlayClick(e);
            }}
            className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center touch-manipulation transition-colors ${
              isPlaying ? 'bg-[#FFA500]' : 'bg-[#FFA500]/10 active:bg-[#FFA500]/30'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-[#08080c]" />
            ) : (
              <Play className="w-6 h-6 text-[#FFA500] ml-0.5" />
            )}
          </button>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium truncate ${isPlaying ? 'text-[#FFA500]' : 'text-white'}`}>
            {filename}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs text-white/60">
            {bpm && (
              <span className="px-1.5 py-0.5 rounded bg-white/10">{bpm} BPM</span>
            )}
            {musicalKey && (
              <span className="px-1.5 py-0.5 rounded bg-white/10">{musicalKey}</span>
            )}
            <span>{formatDuration(duration)}</span>
          </div>
          {tags && tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-[#FFA500]/20 text-[#FFA500] truncate max-w-[80px]"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-[10px] text-white/40">+{tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!selectionMode && (
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleFavoriteClick}
              onTouchEnd={(e) => {
                e.stopPropagation();
                hapticTap();
                onFavoriteToggle?.(id, !isFavorite);
              }}
              className="p-2 rounded-full active:bg-white/10 transition-colors touch-manipulation"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isFavorite ? 'fill-[#FFA500] text-[#FFA500]' : 'text-white/40'
                }`}
              />
            </button>
            <button
              onClick={handleMoreClick}
              onTouchEnd={(e) => {
                e.stopPropagation();
                hapticTap();
                onMorePress?.(id);
              }}
              className="p-2 rounded-full active:bg-white/10 transition-colors touch-manipulation"
            >
              <MoreVertical className="w-5 h-5 text-white/40" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

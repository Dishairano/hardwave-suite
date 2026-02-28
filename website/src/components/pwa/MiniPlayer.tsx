'use client';

import { Play, Pause, SkipBack, SkipForward, X, ChevronUp } from 'lucide-react';
import { useAudioPlayer } from './AudioPlayerContext';
import { hapticTap } from '@/lib/pwa/haptics';
import { useState } from 'react';

interface MiniPlayerProps {
  onExpand?: () => void;
}

export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    pause,
    resume,
    playNext,
    playPrevious,
    stop,
    formatTime,
  } = useAudioPlayer();

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 bg-[#1a1a24] border-t border-white/10 safe-area-pb">
      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-[#FFA500] transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center gap-3 px-4 py-2">
        {/* Track info */}
        <button
          onClick={() => {
            hapticTap();
            onExpand?.();
          }}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-sm font-medium text-white truncate">
            {currentTrack.name}
          </p>
          <p className="text-xs text-white/50">
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={playPrevious}
            className="p-2 rounded-full active:bg-white/10"
          >
            <SkipBack className="w-5 h-5 text-white/60" />
          </button>

          <button
            onClick={isPlaying ? pause : resume}
            className="p-3 rounded-full bg-[#FFA500] active:bg-[#FF8C00]"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-[#08080c]" />
            ) : (
              <Play className="w-5 h-5 text-[#08080c] ml-0.5" />
            )}
          </button>

          <button
            onClick={playNext}
            className="p-2 rounded-full active:bg-white/10"
          >
            <SkipForward className="w-5 h-5 text-white/60" />
          </button>

          <button
            onClick={() => {
              hapticTap();
              stop();
            }}
            className="p-2 rounded-full active:bg-white/10"
          >
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>
      </div>
    </div>
  );
}

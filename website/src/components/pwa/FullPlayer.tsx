'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Share2,
  Heart,
  ListMusic,
  Volume2,
  Repeat,
  Shuffle,
} from 'lucide-react';
import { useAudioPlayer } from './AudioPlayerContext';
import { hapticTap, hapticSuccess } from '@/lib/pwa/haptics';

interface FullPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  onShare?: () => void;
  onFavorite?: () => void;
  isFavorite?: boolean;
}

export function FullPlayer({
  isOpen,
  onClose,
  onShare,
  onFavorite,
  isFavorite = false,
}: FullPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    queue,
    queueIndex,
    pause,
    resume,
    seek,
    setVolume,
    playNext,
    playPrevious,
    formatTime,
  } = useAudioPlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [waveform, setWaveform] = useState<number[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);

  // Generate fake waveform for visualization
  useEffect(() => {
    if (currentTrack) {
      const bars = 50;
      const newWaveform = Array.from({ length: bars }, () =>
        0.3 + Math.random() * 0.7
      );
      setWaveform(newWaveform);
    }
  }, [currentTrack?.id]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;

    hapticTap();
    seek(Math.max(0, Math.min(duration, newTime)));
  };

  if (!isOpen || !currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#08080c] flex flex-col"
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 safe-area-pt">
        <button
          onClick={() => {
            hapticTap();
            onClose();
          }}
          className="p-2 rounded-full active:bg-white/10"
        >
          <ChevronDown className="w-6 h-6 text-white" />
        </button>
        <span className="text-sm text-white/60">Now Playing</span>
        <button
          onClick={() => {
            hapticTap();
            setShowQueue(!showQueue);
          }}
          className="p-2 rounded-full active:bg-white/10"
        >
          <ListMusic className="w-6 h-6 text-white/60" />
        </button>
      </div>

      {showQueue ? (
        /* Queue View */
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <h3 className="text-lg font-semibold text-white mb-4">Queue</h3>
          {queue.length === 0 ? (
            <p className="text-white/40 text-sm">Queue is empty</p>
          ) : (
            <div className="space-y-2">
              {queue.map((track, index) => (
                <div
                  key={`${track.id}-${index}`}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    index === queueIndex ? 'bg-[#FFA500]/20' : 'bg-white/5'
                  }`}
                >
                  <span className="text-sm text-white/40 w-6">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${
                      index === queueIndex ? 'text-[#FFA500] font-medium' : 'text-white'
                    }`}>
                      {track.name}
                    </p>
                    {track.bpm && (
                      <p className="text-xs text-white/40">{track.bpm} BPM</p>
                    )}
                  </div>
                  {index === queueIndex && isPlaying && (
                    <div className="flex gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-[#FFA500] rounded-full animate-pulse"
                          style={{
                            height: `${12 + Math.random() * 8}px`,
                            animationDelay: `${i * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Player View */
        <div className="flex-1 flex flex-col px-6">
          {/* Artwork / Waveform */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-xs aspect-square rounded-2xl bg-gradient-to-br from-[#FFA500]/20 to-[#FF6B00]/20 flex items-center justify-center relative overflow-hidden">
              {/* Waveform visualization */}
              <div className="absolute inset-0 flex items-center justify-center gap-[2px] px-4">
                {waveform.map((height, i) => {
                  const isActive = (i / waveform.length) * 100 <= progress;
                  return (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-100 ${
                        isActive ? 'bg-[#FFA500]' : 'bg-white/20'
                      }`}
                      style={{
                        height: `${height * 60}%`,
                        transform: isPlaying && isActive ? 'scaleY(1.1)' : 'scaleY(1)',
                      }}
                    />
                  );
                })}
              </div>
              {/* Play indicator */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-20 h-20 rounded-full bg-[#FFA500]/30 flex items-center justify-center ${
                  isPlaying ? 'animate-pulse' : ''
                }`}>
                  {isPlaying ? (
                    <Pause className="w-10 h-10 text-[#FFA500]" />
                  ) : (
                    <Play className="w-10 h-10 text-[#FFA500] ml-1" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Track Info */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-white truncate px-4">
              {currentTrack.name}
            </h2>
            <div className="flex items-center justify-center gap-3 mt-2">
              {currentTrack.bpm && (
                <span className="text-sm text-white/50">{currentTrack.bpm} BPM</span>
              )}
              {currentTrack.key && (
                <span className="text-sm text-white/50">{currentTrack.key}</span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              onTouchStart={handleProgressClick}
              className="h-2 bg-white/10 rounded-full cursor-pointer touch-manipulation"
            >
              <div
                className="h-full bg-[#FFA500] rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg" />
              </div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-white/50">{formatTime(currentTime)}</span>
              <span className="text-xs text-white/50">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <button
              onClick={playPrevious}
              className="p-3 rounded-full active:bg-white/10"
            >
              <SkipBack className="w-8 h-8 text-white" />
            </button>

            <button
              onClick={isPlaying ? pause : resume}
              className="p-5 rounded-full bg-[#FFA500] active:bg-[#FF8C00]"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-[#08080c]" />
              ) : (
                <Play className="w-8 h-8 text-[#08080c] ml-1" />
              )}
            </button>

            <button
              onClick={playNext}
              className="p-3 rounded-full active:bg-white/10"
            >
              <SkipForward className="w-8 h-8 text-white" />
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="flex items-center justify-around pb-8 safe-area-pb">
            <button
              onClick={() => {
                hapticTap();
                onFavorite?.();
              }}
              className="p-3 rounded-full active:bg-white/10"
            >
              <Heart
                className={`w-6 h-6 ${
                  isFavorite ? 'text-red-500 fill-red-500' : 'text-white/60'
                }`}
              />
            </button>

            <button
              onClick={() => {
                hapticTap();
                onShare?.();
              }}
              className="p-3 rounded-full active:bg-white/10"
            >
              <Share2 className="w-6 h-6 text-white/60" />
            </button>

            <button className="p-3 rounded-full active:bg-white/10">
              <Volume2 className="w-6 h-6 text-white/60" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

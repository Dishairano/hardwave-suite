'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Track, PlayerState, initialPlayerState, getAudioElement, getStreamUrl, formatTime } from '@/lib/pwa/audioPlayer';
import { hapticTap, hapticSuccess } from '@/lib/pwa/haptics';

interface AudioPlayerContextType extends PlayerState {
  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: () => void;
  playPrevious: () => void;
  formatTime: (seconds: number) => string;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>(initialPlayerState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = getAudioElement();
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setState((prev) => ({
        ...prev,
        currentTime: audio.currentTime,
      }));
    };

    const handleLoadedMetadata = () => {
      setState((prev) => ({
        ...prev,
        duration: audio.duration,
      }));
    };

    const handleEnded = () => {
      setState((prev) => {
        // Auto-play next in queue
        if (prev.queueIndex < prev.queue.length - 1) {
          const nextIndex = prev.queueIndex + 1;
          const nextTrack = prev.queue[nextIndex];
          if (nextTrack.url) {
            audio.src = nextTrack.url;
            audio.play();
          } else if (nextTrack.id) {
            audio.src = getStreamUrl(nextTrack.id);
            audio.play();
          }
          return {
            ...prev,
            currentTrack: nextTrack,
            queueIndex: nextIndex,
            isPlaying: true,
            currentTime: 0,
          };
        }
        return {
          ...prev,
          isPlaying: false,
          currentTime: 0,
        };
      });
    };

    const handleError = (e: Event) => {
      console.error('Audio playback error:', e);
      setState((prev) => ({
        ...prev,
        isPlaying: false,
      }));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const play = useCallback((track: Track) => {
    hapticTap();
    const audio = audioRef.current;
    if (!audio) return;

    const url = track.url || getStreamUrl(track.id);
    audio.src = url;
    audio.play().catch(console.error);

    setState((prev) => {
      // Add to queue if not already there
      const existingIndex = prev.queue.findIndex((t) => t.id === track.id);
      let newQueue = prev.queue;
      let newIndex = existingIndex;

      if (existingIndex === -1) {
        newQueue = [...prev.queue, track];
        newIndex = newQueue.length - 1;
      }

      return {
        ...prev,
        currentTrack: track,
        isPlaying: true,
        currentTime: 0,
        queue: newQueue,
        queueIndex: newIndex,
      };
    });
  }, []);

  const pause = useCallback(() => {
    hapticTap();
    audioRef.current?.pause();
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    hapticTap();
    audioRef.current?.play().catch(console.error);
    setState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
      currentTrack: null,
    }));
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setState((prev) => ({ ...prev, currentTime: time }));
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
      setState((prev) => ({ ...prev, volume }));
    }
  }, []);

  const addToQueue = useCallback((track: Track) => {
    hapticTap();
    setState((prev) => {
      if (prev.queue.some((t) => t.id === track.id)) {
        return prev;
      }
      return {
        ...prev,
        queue: [...prev.queue, track],
      };
    });
    hapticSuccess();
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState((prev) => {
      const newQueue = prev.queue.filter((_, i) => i !== index);
      let newIndex = prev.queueIndex;
      if (index < prev.queueIndex) {
        newIndex--;
      } else if (index === prev.queueIndex) {
        newIndex = Math.min(newIndex, newQueue.length - 1);
      }
      return {
        ...prev,
        queue: newQueue,
        queueIndex: newIndex,
      };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState((prev) => ({
      ...prev,
      queue: prev.currentTrack ? [prev.currentTrack] : [],
      queueIndex: prev.currentTrack ? 0 : -1,
    }));
  }, []);

  const playNext = useCallback(() => {
    hapticTap();
    setState((prev) => {
      if (prev.queueIndex >= prev.queue.length - 1) return prev;

      const nextIndex = prev.queueIndex + 1;
      const nextTrack = prev.queue[nextIndex];
      const audio = audioRef.current;

      if (audio && nextTrack) {
        const url = nextTrack.url || getStreamUrl(nextTrack.id);
        audio.src = url;
        audio.play().catch(console.error);
      }

      return {
        ...prev,
        currentTrack: nextTrack,
        queueIndex: nextIndex,
        isPlaying: true,
        currentTime: 0,
      };
    });
  }, []);

  const playPrevious = useCallback(() => {
    hapticTap();
    const audio = audioRef.current;

    // If more than 3 seconds in, restart current track
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    setState((prev) => {
      if (prev.queueIndex <= 0) {
        if (audio) audio.currentTime = 0;
        return prev;
      }

      const prevIndex = prev.queueIndex - 1;
      const prevTrack = prev.queue[prevIndex];

      if (audio && prevTrack) {
        const url = prevTrack.url || getStreamUrl(prevTrack.id);
        audio.src = url;
        audio.play().catch(console.error);
      }

      return {
        ...prev,
        currentTrack: prevTrack,
        queueIndex: prevIndex,
        isPlaying: true,
        currentTime: 0,
      };
    });
  }, []);

  const value: AudioPlayerContextType = {
    ...state,
    play,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    addToQueue,
    removeFromQueue,
    clearQueue,
    playNext,
    playPrevious,
    formatTime,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
  }
  return context;
}

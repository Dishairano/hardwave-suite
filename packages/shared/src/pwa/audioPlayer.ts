/**
 * Audio Player State Management
 */

export interface Track {
  id: string;
  name: string;
  url?: string;
  duration?: number;
  bpm?: number;
  key?: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Track[];
  queueIndex: number;
}

export const initialPlayerState: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  queue: [],
  queueIndex: -1,
};

// Global audio element singleton
let audioElement: HTMLAudioElement | null = null;

export function getAudioElement(): HTMLAudioElement {
  if (typeof window === 'undefined') {
    throw new Error('Audio not available on server');
  }
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.preload = 'metadata';
  }
  return audioElement;
}

// Generate streaming URL for a file
export function getStreamUrl(fileId: string): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('hardwave_token') : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://hardwavestudios.com/api';
  return `${baseUrl}/library/files/${fileId}/stream${token ? `?token=${token}` : ''}`;
}

// Waveform generation from audio buffer
export async function generateWaveform(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer,
  samples: number = 100
): Promise<number[]> {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samples);
  const waveform: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[start + j] || 0);
    }
    waveform.push(sum / blockSize);
  }

  // Normalize to 0-1 range
  const max = Math.max(...waveform);
  return waveform.map((v) => (max > 0 ? v / max : 0));
}

// Format time as mm:ss
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

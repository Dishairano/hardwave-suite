'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Download, ArrowLeft, Scissors, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/pwa/haptics';

export default function AudioTrimmerPage() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationRef = useRef<number | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    hapticTap();
    setFileName(file.name);

    try {
      const ctx = getAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(buffer);
      setDuration(buffer.duration);
      setStartTime(0);
      setEndTime(buffer.duration);
      setWaveform(generateWaveform(buffer, 100));
      hapticSuccess();
    } catch (err) {
      console.error('Failed to load audio:', err);
      hapticError();
    }
  };

  const generateWaveform = (buffer: AudioBuffer, samples: number): number[] => {
    const channelData = buffer.getChannelData(0);
    const blockSize = Math.floor(channelData.length / samples);
    const waveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const abs = Math.abs(channelData[start + j] || 0);
        if (abs > max) max = abs;
      }
      waveform.push(max);
    }

    const maxVal = Math.max(...waveform);
    return waveform.map((v) => (maxVal > 0 ? v / maxVal : 0));
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  const togglePlayback = () => {
    hapticTap();

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      sourceNodeRef.current = null;
      setIsPlaying(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    if (!audioBuffer) return;

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const playDuration = endTime - startTime;
    source.start(0, startTime, playDuration);
    startTimeRef.current = ctx.currentTime;

    const updateTime = () => {
      const elapsed = ctx.currentTime - startTimeRef.current;
      setCurrentTime(startTime + elapsed);
      if (elapsed < playDuration) {
        animationRef.current = requestAnimationFrame(updateTime);
      }
    };
    animationRef.current = requestAnimationFrame(updateTime);

    source.onended = () => {
      setIsPlaying(false);
      setCurrentTime(startTime);
      sourceNodeRef.current = null;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };

    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  const handleDownload = async () => {
    if (!audioBuffer) return;

    hapticTap();

    try {
      const startSample = Math.floor(startTime * audioBuffer.sampleRate);
      const endSample = Math.floor(endTime * audioBuffer.sampleRate);
      const newLength = endSample - startSample;
      const numChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;

      const ctx = getAudioContext();
      const trimmedBuffer = ctx.createBuffer(numChannels, newLength, sampleRate);

      for (let ch = 0; ch < numChannels; ch++) {
        const oldData = audioBuffer.getChannelData(ch);
        const newData = trimmedBuffer.getChannelData(ch);
        for (let i = 0; i < newLength; i++) {
          newData[i] = oldData[startSample + i];
        }
      }

      const wavBlob = audioBufferToWav(trimmedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace(/\.[^/.]+$/, '') + '_trimmed.wav';
      a.click();
      URL.revokeObjectURL(url);

      hapticSuccess();
    } catch (err) {
      console.error('Export failed:', err);
      hapticError();
    }
  };

  const reset = () => {
    hapticTap();
    setStartTime(0);
    setEndTime(duration);
  };

  useEffect(() => {
    return () => {
      sourceNodeRef.current?.stop();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const trimmedDuration = endTime - startTime;
  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;
  const currentPercent = (currentTime / duration) * 100;

  return (
    <div className="px-4 pt-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <Link
          href="/app/profile"
          className="inline-flex items-center gap-1 text-sm text-white/60 mb-3 active:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Scissors className="w-6 h-6 text-[#FF6B6B]" />
          Audio Trimmer
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Cut and trim audio files
        </p>
      </header>

      {/* File Upload */}
      <div className="mb-6">
        <input
          id="audio-upload-trim"
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label
          htmlFor="audio-upload-trim"
          className="w-full py-6 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 active:bg-white/10 cursor-pointer touch-manipulation"
        >
          {fileName ? (
            <>
              <Scissors className="w-8 h-8 text-[#FF6B6B]" />
              <span className="text-sm text-white truncate max-w-[80%]">
                {fileName}
              </span>
              <span className="text-xs text-white/40">
                {formatTime(duration)}
              </span>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-white/40" />
              <span className="text-sm text-white/60">Tap to upload audio</span>
            </>
          )}
        </label>
      </div>

      {/* Trimmer */}
      {audioBuffer && (
        <div className="space-y-6">
          {/* Waveform */}
          <div className="relative h-24 bg-white/5 rounded-xl overflow-hidden">
            {/* Waveform bars */}
            <div className="absolute inset-0 flex items-center justify-center gap-[1px] px-2">
              {waveform.map((height, i) => {
                const percent = (i / waveform.length) * 100;
                const isInRange = percent >= startPercent && percent <= endPercent;
                const isPlayed = percent <= currentPercent;
                return (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-colors ${
                      isInRange
                        ? isPlayed && isPlaying
                          ? 'bg-[#FF6B6B]'
                          : 'bg-white/60'
                        : 'bg-white/20'
                    }`}
                    style={{ height: `${height * 80}%` }}
                  />
                );
              })}
            </div>

            {/* Selection overlay - left fade */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-black/50"
              style={{ width: `${startPercent}%` }}
            />

            {/* Selection overlay - right fade */}
            <div
              className="absolute top-0 bottom-0 right-0 bg-black/50"
              style={{ width: `${100 - endPercent}%` }}
            />

            {/* Playhead */}
            {isPlaying && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#FF6B6B]"
                style={{ left: `${currentPercent}%` }}
              />
            )}
          </div>

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-2">Start Time</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={endTime - 0.01}
                value={startTime.toFixed(2)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setStartTime(Math.max(0, Math.min(endTime - 0.01, val)));
                }}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-sm outline-none focus:ring-2 focus:ring-[#FF6B6B]/50"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-2">End Time</label>
              <input
                type="number"
                step="0.01"
                min={startTime + 0.01}
                max={duration}
                value={endTime.toFixed(2)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || duration;
                  setEndTime(Math.max(startTime + 0.01, Math.min(duration, val)));
                }}
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-sm outline-none focus:ring-2 focus:ring-[#FF6B6B]/50"
              />
            </div>
          </div>

          {/* Duration info */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
            <div>
              <p className="text-xs text-white/40">Trimmed Duration</p>
              <p className="text-lg font-semibold text-white">{formatTime(trimmedDuration)}</p>
            </div>
            <button
              onClick={reset}
              className="p-2 rounded-lg bg-white/10 active:bg-white/20"
            >
              <RotateCcw className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Preview */}
          <button
            onClick={togglePlayback}
            className="w-full py-4 rounded-xl bg-white/10 flex items-center justify-center gap-2 active:bg-white/20"
          >
            {isPlaying ? (
              <>
                <Pause className="w-6 h-6 text-white" />
                <span className="text-white font-medium">Stop</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6 text-white ml-0.5" />
                <span className="text-white font-medium">Preview Selection</span>
              </>
            )}
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="w-full py-4 rounded-xl bg-[#FF6B6B] text-white font-semibold flex items-center justify-center gap-2 active:opacity-80"
          >
            <Download className="w-5 h-5" />
            Download Trimmed Audio
          </button>
        </div>
      )}

      {/* Info */}
      {!audioBuffer && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">How it works</h3>
          <ul className="text-xs text-white/60 space-y-1">
            <li>Set start and end times to trim</li>
            <li>Preview your selection before exporting</li>
            <li>Exports as 32-bit float WAV</li>
            <li>No quality loss from trimming</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 4;
  const dataSize = length * numChannels * bytesPerSample;

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 3, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 32, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      view.setFloat32(offset, buffer.getChannelData(ch)[i], true);
      offset += 4;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

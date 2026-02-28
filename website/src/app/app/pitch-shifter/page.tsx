'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Download, ArrowLeft, Music, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/pwa/haptics';

export default function PitchShifterPage() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [semitones, setSemitones] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

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
      hapticSuccess();
    } catch (err) {
      console.error('Failed to load audio:', err);
      hapticError();
    }
  };

  const adjustSemitones = (delta: number) => {
    hapticTap();
    setSemitones((prev) => Math.max(-12, Math.min(12, prev + delta)));
  };

  const togglePlayback = () => {
    hapticTap();

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      sourceNodeRef.current = null;
      setIsPlaying(false);
      return;
    }

    if (!audioBuffer) return;

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Pitch shift using playbackRate
    // Each semitone is a factor of 2^(1/12)
    source.playbackRate.value = Math.pow(2, semitones / 12);

    source.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
      sourceNodeRef.current = null;
    };
    source.start();

    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  const downloadPitchShifted = async () => {
    if (!audioBuffer) return;

    hapticTap();
    setIsProcessing(true);

    try {
      const pitchRatio = Math.pow(2, semitones / 12);
      const newLength = Math.round(audioBuffer.length / pitchRatio);
      const sampleRate = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;

      // Create offline context for rendering
      const offlineCtx = new OfflineAudioContext(numChannels, newLength, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = pitchRatio;
      source.connect(offlineCtx.destination);
      source.start();

      const renderedBuffer = await offlineCtx.startRendering();

      // Export as WAV
      const wavBlob = audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      const semitoneStr = semitones >= 0 ? `+${semitones}` : `${semitones}`;
      a.download = fileName.replace(/\.[^/.]+$/, '') + `_${semitoneStr}st.wav`;
      a.click();
      URL.revokeObjectURL(url);

      hapticSuccess();
    } catch (err) {
      console.error('Export failed:', err);
      hapticError();
    } finally {
      setIsProcessing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sourceNodeRef.current?.stop();
    };
  }, []);

  const semitoneName = getSemitoneName(semitones);

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
          <Music className="w-6 h-6 text-[#00D4AA]" />
          Pitch Shifter
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Change pitch in semitones (affects tempo)
        </p>
      </header>

      {/* File Upload */}
      <div className="mb-6">
        <input
          id="audio-upload-pitch"
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label
          htmlFor="audio-upload-pitch"
          className="w-full py-6 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 active:bg-white/10 cursor-pointer touch-manipulation"
        >
          {fileName ? (
            <>
              <Music className="w-8 h-8 text-[#00D4AA]" />
              <span className="text-sm text-white truncate max-w-[80%]">
                {fileName}
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

      {/* Pitch Control */}
      {audioBuffer && (
        <div className="space-y-6">
          {/* Semitone selector */}
          <div className="p-6 rounded-xl bg-white/5 text-center">
            <p className="text-sm text-white/60 mb-4">Pitch Shift</p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => adjustSemitones(-1)}
                className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
              >
                <Minus className="w-6 h-6 text-white" />
              </button>
              <div className="w-24 text-center">
                <p className="text-4xl font-bold text-[#00D4AA]">
                  {semitones >= 0 ? '+' : ''}{semitones}
                </p>
                <p className="text-xs text-white/40 mt-1">semitones</p>
              </div>
              <button
                onClick={() => adjustSemitones(1)}
                className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>
            </div>
            {semitoneName && (
              <p className="text-sm text-white/40 mt-4">{semitoneName}</p>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2 justify-center">
            {[-5, -3, -2, -1, 0, 1, 2, 3, 5, 7, 12].map((st) => (
              <button
                key={st}
                onClick={() => {
                  hapticTap();
                  setSemitones(st);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  semitones === st
                    ? 'bg-[#00D4AA] text-[#08080c]'
                    : 'bg-white/10 text-white/60 active:bg-white/20'
                }`}
              >
                {st >= 0 ? '+' : ''}{st}
              </button>
            ))}
          </div>

          {/* Preview */}
          <button
            onClick={togglePlayback}
            className="w-full py-4 rounded-xl bg-white/10 flex items-center justify-center gap-2 active:bg-white/20"
          >
            {isPlaying ? (
              <>
                <Pause className="w-6 h-6 text-white" />
                <span className="text-white font-medium">Stop Preview</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6 text-white ml-0.5" />
                <span className="text-white font-medium">Preview</span>
              </>
            )}
          </button>

          {/* Download */}
          <button
            onClick={downloadPitchShifted}
            disabled={isProcessing}
            className="w-full py-4 rounded-xl bg-[#00D4AA] text-[#08080c] font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            {isProcessing ? 'Processing...' : 'Download Pitched Audio'}
          </button>

          {/* Note */}
          <p className="text-xs text-white/40 text-center">
            Note: Simple pitch shift affects tempo. For tempo-independent pitch shifting, use external software.
          </p>
        </div>
      )}

      {/* Info */}
      {!audioBuffer && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">How it works</h3>
          <ul className="text-xs text-white/60 space-y-1">
            <li>Simple pitch shift using playback rate</li>
            <li>+12 semitones = 1 octave up (2x speed)</li>
            <li>-12 semitones = 1 octave down (0.5x speed)</li>
            <li>Exports as 32-bit float WAV</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function getSemitoneName(semitones: number): string {
  const names: Record<string, string> = {
    '-12': '1 octave down',
    '-7': 'Perfect 5th down',
    '-5': 'Perfect 4th down',
    '-3': 'Minor 3rd down',
    '-2': 'Major 2nd down',
    '-1': 'Minor 2nd down',
    '0': 'Original pitch',
    '1': 'Minor 2nd up',
    '2': 'Major 2nd up',
    '3': 'Minor 3rd up',
    '5': 'Perfect 4th up',
    '7': 'Perfect 5th up',
    '12': '1 octave up',
  };
  return names[semitones.toString()] || '';
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 4; // 32-bit float
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
  view.setUint16(20, 3, true); // IEEE float
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

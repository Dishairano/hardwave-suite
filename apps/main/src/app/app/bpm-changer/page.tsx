'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, Download, RefreshCw, Music, Zap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/pwa/haptics';
import { timeStretch, calculateStretchFactor } from '@/lib/pwa/timestretch';

interface AudioState {
  file: File | null;
  fileName: string;
  duration: number;
  originalBuffer: AudioBuffer | null;
  processedBuffer: AudioBuffer | null;
}

export default function BpmChangerPage() {
  const [audio, setAudio] = useState<AudioState>({
    file: null,
    fileName: '',
    duration: 0,
    originalBuffer: null,
    processedBuffer: null,
  });
  const [originalBpm, setOriginalBpm] = useState<string>('');
  const [targetBpm, setTargetBpm] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playOriginal, setPlayOriginal] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    hapticTap();
    setError(null);
    setIsProcessing(true);
    setProgress(10);

    try {
      const ctx = getAudioContext();
      const arrayBuffer = await file.arrayBuffer();
      setProgress(30);

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      setProgress(100);

      setAudio({
        file,
        fileName: file.name,
        duration: audioBuffer.duration,
        originalBuffer: audioBuffer,
        processedBuffer: null,
      });

      hapticSuccess();
    } catch (err) {
      console.error('Failed to load audio:', err);
      setError('Failed to load audio file. Please try a different format.');
      hapticError();
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Process audio with new BPM using WSOLA algorithm
  const processAudio = async () => {
    if (!audio.originalBuffer || !originalBpm || !targetBpm) return;

    const origBpm = parseFloat(originalBpm);
    const targBpm = parseFloat(targetBpm);

    if (isNaN(origBpm) || isNaN(targBpm) || origBpm <= 0 || targBpm <= 0) {
      setError('Please enter valid BPM values');
      hapticError();
      return;
    }

    if (Math.abs(targBpm - origBpm) / origBpm > 0.5) {
      setError('BPM change too large. Keep changes under 50% for best quality.');
      hapticError();
      return;
    }

    hapticTap();
    setError(null);
    setIsProcessing(true);
    setProgress(5);

    try {
      const ctx = getAudioContext();
      const stretchFactor = calculateStretchFactor(origBpm, targBpm);

      // Use WSOLA algorithm for clean time-stretching
      // Pitch is preserved - only tempo changes
      const processedBuffer = await timeStretch(ctx, audio.originalBuffer, {
        stretchFactor,
        onProgress: (p) => setProgress(Math.round(p)),
      });

      setAudio((prev) => ({
        ...prev,
        processedBuffer,
      }));

      hapticSuccess();
    } catch (err) {
      console.error('Processing failed:', err);
      setError('Failed to process audio. Please try again.');
      hapticError();
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  // Play/pause audio
  const togglePlayback = () => {
    hapticTap();

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      sourceNodeRef.current = null;
      setIsPlaying(false);
      return;
    }

    const buffer = playOriginal ? audio.originalBuffer : audio.processedBuffer;
    if (!buffer) return;

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
      sourceNodeRef.current = null;
    };
    source.start();

    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  // Stop playback when switching preview
  useEffect(() => {
    if (isPlaying) {
      sourceNodeRef.current?.stop();
      sourceNodeRef.current = null;
      setIsPlaying(false);
    }
  }, [playOriginal]);

  // Download processed audio as 32-bit float WAV (lossless)
  const downloadAudio = () => {
    if (!audio.processedBuffer) return;

    hapticTap();

    const buffer = audio.processedBuffer;
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    const bytesPerSample = 4; // 32-bit float
    const dataSize = length * numChannels * bytesPerSample;

    // Create 32-bit float WAV file
    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 3, true); // Audio format: 3 = IEEE float
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
    view.setUint16(32, numChannels * bytesPerSample, true); // block align
    view.setUint16(34, 32, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels and write 32-bit float samples
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = buffer.getChannelData(ch)[i];
        view.setFloat32(offset, sample, true);
        offset += 4;
      }
    }

    // Create download link
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = audio.fileName.replace(/\.[^/.]+$/, '') + `_${targetBpm}bpm.wav`;
    a.click();
    URL.revokeObjectURL(url);

    hapticSuccess();
  };

  const bpmChange = originalBpm && targetBpm
    ? ((parseFloat(targetBpm) - parseFloat(originalBpm)) / parseFloat(originalBpm) * 100).toFixed(1)
    : null;

  return (
    <div className="px-4 pt-4 pb-24">
      {/* Header */}
      <header className="mb-6">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-sm text-white/60 mb-3 active:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Zap className="w-6 h-6 text-[#FFA500]" />
          BPM Changer
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Change tempo without affecting pitch
        </p>
      </header>

      {/* File Upload */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          id="audio-upload"
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isProcessing}
        />
        <label
          htmlFor="audio-upload"
          className={`w-full py-4 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 active:bg-white/10 cursor-pointer touch-manipulation ${
            isProcessing ? 'opacity-50 pointer-events-none' : ''
          }`}
          onTouchEnd={(e) => {
            if (isProcessing) {
              e.preventDefault();
              return;
            }
            hapticTap();
          }}
        >
          {audio.fileName ? (
            <>
              <Music className="w-8 h-8 text-[#FFA500]" />
              <span className="text-sm text-white truncate max-w-[80%]">
                {audio.fileName}
              </span>
              <span className="text-xs text-white/40">
                {audio.duration.toFixed(1)}s
              </span>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-white/40" />
              <span className="text-sm text-white/60">Tap to upload audio</span>
              <span className="text-xs text-white/40">MP3, WAV, FLAC, OGG, M4A</span>
            </>
          )}
        </label>
      </div>

      {/* BPM Inputs */}
      {audio.originalBuffer && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-2">
                Original BPM
              </label>
              <input
                type="number"
                value={originalBpm}
                onChange={(e) => setOriginalBpm(e.target.value)}
                placeholder="e.g. 190"
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-lg font-medium placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#FFA500]/50"
              />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-2">
                Target BPM
              </label>
              <input
                type="number"
                value={targetBpm}
                onChange={(e) => setTargetBpm(e.target.value)}
                placeholder="e.g. 200"
                className="w-full px-4 py-3 rounded-xl bg-white/10 text-white text-lg font-medium placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#FFA500]/50"
              />
            </div>
          </div>

          {/* BPM Change Indicator */}
          {bpmChange && (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-sm text-white/60">
                {parseFloat(bpmChange) > 0 ? 'Speed up' : 'Slow down'} by
              </span>
              <span className={`text-lg font-bold ${
                parseFloat(bpmChange) > 0 ? 'text-green-400' : 'text-blue-400'
              }`}>
                {Math.abs(parseFloat(bpmChange))}%
              </span>
            </div>
          )}

          {/* Process Button */}
          <button
            onClick={processAudio}
            disabled={isProcessing || !originalBpm || !targetBpm}
            className="w-full py-4 rounded-xl bg-[#FFA500] text-[#08080c] font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Processing... {progress}%
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Change BPM
              </>
            )}
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && progress > 0 && (
        <div className="mb-6">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FFA500] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Preview Section */}
      {audio.processedBuffer && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/60">Preview</span>
              <div className="flex rounded-lg bg-white/10 p-1">
                <button
                  onClick={() => setPlayOriginal(true)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    playOriginal
                      ? 'bg-[#FFA500] text-[#08080c]'
                      : 'text-white/60'
                  }`}
                >
                  Original
                </button>
                <button
                  onClick={() => setPlayOriginal(false)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    !playOriginal
                      ? 'bg-[#FFA500] text-[#08080c]'
                      : 'text-white/60'
                  }`}
                >
                  {targetBpm} BPM
                </button>
              </div>
            </div>

            <button
              onClick={togglePlayback}
              className="w-full py-4 rounded-xl bg-white/10 flex items-center justify-center gap-2 active:bg-white/20"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-6 h-6 text-white" />
                  <span className="text-white font-medium">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 text-white" />
                  <span className="text-white font-medium">
                    Play {playOriginal ? 'Original' : 'Processed'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Download Button */}
          <button
            onClick={downloadAudio}
            className="w-full py-4 rounded-xl bg-green-500 text-white font-semibold flex items-center justify-center gap-2 active:opacity-80"
          >
            <Download className="w-5 h-5" />
            Download {targetBpm} BPM Version
          </button>
        </div>
      )}

      {/* Tips */}
      {!audio.originalBuffer && (
        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">How it works</h3>
          <ul className="text-xs text-white/60 space-y-1">
            <li>Pitch stays the same - only tempo changes</li>
            <li>Exports as 32-bit float WAV (lossless)</li>
            <li>Best quality with changes under 20%</li>
            <li>Processing happens on your device</li>
          </ul>
        </div>
      )}
    </div>
  );
}

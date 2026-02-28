'use client';

import { useState, useRef } from 'react';
import { Upload, Music, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/pwa/haptics';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export default function KeyDetectorPage() {
  const [fileName, setFileName] = useState('');
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    hapticTap();
    setFileName(file.name);
    setError(null);
    setDetectedKey(null);
    setIsProcessing(true);

    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Analyze the audio to detect key
      const key = await detectKey(audioBuffer);
      setDetectedKey(key.key);
      setConfidence(key.confidence);
      hapticSuccess();
    } catch (err) {
      console.error('Key detection failed:', err);
      setError('Failed to analyze audio. Try a different file.');
      hapticError();
    } finally {
      setIsProcessing(false);
    }
  };

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
          <Music className="w-6 h-6 text-[#FFA500]" />
          Key Detector
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Detect the musical key of any audio file
        </p>
      </header>

      {/* File Upload */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          id="audio-upload-key"
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isProcessing}
        />
        <label
          htmlFor="audio-upload-key"
          className={`w-full py-8 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center gap-2 active:bg-white/10 cursor-pointer touch-manipulation ${
            isProcessing ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {fileName ? (
            <>
              <Music className="w-10 h-10 text-[#FFA500]" />
              <span className="text-sm text-white truncate max-w-[80%]">
                {fileName}
              </span>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 text-white/40" />
              <span className="text-sm text-white/60">Tap to upload audio</span>
              <span className="text-xs text-white/40">MP3, WAV, FLAC, etc.</span>
            </>
          )}
        </label>
      </div>

      {/* Processing */}
      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-10 h-10 text-[#FFA500] animate-spin" />
          <p className="text-sm text-white/60 mt-4">Analyzing audio...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Result */}
      {detectedKey && !isProcessing && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-gradient-to-br from-[#FFA500]/20 to-[#FF6B00]/10 text-center">
            <p className="text-sm text-white/60 mb-2">Detected Key</p>
            <p className="text-5xl font-bold text-[#FFA500]">{detectedKey}</p>
            <p className="text-sm text-white/40 mt-3">
              {confidence}% confidence
            </p>
          </div>

          {/* Relative keys */}
          <div className="p-4 rounded-xl bg-white/5">
            <h3 className="text-sm font-medium text-white mb-3">Related Keys</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-white/40">Relative Major/Minor</p>
                <p className="text-lg font-semibold text-white mt-1">
                  {getRelativeKey(detectedKey)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-xs text-white/40">Camelot</p>
                <p className="text-lg font-semibold text-white mt-1">
                  {getCamelotKey(detectedKey)}
                </p>
              </div>
            </div>
          </div>

          {/* Compatible keys */}
          <div className="p-4 rounded-xl bg-white/5">
            <h3 className="text-sm font-medium text-white mb-3">
              Compatible Keys for Mixing
            </h3>
            <div className="flex flex-wrap gap-2">
              {getCompatibleKeys(detectedKey).map((key) => (
                <span
                  key={key}
                  className="px-3 py-1.5 rounded-lg bg-[#FFA500]/20 text-[#FFA500] text-sm font-medium"
                >
                  {key}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      {!fileName && !isProcessing && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">How it works</h3>
          <ul className="text-xs text-white/60 space-y-1">
            <li>Uses chromagram analysis to detect pitch</li>
            <li>Compares against major and minor key profiles</li>
            <li>Works best with melodic content</li>
            <li>Processing happens on your device</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// Simple key detection using chromagram analysis
async function detectKey(
  audioBuffer: AudioBuffer
): Promise<{ key: string; confidence: number }> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // Take a sample from the middle of the track (most likely to have harmonic content)
  const sampleLength = Math.min(sampleRate * 30, channelData.length); // 30 seconds max
  const startOffset = Math.floor((channelData.length - sampleLength) / 2);
  const samples = channelData.slice(startOffset, startOffset + sampleLength);

  // Calculate chromagram using simple FFT-based approach
  const chroma = calculateChroma(samples, sampleRate);

  // Compare against key profiles
  const { key, confidence } = matchKeyProfile(chroma);

  return { key, confidence: Math.round(confidence * 100) };
}

function calculateChroma(samples: Float32Array, sampleRate: number): number[] {
  const chroma = new Array(12).fill(0);
  const frameSize = 4096;
  const hopSize = 2048;
  let frameCount = 0;

  for (let i = 0; i + frameSize < samples.length; i += hopSize) {
    const frame = samples.slice(i, i + frameSize);

    // Apply Hann window
    for (let j = 0; j < frameSize; j++) {
      frame[j] *= 0.5 * (1 - Math.cos((2 * Math.PI * j) / (frameSize - 1)));
    }

    // Simple pitch detection using autocorrelation
    for (let note = 0; note < 12; note++) {
      // Check multiple octaves
      for (let octave = 2; octave <= 6; octave++) {
        const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12);
        const period = sampleRate / freq;

        if (period < frameSize / 2) {
          let correlation = 0;
          const periodInt = Math.round(period);
          for (let j = 0; j < frameSize - periodInt; j++) {
            correlation += frame[j] * frame[j + periodInt];
          }
          chroma[note] += Math.max(0, correlation);
        }
      }
    }
    frameCount++;
  }

  // Normalize
  const max = Math.max(...chroma);
  if (max > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= max;
    }
  }

  return chroma;
}

function matchKeyProfile(chroma: number[]): { key: string; confidence: number } {
  // Krumhansl-Schmuckler key profiles
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  let bestKey = 'C';
  let bestCorrelation = -1;

  for (let i = 0; i < 12; i++) {
    // Rotate chroma to match key
    const rotatedChroma = [...chroma.slice(i), ...chroma.slice(0, i)];

    // Check major
    const majorCorr = correlation(rotatedChroma, majorProfile);
    if (majorCorr > bestCorrelation) {
      bestCorrelation = majorCorr;
      bestKey = NOTE_NAMES[i];
    }

    // Check minor
    const minorCorr = correlation(rotatedChroma, minorProfile);
    if (minorCorr > bestCorrelation) {
      bestCorrelation = minorCorr;
      bestKey = NOTE_NAMES[i] + 'm';
    }
  }

  return { key: bestKey, confidence: Math.max(0, Math.min(1, (bestCorrelation + 1) / 2)) };
}

function correlation(a: number[], b: number[]): number {
  const n = a.length;
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;

  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }

  const numerator = n * sumAB - sumA * sumB;
  const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));

  return denominator === 0 ? 0 : numerator / denominator;
}

function getRelativeKey(key: string): string {
  const isMinor = key.endsWith('m');
  const root = isMinor ? key.slice(0, -1) : key;
  const rootIndex = NOTE_NAMES.indexOf(root);

  if (isMinor) {
    // Relative major is 3 semitones up
    return NOTE_NAMES[(rootIndex + 3) % 12];
  } else {
    // Relative minor is 3 semitones down
    return NOTE_NAMES[(rootIndex + 9) % 12] + 'm';
  }
}

function getCamelotKey(key: string): string {
  const camelotMap: Record<string, string> = {
    'C': '8B', 'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B', 'B': '1B',
    'F#': '2B', 'C#': '3B', 'G#': '4B', 'D#': '5B', 'A#': '6B', 'F': '7B',
    'Am': '8A', 'Em': '9A', 'Bm': '10A', 'F#m': '11A', 'C#m': '12A', 'G#m': '1A',
    'D#m': '2A', 'A#m': '3A', 'Fm': '4A', 'Cm': '5A', 'Gm': '6A', 'Dm': '7A',
  };
  return camelotMap[key] || key;
}

function getCompatibleKeys(key: string): string[] {
  const camelot = getCamelotKey(key);
  const number = parseInt(camelot);
  const letter = camelot.slice(-1);

  const compatible: string[] = [];

  // Same key
  compatible.push(key);

  // +1 semitone (energy boost)
  const nextNum = number === 12 ? 1 : number + 1;
  compatible.push(getCamelotToKey(`${nextNum}${letter}`));

  // -1 semitone (energy drop)
  const prevNum = number === 1 ? 12 : number - 1;
  compatible.push(getCamelotToKey(`${prevNum}${letter}`));

  // Relative major/minor
  const otherLetter = letter === 'A' ? 'B' : 'A';
  compatible.push(getCamelotToKey(`${number}${otherLetter}`));

  return compatible.filter((k, i, arr) => arr.indexOf(k) === i);
}

function getCamelotToKey(camelot: string): string {
  const keyMap: Record<string, string> = {
    '8B': 'C', '9B': 'G', '10B': 'D', '11B': 'A', '12B': 'E', '1B': 'B',
    '2B': 'F#', '3B': 'C#', '4B': 'G#', '5B': 'D#', '6B': 'A#', '7B': 'F',
    '8A': 'Am', '9A': 'Em', '10A': 'Bm', '11A': 'F#m', '12A': 'C#m', '1A': 'G#m',
    '2A': 'D#m', '3A': 'A#m', '4A': 'Fm', '5A': 'Cm', '6A': 'Gm', '7A': 'Dm',
  };
  return keyMap[camelot] || camelot;
}

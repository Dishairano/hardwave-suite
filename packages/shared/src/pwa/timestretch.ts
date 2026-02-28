/**
 * High-quality time-stretching using WSOLA (Waveform Similarity Overlap-Add)
 * Changes tempo without affecting pitch - no FFT artifacts
 */

export interface TimeStretchOptions {
  stretchFactor: number; // > 1 = slower, < 1 = faster
  onProgress?: (progress: number) => void;
}

/**
 * Time-stretch an AudioBuffer using WSOLA algorithm
 */
export async function timeStretch(
  ctx: AudioContext | OfflineAudioContext,
  inputBuffer: AudioBuffer,
  options: TimeStretchOptions
): Promise<AudioBuffer> {
  const { stretchFactor, onProgress } = options;

  const numChannels = inputBuffer.numberOfChannels;
  const sampleRate = inputBuffer.sampleRate;
  const inputLength = inputBuffer.length;
  const outputLength = Math.round(inputLength * stretchFactor);

  // Create output buffer
  const outputBuffer = ctx.createBuffer(numChannels, outputLength, sampleRate);

  // Process each channel
  for (let channel = 0; channel < numChannels; channel++) {
    const inputData = inputBuffer.getChannelData(channel);
    const outputData = outputBuffer.getChannelData(channel);

    await wsolaProcess(
      inputData,
      outputData,
      stretchFactor,
      sampleRate,
      (p) => onProgress?.((channel / numChannels + p / numChannels) * 100)
    );
  }

  return outputBuffer;
}

/**
 * WSOLA algorithm - clean implementation without FFT
 */
async function wsolaProcess(
  input: Float32Array,
  output: Float32Array,
  stretchFactor: number,
  sampleRate: number,
  onProgress?: (progress: number) => void
): Promise<void> {
  const inputLength = input.length;
  const outputLength = output.length;

  // Frame size based on sample rate (about 50ms for good quality)
  const frameSize = Math.pow(2, Math.round(Math.log2(sampleRate * 0.05)));
  const halfFrame = frameSize / 2;

  // Overlap is 75% for smooth transitions
  const synthesisHop = Math.round(frameSize / 4);
  const analysisHop = Math.round(synthesisHop / stretchFactor);

  // Search range for best match (about 15ms)
  const searchRange = Math.round(sampleRate * 0.015);

  // Initialize output
  output.fill(0);

  // Create crossfade window (raised cosine)
  const fadeIn = new Float32Array(halfFrame);
  const fadeOut = new Float32Array(halfFrame);
  for (let i = 0; i < halfFrame; i++) {
    const t = i / halfFrame;
    fadeIn[i] = Math.sin(t * Math.PI / 2);
    fadeOut[i] = Math.cos(t * Math.PI / 2);
  }

  let inputPos = 0;
  let outputPos = 0;
  let frameCount = 0;
  const totalFrames = Math.ceil(outputLength / synthesisHop);

  // Copy first frame directly
  for (let i = 0; i < frameSize && i < inputLength && i < outputLength; i++) {
    output[i] = input[i];
  }
  outputPos = synthesisHop;
  inputPos = analysisHop;

  while (outputPos + frameSize < outputLength && inputPos + frameSize < inputLength) {
    // Find the best matching position within search range
    const bestOffset = findBestMatch(
      input,
      output,
      inputPos,
      outputPos,
      frameSize,
      searchRange,
      inputLength,
      outputLength
    );

    const actualInputPos = Math.max(0, Math.min(inputLength - frameSize, inputPos + bestOffset));

    // Crossfade overlap region
    const overlapStart = outputPos;
    for (let i = 0; i < halfFrame && overlapStart + i < outputLength; i++) {
      const existingSample = output[overlapStart + i];
      const newSample = input[actualInputPos + i];
      output[overlapStart + i] = existingSample * fadeOut[i] + newSample * fadeIn[i];
    }

    // Copy non-overlapping part
    for (let i = halfFrame; i < frameSize && outputPos + i < outputLength; i++) {
      if (actualInputPos + i < inputLength) {
        output[outputPos + i] = input[actualInputPos + i];
      }
    }

    inputPos += analysisHop;
    outputPos += synthesisHop;
    frameCount++;

    // Progress update
    if (frameCount % 30 === 0) {
      onProgress?.(frameCount / totalFrames);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Measure and match levels
  const inputRMS = calculateRMS(input);
  const outputRMS = calculateRMS(output);

  if (outputRMS > 0.0001 && inputRMS > 0.0001) {
    const gain = inputRMS / outputRMS;
    for (let i = 0; i < outputLength; i++) {
      output[i] *= gain;
    }
  }

  onProgress?.(1);
}

/**
 * Find the best matching offset using cross-correlation
 */
function findBestMatch(
  input: Float32Array,
  output: Float32Array,
  inputPos: number,
  outputPos: number,
  frameSize: number,
  searchRange: number,
  inputLength: number,
  outputLength: number
): number {
  const overlapSize = Math.round(frameSize / 4);
  let bestOffset = 0;
  let bestCorrelation = -Infinity;

  // Get the end of the already-written output for comparison
  const compareStart = Math.max(0, outputPos - overlapSize);

  for (let offset = -searchRange; offset <= searchRange; offset++) {
    const testPos = inputPos + offset;

    if (testPos < 0 || testPos + frameSize >= inputLength) continue;

    // Calculate normalized cross-correlation
    let correlation = 0;
    let inputEnergy = 0;
    let outputEnergy = 0;

    for (let i = 0; i < overlapSize; i++) {
      const outIdx = compareStart + i;
      const inIdx = testPos - overlapSize + i;

      if (outIdx >= 0 && outIdx < outputLength && inIdx >= 0 && inIdx < inputLength) {
        const outSample = output[outIdx];
        const inSample = input[inIdx];
        correlation += outSample * inSample;
        inputEnergy += inSample * inSample;
        outputEnergy += outSample * outSample;
      }
    }

    // Normalize
    const energy = Math.sqrt(inputEnergy * outputEnergy);
    if (energy > 0.0001) {
      correlation /= energy;
    }

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

/**
 * Calculate RMS level
 */
function calculateRMS(data: Float32Array): number {
  let sum = 0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / len);
}

/**
 * Calculate the BPM change ratio
 */
export function calculateStretchFactor(originalBpm: number, targetBpm: number): number {
  return originalBpm / targetBpm;
}

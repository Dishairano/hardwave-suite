# packages/analyser-engine — CLAUDE Instructions

**Package:** `@hardwave/analyser-engine`
**What it is:** The DSP engine and React UI for the Hardwave Analyser — shared between the VST webview (`apps/analyser`) and the browser premium page (`apps/main/app/analyser`).

## Contents

| File | Purpose |
|---|---|
| `types.ts` | Core types: `AnalyserSettings`, `AnalyserState`, `ColorTheme`, `BandData`, etc. |
| `math.ts` | Frequency math: log-spacing, FFT bin → Hz, smoothing coefficients |
| `engine.ts` | Main analyser engine — processes raw FFT binary packets, maintains RMS/peak state |
| `renderer.ts` | Canvas renderer — draws spectrum, meters, grid, Catmull-Rom curves |
| `AnalyserCanvas.tsx` | React component — wires engine + renderer to a `<canvas>`, handles settings panel |

## How to import

From an app:
```typescript
// Via shim (recommended — keeps @/ paths consistent)
import AnalyserCanvas from '@/components/AnalyserCanvas';
import type { AnalyserSettings } from '@/lib/analyser/types';

// Or directly
import { AnalyserCanvas } from '@hardwave/analyser-engine/AnalyserCanvas';
import type { AnalyserSettings } from '@hardwave/analyser-engine/types';
```

## Data flow
```
VST plugin (Rust)
  → binary packet (bincode: left_bins: [f32; 2048], right_bins: [f32; 2048], rms_left, rms_right)
  → engine.processPacket(buffer: ArrayBuffer)
  → engine.getState() → AnalyserState { bands[], rmsL, rmsR, peakL, peakR }
  → renderer.draw(canvas, state, settings)
```

**Binary format compatibility:** The engine has a fallback shim for the old 64-band format (`left_bands` / `right_bands`). When reading packets, check both `left_bins` (2048-bin, new) and `left_bands` (64-bin, old) field names.

## Settings persistence
`AnalyserCanvas` saves settings to `localStorage` under `hardwave_analyser_settings`. The settings object is `AnalyserSettings` from `types.ts`. Presets are stored as named objects alongside.

## Performance rules
- The renderer runs inside `requestAnimationFrame`. Keep it allocation-free — no array creation per frame.
- Smoothing is applied in the engine, not the renderer. Engine maintains exponential moving average per bin.
- Catmull-Rom curve interpolation is in `renderer.ts` — only recompute control points when band count changes.
- The canvas is scaled to `devicePixelRatio` once at mount. Do NOT re-scale every frame.

## Modifying the engine
The engine and renderer are the most performance-critical code in the entire codebase. When changing them:
1. Test with the actual VST plugin sending data at ~20Hz.
2. Profile with browser DevTools — the `draw()` call must complete in < 5ms on a mid-range machine.
3. Avoid creating closures inside the animation loop.

## Constraints
- **No Next.js imports.** This package must be usable in any React context (Tauri, plain web, etc.).
- **No server-side code.** Everything here runs in the browser.
- Relative imports only between files in this package (`./engine`, `./types`, etc.).
- `AnalyserCanvas.tsx` may use `'use client'` semantics but does NOT include the directive — apps control that boundary via their shim.

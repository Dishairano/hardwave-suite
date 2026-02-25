// AnalyserRenderer — pure Canvas 2D drawing for the Hardwave Analyser.
// No React dependency. Takes a canvas context + engine state + config.

import type { AnalyserEngine } from './engine'
import type { AnalyserConfig, TraceId, Snapshot } from './types'
import { DISPLAY_BANDS, MIN_FREQ, MAX_FREQ, SPECTRUM_PAD } from './types'
import { clamp, formatFreq, formatDb, freqToNote, generateLogTicks, type LogTick } from './math'

const logTicks = generateLogTicks(MIN_FREQ, MAX_FREQ)

function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; cssW: number; cssH: number } | null {
  const rect = canvas.getBoundingClientRect()
  const cssW = rect.width
  const cssH = rect.height
  if (cssW <= 2 || cssH <= 2) return null

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const nextW = Math.max(1, Math.round(cssW * dpr))
  const nextH = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW
    canvas.height = nextH
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, cssW, cssH }
}

/**
 * Catmull-Rom smooth path through `data` points.
 * Uses the Catmull-Rom → cubic Bezier conversion so the curve passes exactly
 * through every data point — no softening of peaks — while eliminating the
 * staircase look of straight-line segments.
 * x coordinates are assumed uniformly spaced (xFn is linear), which lets us
 * simplify cp1x = x1+dx/3, cp2x = x2-dx/3.
 */
function smoothCurvePath(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  n: number,
  xFn: (i: number) => number,
  yFn: (v: number) => number,
): void {
  ctx.moveTo(xFn(0), yFn(data[0]))
  for (let i = 0; i < n - 1; i++) {
    const y0 = yFn(data[Math.max(0, i - 1)])
    const x1 = xFn(i),     y1 = yFn(data[i])
    const x2 = xFn(i + 1), y2 = yFn(data[i + 1])
    const y3 = yFn(data[Math.min(n - 1, i + 2)])
    const dx = x2 - x1
    ctx.bezierCurveTo(
      x1 + dx / 3, y1 + (y2 - y0) / 6,
      x2 - dx / 3, y2 - (y3 - y1) / 6,
      x2, y2,
    )
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const anyCtx = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, radii: number) => void }
  if (typeof anyCtx.roundRect === 'function') {
    anyCtx.roundRect(x, y, w, h, r)
    return
  }
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
}

export class AnalyserRenderer {
  drawSpectrum(
    canvas: HTMLCanvasElement,
    engine: AnalyserEngine,
    config: AnalyserConfig,
    refTrace: Float32Array | null,
    refName: string | null,
    hover: { active: boolean; x: number; y: number; band: number } | null,
  ): void {
    const setup = setupCanvas(canvas)
    if (!setup) return
    const { ctx, cssW, cssH } = setup

    const pad = SPECTRUM_PAD
    const plotX = pad.left
    const plotY = pad.top
    const plotW = Math.max(1, cssW - pad.left - pad.right)
    const plotH = Math.max(1, cssH - pad.top - pad.bottom)

    const logMin = Math.log10(MIN_FREQ)
    const logMax = Math.log10(MAX_FREQ)
    const xForFreq = (freq: number): number => {
      const t = (Math.log10(clamp(freq, MIN_FREQ, MAX_FREQ)) - logMin) / (logMax - logMin)
      return plotX + t * plotW
    }
    const xForBand = (i: number): number => plotX + (i / (DISPLAY_BANDS - 1)) * plotW

    const mix = engine.traces.mix
    const isDelta = config.view === 'delta'
    const dbTop = isDelta ? 12 : 0
    const dbBottom = isDelta ? -12 : -config.dbRange

    const yForValue = (db: number): number => {
      const t = (dbTop - db) / (dbTop - dbBottom)
      return plotY + clamp(t, 0, 1) * plotH
    }

    // Background
    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, cssW, cssH)

    // Grid: vertical frequency lines
    for (const t of logTicks) {
      const x = xForFreq(t.freq)
      ctx.strokeStyle = t.major ? 'rgba(39, 39, 42, 0.9)' : 'rgba(39, 39, 42, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, plotY)
      ctx.lineTo(x, plotY + plotH)
      ctx.stroke()

      if (t.major) {
        ctx.fillStyle = '#71717a'
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(t.label, x, cssH - 6)
      }
    }

    // Grid: horizontal dB lines
    const step = isDelta ? 6 : 12
    for (let db = dbTop; db >= dbBottom; db -= step) {
      const y = yForValue(db)
      ctx.strokeStyle = 'rgba(39, 39, 42, 0.9)'
      ctx.beginPath()
      ctx.moveTo(plotX, y)
      ctx.lineTo(plotX + plotW, y)
      ctx.stroke()

      ctx.fillStyle = '#52525b'
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${db}`, plotX - 6, y)
    }

    // Drawing helpers
    const drawLine = (data: Float32Array, stroke: string | CanvasGradient, widthPx: number, dashed = false, alpha = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = stroke
      ctx.lineWidth = widthPx
      if (dashed) ctx.setLineDash([4, 4])
      ctx.beginPath()
      smoothCurvePath(ctx, data, DISPLAY_BANDS, xForBand, yForValue)
      ctx.stroke()
      ctx.restore()
    }

    const drawArea = (data: Float32Array, fill: CanvasGradient, alpha: number) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = fill
      ctx.beginPath()
      smoothCurvePath(ctx, data, DISPLAY_BANDS, xForBand, yForValue)
      ctx.lineTo(plotX + plotW, plotY + plotH)
      ctx.lineTo(plotX, plotY + plotH)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    const mixGradient = ctx.createLinearGradient(0, plotY + plotH, 0, plotY)
    mixGradient.addColorStop(0, '#06b6d4')
    mixGradient.addColorStop(0.55, '#8b5cf6')
    mixGradient.addColorStop(0.85, '#f97316')
    mixGradient.addColorStop(1, '#ef4444')

    if (isDelta) {
      if (!refTrace) {
        ctx.fillStyle = '#a1a1aa'
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Capture a reference snapshot to view delta.', plotX + plotW / 2, plotY + plotH / 2)
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(plotX, yForValue(0))
        ctx.lineTo(plotX + plotW, yForValue(0))
        ctx.stroke()
        ctx.setLineDash([])

        const deltaArr = new Float32Array(DISPLAY_BANDS)
        for (let i = 0; i < DISPLAY_BANDS; i++) deltaArr[i] = mix[i] - refTrace[i]
        ctx.beginPath()
        smoothCurvePath(ctx, deltaArr, DISPLAY_BANDS, xForBand, yForValue)
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    } else {
      // Reference + average overlays
      if (config.showRef && refTrace) drawLine(refTrace, 'rgba(148, 163, 184, 0.65)', 1.25, true)
      if (config.showAvg) drawLine(engine.avg, 'rgba(34, 197, 94, 0.65)', 1.25, true)

      // Mix trace
      if (config.traces.mix) {
        drawArea(mix, mixGradient, 0.14)
        drawLine(mix, mixGradient, 2)
      }

      // Additional traces
      const traceStyles: Record<Exclude<TraceId, 'mix'>, { color: string; width: number; alpha?: number }> = {
        l: { color: 'rgba(6, 182, 212, 0.9)', width: 1.4 },
        r: { color: 'rgba(168, 85, 247, 0.85)', width: 1.4 },
        m: { color: 'rgba(34, 197, 94, 0.85)', width: 1.4 },
        s: { color: 'rgba(249, 115, 22, 0.85)', width: 1.4 },
      }

      for (const id of ['l', 'r', 'm', 's'] as const) {
        if (!config.traces[id]) continue
        const st = traceStyles[id]
        drawLine(engine.traces[id], st.color, st.width, false, st.alpha ?? 1)
      }

      // Peak hold markers
      if (config.peakHold) {
        const visible: TraceId[] = []
        if (config.traces.mix) visible.push('mix')
        if (config.traces.l) visible.push('l')
        if (config.traces.r) visible.push('r')
        if (config.traces.m) visible.push('m')
        if (config.traces.s) visible.push('s')
        for (const id of visible) {
          const peak = engine.peaks[id]
          ctx.save()
          ctx.globalAlpha = id === 'mix' ? 0.9 : 0.55
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1
          for (let i = 0; i < DISPLAY_BANDS; i += 2) {
            const x = xForBand(i)
            const y = yForValue(peak[i])
            ctx.beginPath()
            ctx.moveTo(x - 2, y)
            ctx.lineTo(x + 2, y)
            ctx.stroke()
          }
          ctx.restore()
        }
      }
    }

    // Hover crosshair + tooltip
    if (hover && hover.active) {
      const band = clamp(hover.band, 0, DISPLAY_BANDS - 1)
      const x = xForBand(band)
      const freq = engine.bandFreqs[band]
      const baseDb = mix[band]
      const d = refTrace ? baseDb - refTrace[band] : null
      const v = isDelta ? (d ?? 0) : baseDb
      const y = yForValue(v)

      ctx.save()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, plotY)
      ctx.lineTo(x, plotY + plotH)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(plotX, y)
      ctx.lineTo(plotX + plotW, y)
      ctx.stroke()
      ctx.restore()

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()

      const note = freqToNote(freq)
      const lines = [
        `${formatFreq(freq)}  ${note?.note ?? ''}${note?.cents ? ` ${note.cents >= 0 ? '+' : ''}${note.cents}c` : ''}`.trim(),
        isDelta ? `\u0394 ${formatDb(v).replace(' dB', '')} dB` : `${formatDb(baseDb)}`,
        !isDelta && d !== null ? `\u0394 ${d >= 0 ? '+' : ''}${d.toFixed(1)} dB vs ${refName ?? 'Ref'}` : '',
      ].filter(Boolean)

      const tooltipX = clamp(x + 10, plotX + 6, plotX + plotW - 160)
      const tooltipY = clamp(y - 30, plotY + 6, plotY + plotH - 56)
      ctx.save()
      ctx.fillStyle = 'rgba(17, 17, 19, 0.92)'
      ctx.strokeStyle = 'rgba(39, 39, 42, 0.9)'
      ctx.lineWidth = 1
      ctx.beginPath()
      roundRectPath(ctx, tooltipX, tooltipY, 160, 54, 8)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e4e4e7'
      ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], tooltipX + 10, tooltipY + 8 + i * 16)
      }
      ctx.restore()
    }
  }

  drawPhase(canvas: HTMLCanvasElement, correlation: number): void {
    const setup = setupCanvas(canvas)
    if (!setup) return
    const { ctx, cssW, cssH } = setup

    const corr = clamp(correlation, -1, 1)

    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, cssW, cssH)

    const pad = 14
    const barW = Math.max(1, cssW - pad * 2)
    const barH = 10
    const barY = cssH / 2

    const grad = ctx.createLinearGradient(pad, 0, pad + barW, 0)
    grad.addColorStop(0, '#ef4444')
    grad.addColorStop(0.5, '#f97316')
    grad.addColorStop(1, '#22c55e')

    ctx.fillStyle = 'rgba(24, 24, 27, 1)'
    ctx.fillRect(pad, barY - barH / 2, barW, barH)
    ctx.fillStyle = grad
    ctx.globalAlpha = 0.28
    ctx.fillRect(pad, barY - barH / 2, barW, barH)
    ctx.globalAlpha = 1

    ctx.strokeStyle = 'rgba(39, 39, 42, 1)'
    ctx.lineWidth = 1
    ctx.strokeRect(pad, barY - barH / 2, barW, barH)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.beginPath()
    ctx.moveTo(pad + barW / 2, barY - barH / 2 - 6)
    ctx.lineTo(pad + barW / 2, barY + barH / 2 + 6)
    ctx.stroke()

    const x = pad + ((corr + 1) / 2) * barW
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, barY - barH / 2 - 8)
    ctx.lineTo(x, barY + barH / 2 + 8)
    ctx.stroke()

    ctx.fillStyle = '#a1a1aa'
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('-1', pad, barY + barH / 2 + 10)
    ctx.textAlign = 'center'
    ctx.fillText('0', pad + barW / 2, barY + barH / 2 + 10)
    ctx.textAlign = 'right'
    ctx.fillText('+1', pad + barW, barY + barH / 2 + 10)

    const monoCompat = corr > 0.5 ? 'GOOD' : corr > 0 ? 'OK' : 'WARN'
    const monoColor = corr > 0.5 ? '#22c55e' : corr > 0 ? '#f97316' : '#ef4444'

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#e4e4e7'
    ctx.font = 'bold 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    ctx.fillText(corr.toFixed(2), cssW / 2, 22)

    ctx.fillStyle = monoColor
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    ctx.fillText(`MONO ${monoCompat}`, cssW / 2, 38)
  }

  drawPeakMeters(
    canvas: HTMLCanvasElement,
    engine: AnalyserEngine,
    peakHold: boolean,
  ): void {
    const setup = setupCanvas(canvas)
    if (!setup) return
    const { ctx, cssW, cssH } = setup

    const width = cssW
    const height = cssH

    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, width, height)

    const meterWidth = 30
    const meterHeight = height - 40
    const leftX = 20
    const rightX = width - 50
    const rmsX = width / 2 - 15
    const topY = 20

    ctx.fillStyle = '#52525b'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'

    const dbMarks = [0, -6, -12, -18, -24, -36, -48, -60]
    dbMarks.forEach(db => {
      const y = topY + meterHeight * (1 - (db + 60) / 60)
      ctx.fillText(`${db}`, leftX - 4, y + 3)
      ctx.strokeStyle = '#27272a'
      ctx.beginPath()
      ctx.moveTo(leftX, y)
      ctx.lineTo(rightX + meterWidth, y)
      ctx.stroke()
    })

    const m = engine.meters

    const drawMeter = (x: number, peakDb: number, rmsDb: number, peakHoldDb: number, clip: boolean, label: string) => {
      ctx.fillStyle = '#18181b'
      ctx.fillRect(x, topY, meterWidth, meterHeight)

      const gradient = ctx.createLinearGradient(0, topY + meterHeight, 0, topY)
      gradient.addColorStop(0, '#22c55e')
      gradient.addColorStop(0.6, '#22c55e')
      gradient.addColorStop(0.8, '#eab308')
      gradient.addColorStop(0.95, '#f97316')
      gradient.addColorStop(1, '#ef4444')

      const peakHeight = Math.max(0, (peakDb + 60) / 60) * meterHeight
      ctx.fillStyle = gradient
      ctx.fillRect(x, topY + meterHeight - peakHeight, meterWidth, peakHeight)

      const rmsHeight = Math.max(0, (rmsDb + 60) / 60) * meterHeight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.fillRect(x + 5, topY + meterHeight - rmsHeight, meterWidth - 10, rmsHeight)

      if (peakHold && peakHoldDb > -60) {
        const holdY = topY + meterHeight * (1 - (peakHoldDb + 60) / 60)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, holdY - 1, meterWidth, 2)
      }

      ctx.fillStyle = clip ? '#ef4444' : '#27272a'
      ctx.fillRect(x, topY - 15, meterWidth, 10)

      ctx.fillStyle = '#71717a'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(label, x + meterWidth / 2, topY + meterHeight + 15)

      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.fillText(peakDb > -60 ? peakDb.toFixed(1) : '-\u221E', x + meterWidth / 2, topY + meterHeight + 28)
    }

    const leftRmsDb = 20 * Math.log10((m.rmsDb > -100 ? Math.pow(10, m.rmsDb / 20) : 0) + 1e-10)
    drawMeter(leftX, m.leftPeakDb, leftRmsDb, m.leftTruePeakDb, m.leftPeakDb > -0.1, 'L')

    const avgRmsDb = m.rmsDb
    drawMeter(rmsX, avgRmsDb, avgRmsDb, Math.max(m.leftTruePeakDb, m.rightTruePeakDb) - 3, false, 'RMS')

    drawMeter(rightX, m.rightPeakDb, leftRmsDb, m.rightTruePeakDb, m.rightPeakDb > -0.1, 'R')
  }

  drawScope(canvas: HTMLCanvasElement, _message?: string): void {
    const setup = setupCanvas(canvas)
    if (!setup) return
    const { ctx, cssW, cssH } = setup

    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, cssW, cssH)

    ctx.fillStyle = '#71717a'
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Vectorscope requires time-domain data', cssW / 2, cssH / 2)
  }
}

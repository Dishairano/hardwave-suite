import analyserPoster from '../assets/tiles/analyser-poster.jpg'
import analyserLive from '../assets/tiles/analyser-live.mp4'
import wettboiPoster from '../assets/tiles/wettboi-poster.jpg'
import wettboiLive from '../assets/tiles/wettboi-live.mp4'
import wideboiPoster from '../assets/tiles/wideboi-poster.jpg'
import wideboiLive from '../assets/tiles/wideboi-live.mp4'
import pumpcontrolPoster from '../assets/tiles/pumpcontrol-poster.jpg'
import pumpcontrolLive from '../assets/tiles/pumpcontrol-live.mp4'
import kickforgePoster from '../assets/tiles/kickforge-poster.jpg'
import kickforgeLive from '../assets/tiles/kickforge-live.mp4'
import loudlabPoster from '../assets/tiles/loudlab-poster.jpg'

/** The real interface of each plug-in, as a still and, where we have one, a short loop. */
export interface TileArt {
  poster: string
  live?: string
  /** One or two words under the name on the Pro rows. */
  kind: string
}

const ART: Record<string, TileArt> = {
  analyser: { poster: analyserPoster, live: analyserLive, kind: 'Metering' },
  wettboi: { poster: wettboiPoster, live: wettboiLive, kind: 'Reverb and delay' },
  wideboi: { poster: wideboiPoster, live: wideboiLive, kind: 'Stereo width' },
  pumpcontrol: { poster: pumpcontrolPoster, live: pumpcontrolLive, kind: 'Volume shaping' },
  kickforge: { poster: kickforgePoster, live: kickforgeLive, kind: 'Synth' },
  loudlab: { poster: loudlabPoster, kind: 'Mastering' },
}

export function tileArt(slug: string): TileArt | null {
  const key = slug.replace(/^hardwave-/, '').toLowerCase()
  return ART[key] ?? null
}

/** "Hardwave Analyser" reads as "Analyser" on a tile. */
export function shortName(name: string): string {
  return name.replace(/^Hardwave\s+/i, '')
}

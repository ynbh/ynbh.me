/**
 * The director: track time in, a Look out.
 *
 * Every line of the page is a piece of geometry. The story:
 *   kick     lights down. Each kick sends a pulse of light down the page,
 *            line by line.
 *   fill     the lines start to bend with the waveform and glow with their
 *            own band of the spectrum; colour creeps in.
 *   build    the page tips back into a floor and slides under you; the lines
 *            rise off it as a 3D equalizer, higher every bar.
 *   silence  the floor snaps up and every line folds onto one live waveform
 *            trace. Two flashes open the page for a moment; 3 · 2 · 1 unfolds
 *            it a third at a time.
 *   drop     the page blows apart at the camera and springs back on the kick,
 *            then wraps into a tunnel of its own lines that flies past.
 *   outro    the tunnel unrolls, the lines land back where they live.
 */

import { BEAT, COUNTDOWN, FLASHES, actAt, actEnd, actStart } from './cues'
import { restingLook, type Look } from './stage'

const BAR = BEAT * 4

export type Cue = {
  t: number
  ox: number
  oy: number
  h: number
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
const easeInOut = (x: number) => {
  const k = clamp(x)
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}
/** A spring that starts at 1 and settles at 0 with one overshoot. */
const spring = (s: number, k = 7) => Math.exp(-s * k) * Math.cos(s * k * 1.6)

export class Director {
  reduced: boolean
  private landing: number | null = null
  private landFrom: Look | null = null

  constructor(reduced: boolean) {
    this.reduced = reduced
  }

  /** Start bringing every line home (stop or outro). */
  land(t: number) {
    if (this.landing === null) this.landing = t
  }

  look(c: Cue, wall: number): Look {
    const L = this.act(c)
    if (this.landing !== null) {
      // Ease every parameter back to rest over a bar.
      if (!this.landFrom) this.landFrom = { ...L }
      const k = easeInOut((wall - this.landing) / 1.6)
      const rest = restingLook()
      for (const key of Object.keys(rest) as (keyof Look)[]) {
        if (key === 'ox' || key === 'oy') continue
        const from = this.landFrom[key]
        L[key] = from + (rest[key] - from) * k
      }
      L.base = 0.85 + 0.15 * k
    }
    if (this.reduced) calm(L)
    return L
  }

  /** Seconds since landing began, or null. */
  landed(wall: number) {
    return this.landing === null ? null : wall - this.landing
  }

  private act(c: Cue): Look {
    const L = restingLook()
    const { t } = c
    L.ox = c.ox
    L.oy = c.oy
    const act = actAt(t)
    const n = Math.floor(t / BEAT + 0.02)
    const since = Math.max(0, t - n * BEAT)
    const kick = act === 'silence' ? 0 : Math.exp(-since / 0.12)
    const P = clamp((t - actStart(act)) / (actEnd(act) - actStart(act)))
    // The light pulse that runs down the page on each beat.
    const sweep = since / (BEAT * 0.8) * 1.3 - 0.15

    switch (act) {
      case 'kick': {
        L.base = 0.32
        L.sweep = sweep
        L.sweepAmp = 1.1
        L.trail = 0.35
        break
      }
      case 'fill': {
        L.base = 0.32 + 0.2 * P
        L.sweep = sweep
        L.sweepAmp = 0.9
        L.eqLight = 0.4 + 0.6 * P
        L.wave = 3 + 9 * P
        L.waveSpan = 1
        L.tintMix = 0.25 * P
        L.hue = Math.floor(n / 4) * 0.25
        L.trail = 0.35
        break
      }
      case 'build': {
        const s = t - actStart('build')
        const tip = easeInOut(s / (BAR * 3))
        L.tilt = 1.0 * tip
        L.push = s * 38
        L.eq = (60 + 260 * P) * tip
        L.eqLight = 0.9
        L.base = 0.28 + 0.2 * P + 0.15 * kick
        L.wave = 10 + 14 * P
        L.waveSpan = 1.5
        L.tintMix = 0.35 + 0.4 * P
        L.hue = Math.floor(n / 4) * 0.25
        L.trail = 0.3
        if (P > 0.82) {
          // The last two bars: the snare roll shakes the floor every eighth.
          L.jitter = 60 * P
          L.seed = Math.floor(t / (BEAT / 2))
        }
        break
      }
      case 'silence': {
        const s = t - actStart('silence')
        L.collapse = ease(s / 0.25)
        L.waveSpan = 1
        L.base = 1.1
        L.eqLight = 0
        L.trail = 0.55
        for (const f of FLASHES) {
          if (t >= f && t < f + 1.4) {
            const k = Math.exp(-(t - f) / 0.3)
            L.collapse = 1 - k
            L.flash = 0.6 * k
          }
        }
        COUNTDOWN.forEach(([time], i) => {
          if (t >= time) {
            const open = ease((t - time) / 0.25)
            L.collapse = 1 - (i + open) / 3.6
            L.tintMix = 0.7
            L.hue = i * 0.25
          }
        })
        // Folded, the lines are one big trace; unfolded, they only tremble.
        L.wave = 6 + 84 * L.collapse * L.collapse
        break
      }
      case 'drop':
      case 'outro': {
        const s = t - actStart('drop')
        const bar = Math.floor(s / BAR)
        L.base = 0.55 + 0.3 * kick
        L.eqLight = 0.8
        L.tintMix = 0.85
        L.hue = n * 0.25
        L.wave = 12 + 16 * kick
        L.waveSpan = 2
        L.eq = 120
        L.trail = 0.6
        // Blown apart on the downbeat of every bar, the hardest on the first.
        const sinceBar = s - bar * BAR
        L.explode = Math.max(0, spring(sinceBar, 4.5)) * (bar === 0 ? 1 : 0.55)
        L.seed = bar
        // The crash: one big flash.
        if (s < 0.6) L.flash = 0.8 * Math.exp(-s / 0.2)
        // Second half: the page wraps into a tunnel.
        const tunnelIn = easeInOut((s - BAR * 3) / BAR)
        if (tunnelIn > 0) {
          L.tunnel = tunnelIn
          L.tunnelZ = (s - BAR * 3) * 700 + n * 40
          L.roll = (s - BAR * 3) * 0.35
          L.explode *= 1 - tunnelIn
          L.trail = 0.72
        }
        break
      }
    }
    return L
  }
}

/** Reduced motion: the relighting stays, the geometry holds still. */
function calm(L: Look) {
  L.wave = 0
  L.eq = 0
  L.tilt = 0
  L.push = 0
  L.collapse = 0
  L.explode = 0
  L.tunnel = 0
  L.jitter = 0
  L.flash = 0
  L.trail = 0
  L.sweepAmp = 0
  L.base = Math.max(L.base, 0.6)
}

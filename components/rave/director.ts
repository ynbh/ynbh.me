/**
 * The director: track time in, a Look out.
 *
 * Every act is a different way of seeing the same page:
 *   kick     the lights are off; your cursor is a torch
 *   fill     the rows start to scratch, colour creeps into the torch
 *   build    the page resolves into an LED wall, sharper every bar
 *   silence  the picture switches off like an old TV; two flashes; 3 · 2 · 1
 *            opens it back up a third at a time
 *   drop     the page feeds back into itself, folding on the bars
 *   outro    the trails die and the house lights come up from the board
 */

import { BEAT, COUNTDOWN, FLASHES, PADS, actAt, actEnd, actStart } from './cues'
import { hexToRgb, restingLook, type Look } from './stage'

const BAR = BEAT * 4
const TINTS = PADS.map(hexToRgb)
const LIGHTS_MS = 900

export type Cue = {
  t: number
  now: number
  bass: number
  high: number
  w: number
  h: number
  pointer: { x: number; y: number } | null
  /** Where the torch rests when there is no pointer (the name). */
  rest: { x: number; y: number }
  anchor: { x: number; y: number }
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
const smooth = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a))
  return k * k * (3 - 2 * k)
}

type Hit = { pad: number; at: number }

export class Director {
  private lights: { dir: 1 | -1; at: number } | null = null
  private hits: Hit[] = []
  reduced: boolean

  constructor(reduced: boolean) {
    this.reduced = reduced
  }

  lightsDown(now: number) {
    this.lights = { dir: 1, at: now }
  }

  lightsUp(now: number) {
    this.lights = { dir: -1, at: now }
  }

  /** True once the house lights are fully back up. */
  done(now: number) {
    return this.lights?.dir === -1 && now - this.lights.at > LIGHTS_MS
  }

  pad(pad: number, now: number) {
    this.hits = [...this.hits.filter((h) => now - h.at < 1200), { pad, at: now }]
  }

  look(c: Cue): Look {
    const L = restingLook()
    const { t } = c
    const act = actAt(t)
    const n = Math.floor(t / BEAT + 0.02)
    const since = t - n * BEAT
    const kick = act === 'silence' ? 0 : Math.exp(-Math.max(0, since) / 0.11)
    const bar = Math.floor(n / 4)
    const P = clamp((t - actStart(act)) / (actEnd(act) - actStart(act)))
    const torchAt = c.pointer ?? {
      x: c.rest.x + Math.sin(t * 0.8) * 60,
      y: c.rest.y + Math.sin(t * 0.53) * 18,
    }

    L.stage = 1
    L.px = torchAt.x
    L.py = torchAt.y
    L.grain = 0.035
    L.tint = TINTS[bar % 4]

    switch (act) {
      case 'kick': {
        L.ambient = 0.045 + 0.05 * kick
        L.torch = 1
        L.torchR = 190 * (1 + 0.16 * kick)
        L.tintMix = 0
        L.ripple = since
        L.rippleX = torchAt.x
        L.rippleY = torchAt.y
        L.rippleAmp = 4
        break
      }
      case 'fill': {
        L.ambient = 0.07 + 0.3 * P + 0.1 * kick
        L.torch = 1 - 0.35 * P
        L.torchR = 200 * (1 + 0.14 * kick)
        L.tintMix = 0.15 * P
        if (n % 2 === 1) {
          // The snare scratches the rows and splits the colour, then lets go.
          L.slice = 24 * Math.exp(-since / 0.15)
          L.rgb = 3 * Math.exp(-since / 0.1)
          L.seed = n
        }
        if (n % 4 === 0) {
          L.ripple = since
          L.rippleX = torchAt.x
          L.rippleY = torchAt.y
          L.rippleAmp = 6
        }
        break
      }
      case 'build': {
        // The wall gets sharper one notch per bar: 18px dots down to 5px.
        const barsIn = Math.floor((t - actStart('build')) / BAR)
        const steps = Math.ceil((actEnd('build') - actStart('build')) / BAR)
        L.dots = 1
        L.cell = Math.round(18 - (13 * barsIn) / Math.max(1, steps - 1))
        L.ambient = (0.5 + 0.5 * P) * (0.8 + 0.2 * kick)
        L.torch = clamp(0.7 - P * 3)
        L.tintMix = 0.3 + 0.45 * P
        L.zoom = 1 + 0.05 * P + 0.008 * kick
        L.rgb = 3 * P * c.high
        if (P > 0.82) {
          // The last two bars: the snare roll scratches every eighth.
          const e = Math.floor(t / (BEAT / 2))
          L.slice = 18 * P * Math.exp(-(t - e * (BEAT / 2)) / 0.08)
          L.seed = e
        }
        break
      }
      case 'silence': {
        const s = t - actStart('silence')
        // Off like a CRT: collapse to a line, the line fades.
        L.squash = ease(s / 0.2)
        L.ambient = 1 - clamp((s - 0.22) / 0.5)
        L.tintMix = 0
        L.grain = 0.02
        // Power cut. After a beat of pitch black, the torch finds the page again.
        if (s > 1.2) {
          L.squash = 0
          L.ambient = 0
          L.torch = 0.85 * smooth(1.2, 2.2, s)
          L.torchR = 160
        }
        for (const f of FLASHES) {
          if (t >= f && t < f + 1.2) {
            const k = Math.exp(-(t - f) / 0.22)
            L.squash = 0
            L.ambient = 0
            L.flash = k
          }
        }
        let k = 0
        let at = 0
        COUNTDOWN.forEach(([time], i) => {
          if (t >= time) {
            k = i + 1
            at = time
          }
        })
        if (k) {
          const open = ease((t - at) / 0.22)
          L.squash = 0
          L.band = ((k - 1) + open) / 3
          L.dots = 1
          L.cell = 6
          L.ambient = 0.95
          L.tint = TINTS[k - 1]
          L.tintMix = 0.75
        }
        break
      }
      case 'drop':
      case 'outro': {
        const s = t - actStart('drop')
        const tail = act === 'outro' ? clamp(1 - (t - actStart('outro')) / 2.2) : 1
        L.ambient = 1
        L.tint = TINTS[n % 4]
        L.tintMix = 0.8 * tail
        L.feedback = 0.86 * tail
        L.zoom = 1 + 0.035 * kick * tail
        L.rgb = (1.5 + 6 * c.high + 3 * kick) * tail
        L.grain = 0.045
        // The page folds into a kaleidoscope for one bar out of three.
        const fold = [0, 0, 6, 0, 0, 8, 0][Math.floor(s / BAR)] ?? 0
        L.kaleido = act === 'outro' ? 0 : fold
        if (n % 2 === 1 && act === 'drop') {
          L.slice = 10 * Math.exp(-since / 0.12)
          L.seed = n
        }
        if (n % 4 === 0) {
          L.ripple = since
          L.rippleX = c.w / 2
          L.rippleY = c.h / 2
          L.rippleAmp = 16 * tail
        }
        // The crash on the downbeat of the drop.
        if (s < 0.6) L.flash = 0.55 * Math.exp(-s / 0.18)
        break
      }
    }

    this.applyHits(L, c)
    this.applyLights(L, c)
    if (this.reduced) calm(L)
    return L
  }

  /** Pads during the set: 1 flash, 2 scratch, 3 ripple, 4 fold. */
  private applyHits(L: Look, c: Cue) {
    for (const h of this.hits) {
      const ms = c.now - h.at
      if (ms < 0) continue
      if (h.pad === 0) L.flash = Math.max(L.flash, 0.45 * Math.exp(-ms / 140))
      if (h.pad === 1 && ms < 400) {
        L.slice = Math.max(L.slice, 46 * Math.exp(-ms / 120))
        L.seed = h.at
      }
      if (h.pad === 2 && ms < 1400) {
        L.ripple = ms / 1000
        L.rippleX = c.anchor.x
        L.rippleY = c.anchor.y
        L.rippleAmp = 20
      }
      if (h.pad === 3 && ms < BEAT * 1000 * 2) L.kaleido = 6
      if (ms < 300) {
        L.tint = TINTS[h.pad]
        L.tintMix = Math.max(L.tintMix, 0.8)
      }
    }
  }

  private applyLights(L: Look, c: Cue) {
    const far = Math.hypot(Math.max(c.anchor.x, c.w - c.anchor.x), Math.max(c.anchor.y, c.h - c.anchor.y))
    L.irisX = c.anchor.x
    L.irisY = c.anchor.y
    if (!this.lights) {
      L.stage = 0
      return
    }
    const p = (c.now - this.lights.at) / LIGHTS_MS
    L.irisDir = this.lights.dir
    L.irisR = (this.reduced ? (p > 0.5 ? 1 : 0) : ease(p)) * (far + 120)
  }
}

/** Reduced motion: the relighting stays, nothing moves or strobes. */
function calm(L: Look) {
  L.slice = 0
  L.ripple = -1
  L.zoom = 1
  L.kaleido = 0
  L.feedback = 0
  L.squash = 0
  L.flash = 0
  L.rgb = 0
  L.grain = 0
  L.ambient = Math.max(L.ambient, 0.35)
}


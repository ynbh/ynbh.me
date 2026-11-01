'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import cn from 'clsx'

import {
  BEAT,
  COUNTDOWN,
  END,
  FLASHES,
  PADS,
  TRACK,
  actAt,
  actEnd,
  actStart,
  type Act,
} from './cues'
import './rave.css'

type Phase = 'idle' | 'armed' | 'loading' | 'playing' | 'ending'

const HAZE_BANDS = 32
const SOUVENIR_KEY = 'ynbh:rave-souvenir'
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

/* ------------------------------------------------------------------ */
/* Little synthesized sounds, so the egg ships with one audio file.    */
/* ------------------------------------------------------------------ */

function padClick(ctx: AudioContext, out: AudioNode) {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.frequency.setValueAtTime(1800, t)
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.03)
  g.gain.setValueAtTime(0.12, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + 0.05)
}

/** Needle drop: a soft thunk and half a second of vinyl crackle. */
function needleDrop(ctx: AudioContext, out: AudioNode, seconds = 0.6) {
  const t = ctx.currentTime
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const hiss = (Math.random() * 2 - 1) * 0.012
    const pop = Math.random() < 0.0018 ? (Math.random() * 2 - 1) * 0.5 : 0
    d[i] = hiss + pop
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 900
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.9, t)
  g.gain.linearRampToValueAtTime(0.0001, t + seconds)
  src.connect(hp).connect(g).connect(out)
  src.start(t)

  const thunk = ctx.createOscillator()
  const tg = ctx.createGain()
  thunk.frequency.setValueAtTime(90, t)
  thunk.frequency.exponentialRampToValueAtTime(40, t + 0.12)
  tg.gain.setValueAtTime(0.35, t)
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
  thunk.connect(tg).connect(out)
  thunk.start(t)
  thunk.stop(t + 0.16)
}

/* ------------------------------------------------------------------ */

function setFlag(name: string, on: boolean) {
  const el = document.documentElement
  if (on) el.setAttribute(name, '')
  else el.removeAttribute(name)
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function withViewTransition(update: () => void, wipe: 'down' | 'up', x: number, y: number) {
  const root = document.documentElement
  const start: ((cb: () => void) => { finished: Promise<void> }) | undefined = (
    document as any
  ).startViewTransition?.bind(document)
  if (!start || prefersReducedMotion()) {
    update()
    return
  }
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  root.style.setProperty('--wipe-x', `${x}px`)
  root.style.setProperty('--wipe-y', `${y}px`)
  root.style.setProperty('--wipe-r', `${r}px`)
  root.setAttribute('data-rave-wipe', wipe)
  const vt = start(update)
  vt.finished.finally(() => root.removeAttribute('data-rave-wipe'))
}

/** Put every page element back the way the set found it. */
function resetPage() {
  const root = document.documentElement
  ;['data-rave-act', 'data-rave-labels', 'data-rave-meters', 'data-rave-crowd'].forEach((a) =>
    root.removeAttribute(a)
  )
  root.style.removeProperty('--build')
  document.querySelectorAll<HTMLElement>('[data-rave-name]').forEach((el) => {
    el.style.letterSpacing = ''
  })
  document.querySelectorAll<HTMLElement>('[data-rave-logo]').forEach((el) => {
    el.style.rotate = ''
  })
  document.querySelectorAll<HTMLElement>('[data-rave-label], [data-rave-meter]').forEach((el) => {
    el.style.removeProperty('--rave-c')
  })
}

function formatTime(t: number) {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function Rave() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [screen, setScreen] = useState('Ready')
  const [lit, setLit] = useState<number[]>([])
  const [booted, setBooted] = useState(0)
  const [pill, setPill] = useState(false)
  const [mounted, setMounted] = useState(false)

  const phaseRef = useRef<Phase>('idle')
  const sticky = useRef(false) // armed by click / long-press rather than a held key
  const entering = useRef(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const hazeRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const spotRef = useRef<HTMLDivElement>(null)
  const neonRef = useRef<HTMLDivElement>(null)
  const crowdRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)

  const audio = useRef<HTMLAudioElement | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const master = useRef<GainNode | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const raf = useRef(0)
  const lastFlash = useRef(0)
  const anchor = useRef({ x: 0, y: 0 })

  const go = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  useEffect(() => {
    setMounted(true)
    try {
      if (localStorage.getItem(SOUVENIR_KEY)) setFlag('data-rave-souvenir', true)
    } catch {}
  }, [])

  /* ---------------- Board placement: it lives where the record lives. ---------------- */

  const place = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const record = document.querySelector<HTMLElement>('[data-rave-record]')
    const r = record?.getBoundingClientRect()
    const W = 216
    const H = board.offsetHeight || 120
    const visible = r && r.top > H + 24 && r.bottom < innerHeight && r.right > 0
    let left: number
    let top: number
    let ox: number
    let oy: number
    if (r && visible) {
      left = Math.min(Math.max(16, r.right - W + 4), innerWidth - W - 16)
      top = r.top - H - 14
      ox = r.left + r.width / 2 - left
      oy = r.top + r.height / 2 - top
    } else {
      left = innerWidth - W - 20
      top = innerHeight - H - 20
      ox = W / 2
      oy = H + 40
    }
    board.style.left = `${left}px`
    board.style.top = `${top}px`
    board.style.setProperty('--origin-x', `${ox}px`)
    board.style.setProperty('--origin-y', `${oy}px`)
    anchor.current = { x: left + W / 2, y: top + H / 2 }
  }, [])

  /* ---------------- Arm / disarm ---------------- */

  const arm = useCallback(
    (isSticky: boolean) => {
      if (phaseRef.current !== 'idle') return
      sticky.current = isSticky
      if (!audio.current) {
        const a = new Audio(TRACK.src)
        a.preload = 'auto'
        a.crossOrigin = 'anonymous'
        audio.current = a
      }
      setScreen('Ready')
      setLit([])
      setBooted(0)
      entering.current = true
      go('armed')
      document.documentElement.setAttribute('data-rave', 'armed')
      // The pads boot one by one, like a controller powering on.
      ;[1, 2, 3, 4].forEach((n) => setTimeout(() => {
        if (phaseRef.current === 'armed') setBooted(n)
      }, 180 + n * 60))
    },
    [go]
  )

  // Once the board is in the DOM: put it where the record is and lift it out.
  useLayoutEffect(() => {
    if (phase !== 'armed' || !entering.current) return
    entering.current = false
    place()
    boardRef.current?.animate(
      prefersReducedMotion()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: 'scale(0.12)', filter: 'blur(4px)' },
            { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' },
          ],
      { duration: 380, easing: EASE_OUT, fill: 'both' }
    )
  }, [phase, place])

  const disarm = useCallback(() => {
    if (phaseRef.current !== 'armed') return
    const board = boardRef.current
    const finish = () => {
      if (phaseRef.current !== 'armed') return
      go('idle')
      document.documentElement.removeAttribute('data-rave')
    }
    if (!board) return finish()
    board
      .animate(
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(0.12)' },
        ],
        { duration: 200, easing: EASE_OUT, fill: 'both' }
      )
      .finished.then(finish, finish)
  }, [go])

  /* ---------------- The show ---------------- */

  const teardown = useCallback(() => {
    cancelAnimationFrame(raf.current)
    resetPage()
    document.documentElement.removeAttribute('data-rave')
    setPill(false)
    setLit([])
    go('idle')
  }, [go])

  const lightsUp = useCallback(
    (fast: boolean) => {
      if (phaseRef.current !== 'playing') return
      go('ending')
      const a = audio.current
      const c = ctx.current
      const g = master.current
      if (fast && c && g) {
        g.gain.cancelScheduledValues(c.currentTime)
        g.gain.setValueAtTime(g.gain.value, c.currentTime)
        g.gain.linearRampToValueAtTime(0, c.currentTime + 0.4)
        setTimeout(() => a?.pause(), 420)
      }
      // Rows settle back in reverse order.
      if (!prefersReducedMotion()) {
        const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-rave-row]')).reverse()
        rows.forEach((row, i) =>
          row.animate(
            [{ transform: 'translateY(4px)', opacity: 0.6 }, { transform: 'none', opacity: 1 }],
            { duration: 320, delay: 300 + i * 40, easing: EASE_OUT, fill: 'backwards' }
          )
        )
      }
      const { x, y } = anchor.current
      setPill(false)
      withViewTransition(() => {
        resetPage()
        document.documentElement.setAttribute('data-rave', 'ending')
      }, 'up', x, y)

      setScreen('Thanks')
      setLit([])
      const board = boardRef.current
      const home = () => {
        if (!fast && audio.current && !audio.current.paused) {
          // Let the tail of the track fade out on its own, then put the board away.
          audio.current.addEventListener('ended', () => teardown(), { once: true })
        } else teardown()
      }
      setTimeout(() => {
        if (!board) return home()
        board
          .animate(
            [
              { opacity: 1, transform: 'scale(1)' },
              { opacity: 0, transform: 'scale(0.12)' },
            ],
            { duration: 320, easing: EASE_OUT, fill: 'both' }
          )
          .finished.then(home, home)
      }, fast ? 450 : 1400)
    },
    [go, teardown]
  )

  const run = useCallback(() => {
    const a = audio.current!
    const reduced = prefersReducedMotion()
    const root = document.documentElement
    const content = document.querySelector<HTMLElement>('[data-rave-content]')
    const name = document.querySelector<HTMLElement>('[data-rave-name]')
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-rave-row]'))
    const logos = Array.from(document.querySelectorAll<HTMLElement>('[data-rave-logo]'))
    const labels = Array.from(document.querySelectorAll<HTMLElement>('[data-rave-label]'))
    const meters = Array.from(document.querySelectorAll<HTMLElement>('[data-rave-meter]'))
    const meterBars = meters.map((m) => Array.from(m.querySelectorAll<HTMLElement>('.rave-meter i')))
    const haze = Array.from(hazeRef.current?.children ?? []) as HTMLElement[]
    const crowd = crowdRef.current
    const neon = neonRef.current
    const spot = spotRef.current
    const back = backRef.current
    const count = countRef.current

    labels.forEach((el, i) => el.style.setProperty('--rave-c', PADS[i % 4]))
    meters.forEach((el, i) => el.style.setProperty('--rave-c', PADS[(i + 2) % 4]))

    const an = analyser.current!
    const bins = new Uint8Array(an.frequencyBinCount)
    const hz = (ctx.current?.sampleRate ?? 44100) / an.fftSize
    const bandEdges = Array.from({ length: HAZE_BANDS + 1 }, (_, i) =>
      Math.max(1, Math.round((40 * Math.pow(12000 / 40, i / HAZE_BANDS)) / hz))
    )

    let act: Act | null = null
    let beat = -1
    let flashIdx = 0
    let countIdx = 0
    let joined = 0
    let lastSpacing = ''
    const latency = (ctx.current?.outputLatency || 0) + (ctx.current?.baseLatency || 0)

    const thump = (scale: number) => {
      if (reduced || !content) return
      content.animate([{ transform: `scale(${scale})` }, { transform: 'scale(1)' }], {
        duration: 140,
        easing: EASE_OUT,
      })
    }

    const onBeat = (n: number, a: Act) => {
      const inBar = n % 4
      if (a === 'kick' || a === 'fill') thump(1.004)
      if (a === 'fill' && inBar === 0) {
        // One element joins the set per bar, never two at once.
        joined++
        if (joined === 1) setFlag('data-rave-labels', true)
        if (joined === 3) setFlag('data-rave-meters', true)
        if (joined === 4) setFlag('data-rave-crowd', true)
      }
      if (joined >= 2 && !reduced && a !== 'silence') {
        logos.forEach((el, i) => {
          el.style.rotate = `${(n + i) % 2 ? 9 : -9}deg`
        })
      }
      if (a === 'build') {
        setLit(inBar === 0 ? [Math.floor(n / 4) % 4] : [])
      }
      if (a === 'drop') {
        setLit([n % 4])
        if (!reduced) {
          rows.forEach((row, i) =>
            row.animate(
              [{ transform: 'none' }, { transform: 'translateY(-3px)' }, { transform: 'none' }],
              { duration: 280, delay: i * 30, easing: EASE_OUT }
            )
          )
          crowd?.firstElementChild?.animate(
            [{ transform: 'none' }, { transform: 'translateY(-10px)' }, { transform: 'translateY(1px)' }, { transform: 'none' }],
            { duration: 420, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' }
          )
          neon?.animate([{ scale: '1.025' }, { scale: '1' }], { duration: 300, easing: EASE_OUT })
        }
      }
    }

    const enterAct = (next: Act) => {
      act = next
      root.setAttribute('data-rave-act', next)
      if (next === 'kick') setScreen(`${TRACK.title} — ${TRACK.artist}`)
      if (next === 'build') {
        // Catch-up if someone scrubbed past the fill.
        setFlag('data-rave-labels', true)
        setFlag('data-rave-meters', true)
        setFlag('data-rave-crowd', true)
        joined = Math.max(joined, 4)
      }
      if (next === 'silence') {
        setScreen('· · ·')
        setLit([])
      }
      if (next === 'drop') {
        setScreen('129 BPM')
        if (count) count.style.opacity = '0'
        if (name) name.style.letterSpacing = ''
        lastSpacing = ''
        try {
          localStorage.setItem(SOUVENIR_KEY, '1')
        } catch {}
        setFlag('data-rave-souvenir', true)
      }
      if (next === 'outro') lightsUp(false)
    }

    const frame = () => {
      raf.current = requestAnimationFrame(frame)
      if (phaseRef.current !== 'playing') return
      const t = Math.max(0, a.currentTime - latency)

      const nextAct = actAt(t)
      if (nextAct !== act) enterAct(nextAct)
      if (phaseRef.current !== 'playing') return

      const n = Math.floor(t / BEAT + 0.02)
      if (n !== beat) {
        beat = n
        onBeat(n, act!)
      }

      if (timeRef.current) timeRef.current.textContent = formatTime(t)

      // Spectrum → haze and meters.
      an.getByteFrequencyData(bins)
      const level = (lo: number, hi: number) => {
        let s = 0
        for (let i = lo; i < hi; i++) s += bins[i]
        return s / Math.max(1, hi - lo) / 255
      }
      if (act === 'build' || act === 'drop' || act === 'outro') {
        for (let i = 0; i < haze.length; i++) {
          const v = level(bandEdges[i], Math.max(bandEdges[i] + 1, bandEdges[i + 1]))
          haze[i].style.transform = `scaleY(${(0.06 + v * v * 1.1).toFixed(3)})`
        }
      }
      if (joined >= 3 && act !== 'silence') {
        meterBars.forEach((bars, m) =>
          bars.forEach((bar, j) => {
            const b = 2 + ((m * 5 + j * 7) % 24)
            const v = level(bandEdges[b], bandEdges[b + 1] + 1)
            bar.style.transform = `scaleY(${Math.max(0.12, Math.min(1, v * 1.25)).toFixed(3)})`
          })
        )
      }

      // The build: tension rises, the name stretches with the riser.
      if (act === 'build') {
        const p = (t - actStart('build')) / (actEnd('build') - actStart('build'))
        back?.style.setProperty('--build', p.toFixed(3))
        root.style.setProperty('--build', p.toFixed(3))
        const spacing = `${(p * 0.12).toFixed(3)}em`
        if (name && spacing !== lastSpacing && !reduced) {
          name.style.letterSpacing = spacing
          lastSpacing = spacing
        }
      }

      // The spotlight drifts, lagging a little behind the name.
      if (spot && name && (act === 'kick' || act === 'fill' || act === 'build')) {
        const r = name.getBoundingClientRect()
        const drift = reduced ? 0 : Math.sin(t * 0.7) * 24
        spot.style.transform = `translate(${r.left + r.width / 2 + drift}px, ${r.top + r.height / 2}px)`
      }

      // Silence: two flashes in the dark, then 3 · 2 · 1.
      if (act === 'silence') {
        while (flashIdx < FLASHES.length && t >= FLASHES[flashIdx]) {
          flashIdx++
          if (!reduced && content) {
            content.animate([{ opacity: 0.22 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' })
            setLit([0, 1, 2, 3])
            setTimeout(() => setLit([]), 160)
          }
        }
        while (countIdx < COUNTDOWN.length && t >= COUNTDOWN[countIdx][0]) {
          const label = COUNTDOWN[countIdx][1]
          countIdx++
          setScreen(label)
          setLit([3 - countIdx])
          if (count) {
            count.textContent = COUNTDOWN.slice(0, countIdx).map(([, l]) => l).join(' · ')
            count.style.opacity = '1'
            if (!reduced)
              count.animate([{ scale: '1.25', opacity: 0 }, { scale: '1', opacity: 1 }], {
                duration: 220,
                easing: EASE_OUT,
              })
          }
        }
      }

      if (t >= END || a.ended) {
        if (phaseRef.current === 'playing') lightsUp(false)
      }
    }

    frame()
  }, [lightsUp])

  const start = useCallback(
    (pad: number) => {
      if (phaseRef.current !== 'armed') return
      const a = audio.current
      if (!a) return
      sticky.current = true

      // Audio graph, created inside the gesture.
      if (!ctx.current) {
        const C = window.AudioContext || (window as any).webkitAudioContext
        const c: AudioContext = new C({ latencyHint: 'interactive' })
        const src = c.createMediaElementSource(a)
        const g = c.createGain()
        const an = c.createAnalyser()
        an.fftSize = 1024
        an.smoothingTimeConstant = 0.78
        src.connect(g)
        g.connect(an)
        an.connect(c.destination)
        ctx.current = c
        master.current = g
        analyser.current = an
      }
      const c = ctx.current!
      c.resume()
      master.current!.gain.cancelScheduledValues(c.currentTime)
      master.current!.gain.setValueAtTime(1, c.currentTime)
      padClick(c, c.destination)

      // Unlock the element inside the gesture (iOS), then rewind for the real start.
      a.currentTime = 0
      const unlock = a.play()
      unlock?.then(() => {
        a.pause()
        a.currentTime = 0
      }).catch(() => {})

      setLit([pad])
      setScreen('Loading')
      go('loading')

      const begin = () => {
        if (phaseRef.current !== 'loading') return
        needleDrop(c, c.destination)
        setScreen('Needle drop')
        const { x, y } = anchor.current
        withViewTransition(() => {
          document.documentElement.setAttribute('data-rave', 'playing')
          go('playing')
        }, 'down', x, y)
        setTimeout(() => {
          if (phaseRef.current !== 'playing') return
          a.currentTime = 0
          a.play().then(() => {
            run()
            setTimeout(() => {
              if (phaseRef.current === 'playing') setPill(true)
            }, BEAT * 4 * 1000)
          }, () => teardown())
        }, 560)
      }

      if (a.readyState >= 3) begin()
      else {
        a.addEventListener('canplaythrough', begin, { once: true })
        a.addEventListener(
          'error',
          () => {
            setScreen('No disc')
            go('armed')
          },
          { once: true }
        )
        a.load()
      }
    },
    [go, run, teardown]
  )

  /** Pads during the set: colour hits, capped at 3 per second. */
  const fx = useCallback((pad: number) => {
    const now = performance.now()
    if (now - lastFlash.current < 333 || prefersReducedMotion()) return
    lastFlash.current = now
    const el = flashRef.current
    if (!el) return
    el.style.setProperty('--flash', PADS[pad])
    el.style.setProperty('--fx', `${anchor.current.x}px`)
    el.style.setProperty('--fy', `${anchor.current.y}px`)
    el.animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: 420, easing: EASE_OUT })
    if (ctx.current) padClick(ctx.current, ctx.current.destination)
  }, [])

  const press = useCallback(
    (pad: number) => {
      if (phaseRef.current === 'armed') start(pad)
      else if (phaseRef.current === 'playing') fx(pad)
    },
    [fx, start]
  )

  /* ---------------- Input ---------------- */

  useEffect(() => {
    const isAlt = (e: KeyboardEvent) => e.key === 'Alt' || e.key === 'AltGraph'

    const onKeyDown = (e: KeyboardEvent) => {
      if (isAlt(e) && !e.repeat && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (phaseRef.current === 'idle') {
          e.preventDefault()
          arm(false)
        }
        return
      }
      if (e.key === 'Escape') {
        if (phaseRef.current === 'playing') lightsUp(true)
        else if (phaseRef.current === 'armed') disarm()
        return
      }
      // While the board is out, 1–4 hit the pads.
      if ((phaseRef.current === 'armed' || phaseRef.current === 'playing') && /^Digit[1-4]$/.test(e.code)) {
        e.preventDefault()
        press(Number(e.code.slice(5)) - 1)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (isAlt(e) && phaseRef.current === 'armed' && !sticky.current) disarm()
    }

    // Losing focus while holding Alt never delivers the keyup.
    const onBlur = () => {
      if (phaseRef.current === 'armed' && !sticky.current) disarm()
    }

    // The record glyph: click to toggle, long-press on touch.
    let pressTimer = 0
    let swallowClick = false
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-rave-record]')) {
        if (e.pointerType !== 'mouse') {
          pressTimer = window.setTimeout(() => {
            arm(true)
            // The click that ends a long-press must not toggle the board straight back off.
            swallowClick = true
          }, 420)
        }
        return
      }
      if (phaseRef.current === 'armed' && sticky.current && !target.closest('.rave-board')) disarm()
    }
    const onPointerUp = () => clearTimeout(pressTimer)
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-rave-record]')) return
      if (swallowClick) {
        swallowClick = false
        return
      }
      if (phaseRef.current === 'idle') arm(true)
      else if (phaseRef.current === 'armed') disarm()
    }
    const onResize = () => {
      if (phaseRef.current !== 'idle') place()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
    }
  }, [arm, disarm, lightsUp, place, press])

  // Pause the set if the tab is hidden, pick it back up when it returns.
  useEffect(() => {
    const onVis = () => {
      const a = audio.current
      if (!a || phaseRef.current !== 'playing') return
      if (document.hidden) a.pause()
      else a.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(raf.current)
    audio.current?.pause()
    ctx.current?.close()
  }, [])

  if (!mounted) return null

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const showBoard = phase !== 'idle'
  const playing = phase === 'playing' || phase === 'ending'

  return (
    <>
      <div ref={backRef} className='rave-back' aria-hidden>
        <div ref={spotRef} className='rave-spot' />
        <div ref={neonRef} className='rave-neon'>YASHAS</div>
        <div ref={hazeRef} className='rave-haze'>
          {Array.from({ length: HAZE_BANDS }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </div>

      <div className='rave-front' aria-hidden>
        <div className='rave-beams'>
          <i />
          <i />
          <i />
          <i />
        </div>
        <svg className='rave-lasers' viewBox='0 0 100 100' preserveAspectRatio='none'>
          <g>
            {[
              [PADS[2], 8],
              [PADS[0], 32],
            ].map(([c, x]) => (
              <g key={x as number}>
                <line x1='50' y1='0' x2={x as number} y2='100' stroke={c as string} strokeOpacity='.25' strokeWidth='1.2' vectorEffect='non-scaling-stroke' style={{ strokeWidth: 6 }} />
                <line x1='50' y1='0' x2={x as number} y2='100' stroke={c as string} strokeWidth='1.2' vectorEffect='non-scaling-stroke' />
              </g>
            ))}
          </g>
          <g>
            {[
              [PADS[1], 92],
              [PADS[3], 68],
            ].map(([c, x]) => (
              <g key={x as number}>
                <line x1='50' y1='0' x2={x as number} y2='100' stroke={c as string} strokeOpacity='.25' vectorEffect='non-scaling-stroke' style={{ strokeWidth: 6 }} />
                <line x1='50' y1='0' x2={x as number} y2='100' stroke={c as string} strokeWidth='1.2' vectorEffect='non-scaling-stroke' />
              </g>
            ))}
          </g>
        </svg>
        <div ref={crowdRef} className='rave-crowd'>
          <svg viewBox='0 0 1200 92' preserveAspectRatio='xMidYMax slice'>
            <defs>
              <pattern id='rave-down' width='72' height='92' patternUnits='userSpaceOnUse'>
                <circle cx='12' cy='50' r='9' fill='currentColor' />
                <path d='M-2 92 C-2 64 26 64 26 92Z' fill='currentColor' />
                <circle cx='38' cy='44' r='10' fill='currentColor' />
                <path d='M22 92 C22 58 54 58 54 92Z' fill='currentColor' />
                <circle cx='62' cy='54' r='8.5' fill='currentColor' />
                <path d='M49 92 C49 68 75 68 75 92Z' fill='currentColor' />
              </pattern>
              <pattern id='rave-up' width='72' height='92' patternUnits='userSpaceOnUse'>
                <circle cx='12' cy='46' r='9' fill='currentColor' />
                <path d='M-2 92 C-2 60 26 60 26 92Z' fill='currentColor' />
                <path d='M3 66 L-3 22 M21 66 L28 20' stroke='currentColor' strokeWidth='5' strokeLinecap='round' />
                <circle cx='38' cy='40' r='10' fill='currentColor' />
                <path d='M22 92 C22 54 54 54 54 92Z' fill='currentColor' />
                <circle cx='62' cy='50' r='8.5' fill='currentColor' />
                <path d='M49 92 C49 64 75 64 75 92Z' fill='currentColor' />
                <path d='M55 70 L50 30 M69 70 L76 28' stroke='currentColor' strokeWidth='5' strokeLinecap='round' />
              </pattern>
            </defs>
            <g>
              <rect className='down' width='1200' height='92' fill='url(#rave-down)' />
              <rect className='up' width='1200' height='92' fill='url(#rave-up)' />
            </g>
          </svg>
        </div>
        <div ref={countRef} className='rave-count' />
        <div ref={flashRef} className='rave-flash' />
      </div>

      {showBoard && (
        <div
          ref={boardRef}
          className='rave-board'
          data-phase={phase}
          role='group'
          aria-label='Pad board'
          style={{ top: -9999, left: -9999 }}
        >
          <div className='rave-screen' data-on={playing || phase === 'loading' ? '' : undefined}>
            <span className='truncate'>{screen}</span>
            {playing && <span ref={timeRef} className='time'>0:00</span>}
          </div>
          <div className='rave-pads'>
            {PADS.map((_, i) => (
              <button
                key={i}
                type='button'
                className='rave-pad'
                aria-label={phase === 'armed' ? `Play, pad ${i + 1}` : `Pad ${i + 1}`}
                data-dim={booted > i ? '' : undefined}
                data-lit={lit.includes(i) ? '' : undefined}
                onPointerDown={(e) => {
                  e.preventDefault()
                  press(i)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    press(i)
                  }
                }}
              />
            ))}
          </div>
          <div className={cn('rave-caption')}>
            {phase === 'armed'
              ? 'press play'
              : phase === 'loading'
                ? 'cueing…'
                : coarse
                  ? 'tap stop to end'
                  : 'esc to stop'}
          </div>
        </div>
      )}

      <div className='rave-pill' data-show={pill ? '' : undefined} role='status'>
        <span className='dot' />
        <span>
          {TRACK.title} — {TRACK.artist}
        </span>
        <button type='button' className='press' onClick={() => lightsUp(true)} aria-label='Stop the set'>
          stop
        </button>
      </div>
    </>
  )
}

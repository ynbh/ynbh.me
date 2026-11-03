'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { BEAT, COUNTDOWN, END, FLASHES, PADS, TRACK, actAt } from './cues'
import { Director } from './director'
import { createPageSource, type PageSource } from './page-source'
import { Stage } from './stage'
import './rave.css'

type Phase = 'idle' | 'armed' | 'loading' | 'playing' | 'ending'

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

function formatTime(t: number) {
  const s = Math.max(0, Math.floor(t))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type Show = {
  stage: Stage
  source: PageSource
  director: Director
  onResize: () => void
  onPointer: (e: PointerEvent) => void
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

  const audio = useRef<HTMLAudioElement | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const master = useRef<GainNode | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const raf = useRef(0)
  const lastHit = useRef(0)
  const anchor = useRef({ x: 0, y: 0 })
  const show = useRef<Show | null>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)

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
      ;[1, 2, 3, 4].forEach((n) =>
        setTimeout(() => {
          if (phaseRef.current === 'armed') setBooted(n)
        }, 180 + n * 60)
      )
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

  /* ---------------- The stage ---------------- */

  const openStage = useCallback((): Show | null => {
    const content = document.querySelector<HTMLElement>('[data-rave-content]')
    if (!content) return null
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#fff'
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const stage = Stage.create(paper, dpr)
    if (!stage) return null
    const source = createPageSource(content, dpr)
    const director = new Director(prefersReducedMotion())
    const onResize = () => {
      stage.resize()
      source.resize()
    }
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') pointer.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.documentElement.setAttribute('data-rave-stage', source.live ? 'live' : 'raster')
    return { stage, source, director, onResize, onPointer }
  }, [])

  const closeStage = useCallback(() => {
    const s = show.current
    show.current = null
    if (!s) return
    window.removeEventListener('resize', s.onResize)
    window.removeEventListener('pointermove', s.onPointer)
    s.stage.destroy()
    s.source.destroy()
    document.documentElement.removeAttribute('data-rave-stage')
  }, [])

  const teardown = useCallback(() => {
    cancelAnimationFrame(raf.current)
    closeStage()
    document.documentElement.removeAttribute('data-rave')
    setPill(false)
    setLit([])
    go('idle')
  }, [closeStage, go])

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
      show.current?.director.lightsUp(performance.now())
      setPill(false)
      setScreen('Thanks')
      setLit([])
    },
    [go]
  )

  /** Called by the frame loop once the house lights are fully up. */
  const putAway = useCallback(() => {
    cancelAnimationFrame(raf.current)
    closeStage()
    document.documentElement.setAttribute('data-rave', 'ending')
    const board = boardRef.current
    const home = () => {
      const a = audio.current
      // Let the tail of the track ring out on its own, then put the board away.
      if (a && !a.paused && !a.ended) a.addEventListener('ended', () => teardown(), { once: true })
      else teardown()
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
    }, 400)
  }, [closeStage, teardown])

  const run = useCallback(() => {
    const a = audio.current!
    const s = show.current
    const an = analyser.current!
    const bins = new Uint8Array(an.frequencyBinCount)
    const hz = (ctx.current?.sampleRate ?? 44100) / an.fftSize
    const bassHi = Math.max(2, Math.round(150 / hz))
    const highLo = Math.round(6000 / hz)
    const highHi = Math.min(bins.length, Math.round(14000 / hz))
    const latency = (ctx.current?.outputLatency || 0) + (ctx.current?.baseLatency || 0)
    const name = document.querySelector<HTMLElement>('[data-rave-name]')

    let beat = -1
    let lastAct = ''
    let countIdx = 0
    let bass = 0
    let high = 0

    const level = (lo: number, hi: number) => {
      let sum = 0
      for (let i = lo; i < hi; i++) sum += bins[i]
      return sum / Math.max(1, hi - lo) / 255
    }

    const frame = () => {
      raf.current = requestAnimationFrame(frame)
      const now = performance.now()
      const t = phaseRef.current === 'loading' ? 0 : Math.max(0, a.currentTime - latency)
      const act = actAt(t)

      if (phaseRef.current === 'playing') {
        if (act !== lastAct) {
          lastAct = act
          if (act === 'kick') setScreen(`${TRACK.title} — ${TRACK.artist}`)
          if (act === 'silence') {
            setScreen('· · ·')
            setLit([])
          }
          if (act === 'drop') {
            setScreen('129 BPM')
            try {
              localStorage.setItem(SOUVENIR_KEY, '1')
            } catch {}
            setFlag('data-rave-souvenir', true)
          }
          if (act === 'outro') lightsUp(false)
        }
        const n = Math.floor(t / BEAT + 0.02)
        if (n !== beat) {
          beat = n
          if (act === 'build') setLit(n % 4 === 0 ? [Math.floor(n / 4) % 4] : [])
          if (act === 'drop') setLit([n % 4])
        }
        if (act === 'silence') {
          if (FLASHES.some((f) => t >= f && t < f + 0.15)) setLit([0, 1, 2, 3])
          else if (countIdx === 0) setLit([])
          while (countIdx < COUNTDOWN.length && t >= COUNTDOWN[countIdx][0]) {
            setScreen(COUNTDOWN[countIdx][1])
            countIdx++
            setLit([3 - countIdx])
          }
        }
        if (timeRef.current) timeRef.current.textContent = formatTime(t)
        if (t >= END || a.ended) lightsUp(false)
      }

      if (!s) return
      an.getByteFrequencyData(bins)
      bass += (level(1, bassHi) - bass) * 0.35
      high += (level(highLo, highHi) - high) * 0.35

      if (s.source.update()) s.stage.upload(s.source.canvas)
      const r = name?.getBoundingClientRect()
      s.stage.render(
        s.director.look({
          t,
          now,
          bass,
          high,
          w: innerWidth,
          h: innerHeight,
          pointer: pointer.current,
          rest: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: 120 },
          anchor: anchor.current,
        }),
        now / 1000
      )
      if (s.director.done(now)) putAway()
    }

    frame()
  }, [lightsUp, putAway])

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
        an.smoothingTimeConstant = 0.6
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
      unlock
        ?.then(() => {
          a.pause()
          a.currentTime = 0
        })
        .catch(() => {})

      setLit([pad])
      setScreen('Loading')
      go('loading')

      const begin = () => {
        if (phaseRef.current !== 'loading') return
        needleDrop(c, c.destination)
        setScreen('Needle drop')
        // The stage takes over the page; the lights go down from the board.
        show.current = openStage()
        show.current?.director.lightsDown(performance.now())
        run()
        setTimeout(() => {
          if (phaseRef.current !== 'loading') return
          document.documentElement.setAttribute('data-rave', 'playing')
          go('playing')
          a.currentTime = 0
          a.play().then(
            () => {
              setTimeout(() => {
                if (phaseRef.current === 'playing') setPill(true)
              }, BEAT * 4 * 1000)
            },
            () => teardown()
          )
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
    [go, openStage, run, teardown]
  )

  /** Pads during the set, capped at 4 hits a second. */
  const hit = useCallback((pad: number) => {
    const now = performance.now()
    if (now - lastHit.current < 250) return
    lastHit.current = now
    show.current?.director.pad(pad, now)
    setLit([pad])
    if (ctx.current) padClick(ctx.current, ctx.current.destination)
  }, [])

  const press = useCallback(
    (pad: number) => {
      if (phaseRef.current === 'armed') start(pad)
      else if (phaseRef.current === 'playing') hit(pad)
    },
    [hit, start]
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

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      closeStage()
      audio.current?.pause()
      ctx.current?.close()
    },
    [closeStage]
  )

  if (!mounted) return null

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const showBoard = phase !== 'idle'
  const playing = phase === 'playing' || phase === 'ending'

  return (
    <>
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
            {playing && (
              <span ref={timeRef} className='time'>
                0:00
              </span>
            )}
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
          <div className='rave-caption'>
            {phase === 'armed'
              ? 'press play'
              : phase === 'loading'
                ? 'cueing…'
                : coarse
                  ? 'tap stop to end'
                  : 'esc to stop · 1–4 for fx'}
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

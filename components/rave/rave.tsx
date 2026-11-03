'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ACTS, BEAT, COUNTDOWN, END, TRACK, actAt } from './cues'
import { Director } from './director'
import { capturePage, type PageCapture } from './page-source'
import { needleDrop } from './sounds'
import { AUDIO_SIZE, Stage } from './stage'
import './rave.css'

/**
 * The Set. Hold ⌥ (or long-press the record in the footer): the record lifts
 * out into a deck, the needle drops, and the page becomes the light show.
 */

type Phase = 'idle' | 'charging' | 'loading' | 'playing' | 'landing'

const HOLD_MS = 380
const LIGHTS_MS = 800
const SOUVENIR_KEY = 'ynbh:rave-souvenir'
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)'

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

/** The whole clip as ~120 peaks, for the deck's overview. */
let peaksCache: Promise<Float32Array> | null = null
function loadPeaks(ctx: AudioContext, bars = 120) {
  peaksCache ??= fetch(TRACK.src)
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => {
      const data = buf.getChannelData(0)
      const step = Math.floor(data.length / bars)
      const peaks = new Float32Array(bars)
      for (let i = 0; i < bars; i++) {
        let sum = 0
        for (let j = 0; j < step; j += 16) sum += data[i * step + j] ** 2
        peaks[i] = Math.sqrt(sum / (step / 16))
      }
      const max = Math.max(...peaks) || 1
      return peaks.map((p) => p / max)
    })
  return peaksCache
}

type Show = {
  stage: Stage
  page: PageCapture
  director: Director
  content: HTMLElement
  onResize: () => void
}

export default function Rave() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [screen, setScreen] = useState('')
  const [deck, setDeck] = useState(false)
  const [pill, setPill] = useState(false)
  const [mounted, setMounted] = useState(false)

  const phaseRef = useRef<Phase>('idle')
  const deckRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const entering = useRef(false)
  const holdTimer = useRef(0)

  const audio = useRef<HTMLAudioElement | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const master = useRef<GainNode | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const peaks = useRef<Float32Array | null>(null)
  const raf = useRef(0)
  const show = useRef<Show | null>(null)
  const origin = useRef({ x: 0, y: 0 })

  const go = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
    if (p === 'idle') document.documentElement.removeAttribute('data-rave')
    else document.documentElement.setAttribute('data-rave', p)
  }, [])

  useEffect(() => {
    setMounted(true)
    try {
      if (localStorage.getItem(SOUVENIR_KEY)) setFlag('data-rave-souvenir', true)
    } catch {}
  }, [])

  /* ---------------- Where the record is: the deck and the lights come from there. ---------------- */

  const findOrigin = useCallback(() => {
    const r = document.querySelector<HTMLElement>('[data-rave-record]')?.getBoundingClientRect()
    const onScreen = r && r.bottom > 0 && r.top < innerHeight
    origin.current = onScreen
      ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      : { x: innerWidth - 40, y: innerHeight - 40 }
    return onScreen ? r : null
  }, [])

  const placeDeck = useCallback(() => {
    const el = deckRef.current
    if (!el) return
    const r = findOrigin()
    const W = el.offsetWidth || 216
    const H = el.offsetHeight || 90
    let left = innerWidth - W - 20
    let top = innerHeight - H - 20
    if (r && r.top > H + 24) {
      left = Math.min(Math.max(16, r.right - W + 4), innerWidth - W - 16)
      top = r.top - H - 14
    }
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.transformOrigin = `${origin.current.x - left}px ${origin.current.y - top}px`
  }, [findOrigin])

  // The deck lifts out of the record once it is in the DOM.
  useLayoutEffect(() => {
    if (!deck || !entering.current) return
    entering.current = false
    placeDeck()
    deckRef.current?.animate(
      prefersReducedMotion()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: 'scale(0.1)', filter: 'blur(4px)' },
            { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' },
          ],
      { duration: 380, easing: EASE_OUT, fill: 'both' }
    )
  }, [deck, placeDeck])

  /* ---------------- Deck overview: the waveform of the whole clip ---------------- */

  const drawWave = useCallback((t: number) => {
    const c = waveRef.current
    const p = peaks.current
    if (!c || !p) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = c.clientHeight
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    const g = c.getContext('2d')!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const progress = Math.min(1, t / END)
    const bw = w / p.length
    for (let i = 0; i < p.length; i++) {
      const x = i * bw
      const v = Math.max(0.06, p[i])
      const bh = v * (h - 2)
      g.fillStyle = (i + 0.5) / p.length < progress ? '#ffb020' : '#3a3a3f'
      g.fillRect(x + 0.5, (h - bh) / 2, Math.max(1, bw - 1), bh)
    }
    // Act markers, like cue points.
    g.fillStyle = 'rgba(255,255,255,0.18)'
    for (const [, start] of ACTS.slice(1)) g.fillRect((start / END) * w, 0, 1, h)
    g.fillStyle = '#fff'
    g.fillRect(progress * w, 0, 1.5, h)
  }, [])

  /* ---------------- Stage ---------------- */

  const lights = useCallback((dir: 'down' | 'up', canvas: HTMLCanvasElement) => {
    findOrigin()
    const { x, y } = origin.current
    const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20
    const frames = [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${far}px at ${x}px ${y}px)` }]
    return canvas.animate(dir === 'down' ? frames : frames.reverse(), {
      duration: prefersReducedMotion() ? 1 : LIGHTS_MS,
      easing: EASE_IN_OUT,
      fill: 'forwards',
    })
  }, [findOrigin])

  const openStage = useCallback(async (): Promise<Show | null> => {
    const content = document.querySelector<HTMLElement>('[data-rave-content]')
    if (!content) return null
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const page = await capturePage(content, dpr)
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#fff'
    const stage = Stage.create(page, paper, Math.min(dpr, 1.75))
    if (!stage) {
      page.destroy()
      return null
    }
    const onResize = () => stage.resize()
    window.addEventListener('resize', onResize)
    document.documentElement.setAttribute('data-rave-stage', page.live ? 'live' : 'raster')
    return { stage, page, director: new Director(prefersReducedMotion()), content, onResize }
  }, [])

  const closeStage = useCallback(() => {
    const s = show.current
    show.current = null
    if (!s) return
    window.removeEventListener('resize', s.onResize)
    s.stage.destroy()
    s.page.destroy()
    document.documentElement.removeAttribute('data-rave-stage')
  }, [])

  const putDeckAway = useCallback(() => {
    const finish = () => {
      setDeck(false)
      setPill(false)
      go('idle')
    }
    const el = deckRef.current
    if (!el) return finish()
    el.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.1)' },
      ],
      { duration: 260, easing: EASE_OUT, fill: 'both' }
    ).finished.then(finish, finish)
  }, [go])

  const teardown = useCallback(() => {
    cancelAnimationFrame(raf.current)
    closeStage()
    audio.current?.pause()
    putDeckAway()
  }, [closeStage, putDeckAway])

  /** Bring the lines home, lights up into the record, then put the deck away. */
  const land = useCallback(
    (fast: boolean) => {
      if (phaseRef.current !== 'playing') return
      go('landing')
      setPill(false)
      setScreen('Thanks for coming')
      const c = ctx.current
      const g = master.current
      if (fast && c && g) {
        g.gain.cancelScheduledValues(c.currentTime)
        g.gain.setValueAtTime(g.gain.value, c.currentTime)
        g.gain.linearRampToValueAtTime(0, c.currentTime + 0.5)
        setTimeout(() => audio.current?.pause(), 520)
      }
      const s = show.current
      if (!s) return teardown()
      s.director.land(performance.now() / 1000)
      setTimeout(
        () => {
          const anim = lights('up', s.stage.canvas)
          const done = () => {
            closeStage()
            const a = audio.current
            // The tail of the track rings out with the deck still up.
            if (a && !a.paused && !a.ended) a.addEventListener('ended', teardown, { once: true })
            else teardown()
          }
          anim.finished.then(done, done)
        },
        fast ? 700 : 1500
      )
    },
    [closeStage, go, lights, teardown]
  )

  const run = useCallback(() => {
    const a = audio.current!
    const an = analyser.current!
    const wave = new Uint8Array(an.fftSize)
    const spec = new Uint8Array(an.frequencyBinCount)
    const waveTex = new Uint8Array(AUDIO_SIZE)
    const specTex = new Uint8Array(AUDIO_SIZE)
    const latency = (ctx.current?.outputLatency || 0) + (ctx.current?.baseLatency || 0)
    let lastAct = ''
    let countIdx = 0

    const frame = () => {
      raf.current = requestAnimationFrame(frame)
      const p = phaseRef.current
      const t = p === 'loading' ? 0 : Math.max(0, a.currentTime - latency)

      if (p === 'playing') {
        const act = actAt(t)
        if (act !== lastAct) {
          lastAct = act
          if (act === 'silence') setScreen('· · ·')
          if (act === 'drop') {
            setScreen('129 BPM')
            try {
              localStorage.setItem(SOUVENIR_KEY, '1')
            } catch {}
            setFlag('data-rave-souvenir', true)
          }
          if (act === 'outro') land(false)
        }
        while (countIdx < COUNTDOWN.length && t >= COUNTDOWN[countIdx][0]) setScreen(COUNTDOWN[countIdx++][1])
        if (t >= END || a.ended) land(false)
      }
      if (timeRef.current) timeRef.current.textContent = formatTime(t)
      drawWave(t)

      const s = show.current
      if (!s) return
      an.getByteTimeDomainData(wave)
      an.getByteFrequencyData(spec)
      // Resample to the texture: the waveform as is, the spectrum log-spaced.
      for (let i = 0; i < AUDIO_SIZE; i++) {
        waveTex[i] = wave[Math.floor((i / AUDIO_SIZE) * wave.length)]
        const f = Math.floor(Math.pow(spec.length * 0.7, i / AUDIO_SIZE))
        specTex[i] = spec[Math.min(spec.length - 1, f)]
      }
      s.stage.audio(waveTex, specTex)
      const box = s.content.getBoundingClientRect()
      s.stage.render(s.director.look({ t, ox: box.left, oy: box.top, h: innerHeight }, performance.now() / 1000))
    }
    frame()
  }, [drawWave, land])

  /** The needle drops. Everything from here is one gesture-free run. */
  const start = useCallback(async () => {
    if (phaseRef.current !== 'charging') return
    const a = audio.current
    const c = ctx.current
    if (!a || !c) return
    go('loading')
    entering.current = true
    setDeck(true)
    setScreen('Cueing')

    const ready = new Promise<void>((resolve, reject) => {
      if (a.readyState >= 3) return resolve()
      a.addEventListener('canplaythrough', () => resolve(), { once: true })
      a.addEventListener('error', () => reject(new Error('audio')), { once: true })
      a.load()
    })
    try {
      const [s] = await Promise.all([openStage(), ready, loadPeaks(c).then((p) => (peaks.current = p))])
      if ((phaseRef.current as Phase) !== 'loading') {
        s?.stage.destroy()
        s?.page.destroy()
        return
      }
      show.current = s
    } catch {
      setScreen('No disc')
      setTimeout(teardown, 1200)
      return
    }

    needleDrop(c, c.destination)
    setScreen(`${TRACK.title} — ${TRACK.artist}`)
    run()
    if (show.current) lights('down', show.current.stage.canvas)
    setTimeout(() => {
      if (phaseRef.current !== 'loading') return
      a.currentTime = 0
      a.play().then(
        () => {
          go('playing')
          setTimeout(() => {
            if (phaseRef.current === 'playing') setPill(true)
          }, BEAT * 4 * 1000)
        },
        () => teardown()
      )
    }, 560)
  }, [go, lights, openStage, run, teardown])

  /** Holding begins: unlock audio inside the gesture, start the countdown to the drop. */
  const charge = useCallback(() => {
    if (phaseRef.current !== 'idle') return
    if (!audio.current) {
      const el = new Audio(TRACK.src)
      el.preload = 'auto'
      el.crossOrigin = 'anonymous'
      audio.current = el
    }
    const a = audio.current
    if (!ctx.current) {
      const C = window.AudioContext || (window as any).webkitAudioContext
      const c: AudioContext = new C({ latencyHint: 'interactive' })
      const src = c.createMediaElementSource(a)
      const g = c.createGain()
      const an = c.createAnalyser()
      an.fftSize = 1024
      an.smoothingTimeConstant = 0.55
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
    // iOS: the element must start inside the gesture. Play muted, then rewind.
    a.muted = true
    a.play()
      .then(() => {
        a.pause()
        a.currentTime = 0
        a.muted = false
      })
      .catch(() => (a.muted = false))
    go('charging')
  }, [go])

  const release = useCallback(() => {
    clearTimeout(holdTimer.current)
    if (phaseRef.current === 'charging') go('idle')
  }, [go])

  /* ---------------- Input ---------------- */

  useEffect(() => {
    const isAlt = (e: KeyboardEvent) => e.key === 'Alt' || e.key === 'AltGraph'

    const onKeyDown = (e: KeyboardEvent) => {
      if (isAlt(e) && !e.repeat && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (phaseRef.current !== 'idle') return
        e.preventDefault()
        charge()
        holdTimer.current = window.setTimeout(start, HOLD_MS)
        return
      }
      // Any other key while holding means it was a shortcut, not the egg.
      if (phaseRef.current === 'charging') release()
      if (e.key === 'Escape' && phaseRef.current === 'playing') land(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (isAlt(e)) release()
    }
    const onBlur = () => release()

    // The record itself: click to play, or press and hold on touch.
    let touchTimer = 0
    let swallowClick = false
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-rave-record]')) return
      if (e.pointerType === 'mouse' || phaseRef.current !== 'idle') return
      charge()
      touchTimer = window.setTimeout(() => {
        swallowClick = true
        start()
      }, HOLD_MS)
    }
    const onPointerUp = () => {
      clearTimeout(touchTimer)
      if (phaseRef.current === 'charging' && !swallowClick) release()
    }
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-rave-record]')) return
      if (swallowClick) {
        swallowClick = false
        return
      }
      if (phaseRef.current === 'idle') {
        charge()
        start()
      } else if (phaseRef.current === 'playing') land(true)
    }
    const onResize = () => {
      if (phaseRef.current !== 'idle') placeDeck()
    }
    const onVis = () => {
      const a = audio.current
      if (!a || phaseRef.current !== 'playing') return
      if (document.hidden) a.pause()
      else a.play().catch(() => {})
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    window.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [charge, land, placeDeck, release, start])

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

  return (
    <>
      {deck && (
        <div ref={deckRef} className='rave-deck' data-phase={phase} role='group' aria-label='Deck'>
          <div className='rave-screen'>
            <span className='truncate'>{screen}</span>
            <span ref={timeRef} className='time'>
              0:00
            </span>
          </div>
          <canvas ref={waveRef} className='rave-wave' aria-hidden />
          <div className='rave-caption'>{coarse ? 'tap the record to stop' : 'esc to stop'}</div>
        </div>
      )}

      <div className='rave-pill' data-show={pill ? '' : undefined} role='status'>
        <span className='dot' />
        <span>
          {TRACK.title} — {TRACK.artist}
        </span>
        <button type='button' className='press' onClick={() => land(true)} aria-label='Stop the set'>
          stop
        </button>
      </div>
    </>
  )
}

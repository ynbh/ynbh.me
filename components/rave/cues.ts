/**
 * Timeline for "The Set", locked to public/audio/shinjuku.mp3.
 *
 * The clip is Shinjuku (Franky Rizardo) from 1:09.881 to 2:21. Clip time 0
 * sits exactly on a downbeat, so beat n lands at n * BEAT. Every number here
 * was measured from the track (low-band onsets), not guessed.
 */

export const TRACK = {
  src: '/audio/shinjuku.mp3',
  title: 'Shinjuku',
  artist: 'Franky Rizardo',
}

/** 129.2 BPM: one beat is 0.4644s, one bar 1.858s. */
export const BEAT = 0.46439909

export type Act = 'kick' | 'fill' | 'build' | 'silence' | 'drop' | 'outro'

/** Each act starts at this clip time (seconds) and runs until the next one. */
export const ACTS: [Act, number][] = [
  ['kick', 0], //          sparse breakdown: kick + hats
  ['fill', 5.573], //      percussion comes in (beat 12)
  ['build', 14.861], //    12 bars of rising mids (beat 32)
  ['silence', 37.616], //  the kick drops out (beat 81)
  ['drop', 50.155], //     the drop, crash on the downbeat (beat 108)
  ['outro', 62.694], //    next gap, then the fade (beat 135)
]

/** Clip time when the set is over and the board goes home. */
export const END = 71.1

/** Stutter kicks inside the silence: two flashes in the dark, then 3 · 2 · 1. */
export const FLASHES = [40.408, 44.129]
export const COUNTDOWN: [number, string][] = [
  [47.85, '3'],
  [48.779, '2'],
  [49.708, '1'],
]

/** Pad colours, from Shinjuku's night signage. */
export const PADS = ['#ff2e88', '#ffb020', '#2ee6ff', '#9d6bff'] as const

export function actAt(t: number): Act {
  let current: Act = 'kick'
  for (const [act, start] of ACTS) if (t >= start) current = act
  return current
}

export function actStart(act: Act) {
  return ACTS.find(([a]) => a === act)![1]
}

export function actEnd(act: Act) {
  const i = ACTS.findIndex(([a]) => a === act)
  return i + 1 < ACTS.length ? ACTS[i + 1][1] : END
}

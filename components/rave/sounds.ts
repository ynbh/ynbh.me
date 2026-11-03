/** Needle drop: a soft thunk and half a second of vinyl crackle, synthesized
 * so the egg ships with one audio file. */
export function needleDrop(ctx: AudioContext, out: AudioNode, seconds = 0.6) {
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

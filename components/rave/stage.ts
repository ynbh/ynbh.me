/**
 * The stage: every line of the page as its own strip of geometry.
 *
 * One instanced draw. Each instance is a line of the page (its box and its
 * patch of the page texture), subdivided along x so it can bend. The vertex
 * shader moves the lines with the music: it bends them with the live
 * waveform, lifts them by their own band of the spectrum, tilts the page
 * into a floor, blows it apart and wraps it into a tunnel. The fragment
 * shader relights the ink in the club's colours, additively, like light.
 */

import type { PageCapture } from './page-source'

export type Look = {
  /** Content element's top-left, in viewport CSS px. */
  ox: number
  oy: number
  base: number
  sweep: number
  sweepAmp: number
  eqLight: number
  tintMix: number
  hue: number
  wave: number
  waveSpan: number
  eq: number
  tilt: number
  push: number
  collapse: number
  explode: number
  seed: number
  tunnel: number
  tunnelZ: number
  roll: number
  jitter: number
  flash: number
  trail: number
}

export function restingLook(): Look {
  return {
    ox: 0,
    oy: 0,
    base: 1,
    sweep: -10,
    sweepAmp: 0,
    eqLight: 0,
    tintMix: 0,
    hue: 0,
    wave: 0,
    waveSpan: 1,
    eq: 0,
    tilt: 0,
    push: 0,
    collapse: 0,
    explode: 0,
    seed: 0,
    tunnel: 0,
    tunnelZ: 0,
    roll: 0,
    jitter: 0,
    flash: 0,
    trail: 0,
  }
}

const SEGMENTS = 48
export const AUDIO_SIZE = 512

const VERT = `#version 300 es
precision highp float;

in vec2 aLocal;   // 0..1 along the line, 0..1 down it
in vec4 aRect;    // x, y, w, h in css px, relative to the content box
in vec4 aMeta;    // index, band 0..1, hash, line count

uniform vec2 uView;
uniform vec2 uOrigin;
uniform vec2 uTexSize;   // content box in css px
uniform float uFocal;
uniform sampler2D uAudio; // row 0: waveform, row 1: spectrum

uniform float uWave, uWaveSpan, uEq, uTilt, uPush, uCollapse;
uniform float uExplode, uSeed, uTunnel, uTunnelZ, uRoll, uJitter;
uniform float uSweep, uSweepAmp, uBase, uEqLight;

out vec2 vUv;
out float vLight;
out float vBand;

float hash(float n) { return fract(sin(n * 91.345 + 47.853) * 43758.5453); }

vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }

void main() {
  float idx = aMeta.x, band = aMeta.y, h = aMeta.z, count = aMeta.w;
  vec2 local = aRect.xy + aLocal * aRect.zw;
  vUv = local / uTexSize;
  vBand = band;

  vec2 c = uView * 0.5;
  vec3 p = vec3(uOrigin + local, 0.0);
  vec3 center = vec3(uOrigin + aRect.xy + aRect.zw * 0.5, 0.0);
  float rowY = center.y / uView.y;

  // The line's own slice of the spectrum.
  float energy = texture(uAudio, vec2(0.02 + band * 0.6, 0.75)).r;

  // Oscilloscope: the line bends with the live waveform.
  float wx = fract(p.x / uView.x * uWaveSpan + h * 0.37);
  float wave = (texture(uAudio, vec2(wx, 0.25)).r - 0.5) * 2.0;

  // Silence: every line folds onto the centre, thin as a trace.
  float squash = mix(1.0, 0.06, uCollapse);
  float ty = c.y + (aLocal.y - 0.5) * aRect.w * squash;
  p.y = mix(p.y, ty, uCollapse);
  center.y = mix(center.y, c.y, uCollapse);
  p.y += wave * uWave * (0.6 + 0.8 * energy);

  // Equalizer: lines lift toward you with their band.
  p.z += energy * energy * uEq;
  p.z += (hash(idx + floor(uSeed * 8.0)) - 0.5) * uJitter;

  // The drop: lines blown at the camera, tumbling, sprung back on the kick.
  if (uExplode > 0.0) {
    vec3 d = p - center;
    float k = uExplode;
    d = rotX(d, (h - 0.5) * 2.4 * k);
    d = rotZ(d, (hash(idx * 3.1 + uSeed) - 0.5) * 1.2 * k);
    p = center + d;
    p.z += k * (250.0 + 650.0 * hash(idx * 7.7 + uSeed));
    p.x += k * (center.x - c.x) * 0.6;
    p.y += k * (center.y - c.y) * 0.6;
  }

  // Floor: the whole page tips back and slides under you.
  p.y -= uPush;
  vec3 q = p - vec3(c, 0.0);
  q = rotX(q, uTilt);
  p = q + vec3(c, 0.0);

  // Tunnel: lines wrap around you and fly past.
  if (uTunnel > 0.0) {
    float R = min(uView.x, uView.y) * 0.62;
    float spacing = 150.0;
    float L = count * spacing * 0.5;
    float depth = mod(idx * spacing * 0.5 + uTunnelZ, L);
    float ang = idx * 2.39996 + (aLocal.x - 0.5) * aRect.z / R + uRoll;
    vec3 tp = vec3(c.x + cos(ang) * R, c.y + sin(ang) * R, uFocal * 0.9 - depth);
    vec3 n = vec3(cos(ang), sin(ang), 0.0);
    tp -= n * (aLocal.y - 0.5) * aRect.w * 0.9;
    p = mix(p, tp, uTunnel);
  }

  float sweep = exp(-pow((rowY - uSweep) / 0.06, 2.0));
  vLight = uBase + sweep * uSweepAmp + energy * uEqLight;

  // Fade lines that come too close or fall too far.
  float dz = uFocal - p.z;
  vLight *= smoothstep(20.0, 160.0, dz) * smoothstep(uFocal * 6.0, uFocal * 2.5, dz);

  gl_Position = vec4((p.x - c.x) * uFocal / c.x, -(p.y - c.y) * uFocal / c.y, 0.0, dz);
}`

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
in float vLight;
in float vBand;
out vec4 outColor;

uniform sampler2D uPage;
uniform vec3 uPaper;
uniform float uTintMix, uHue, uFlash;

vec3 palette(float t) {
  // Pink → amber → cyan → violet, around the wheel.
  t = fract(t);
  vec3 a = vec3(1.0, 0.18, 0.53), b = vec3(1.0, 0.69, 0.13), c = vec3(0.18, 0.9, 1.0), d = vec3(0.62, 0.42, 1.0);
  float s = t * 4.0;
  if (s < 1.0) return mix(a, b, s);
  if (s < 2.0) return mix(b, c, s - 1.0);
  if (s < 3.0) return mix(c, d, s - 2.0);
  return mix(d, a, s - 3.0);
}

void main() {
  vec4 t = texture(uPage, vUv);
  vec3 col = mix(uPaper, t.rgb, t.a);
  float ink = clamp(distance(col, uPaper) / 1.5, 0.0, 1.0);
  float chroma = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  vec3 light = mix(vec3(1.0), palette(uHue + vBand * 0.5), uTintMix);
  light = mix(light, col * 1.15, smoothstep(0.15, 0.45, chroma)); // logos keep their colour
  vec3 rgb = light * ink * (vLight + uFlash);
  outColor = vec4(rgb, 1.0);
}`

const FADE_VERT = `#version 300 es
in vec2 aLocal;
void main() { gl_Position = vec4(aLocal * 2.0 - 1.0, 0.0, 1.0); }`

const FADE_FRAG = `#version 300 es
precision mediump float;
uniform float uAlpha;
out vec4 outColor;
void main() { outColor = vec4(0.008, 0.008, 0.012, uAlpha); }`

export class Stage {
  canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private fade: WebGLProgram
  private vao: WebGLVertexArrayObject
  private fadeVao: WebGLVertexArrayObject
  private pageTex: WebGLTexture
  private audioTex: WebGLTexture
  private count: number
  private indexCount: number
  private uni = new Map<string, WebGLUniformLocation | null>()
  private paper: [number, number, number]
  private texSize: [number, number]
  dpr: number

  static create(page: PageCapture, paper: string, dpr: number): Stage | null {
    try {
      return new Stage(page, paper, dpr)
    } catch (e) {
      console.warn('[rave] stage unavailable', e)
      return null
    }
  }

  private constructor(page: PageCapture, paper: string, dpr: number) {
    this.dpr = dpr
    this.paper = parseColor(paper)
    this.texSize = [page.width, page.height]
    const canvas = document.createElement('canvas')
    canvas.className = 'rave-stage'
    canvas.setAttribute('aria-hidden', 'true')
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('webgl2')
    this.canvas = canvas
    this.gl = gl
    this.prog = program(gl, VERT, FRAG)
    this.fade = program(gl, FADE_VERT, FADE_FRAG)

    // A strip: SEGMENTS quads along x.
    const verts: number[] = []
    for (let i = 0; i <= SEGMENTS; i++) verts.push(i / SEGMENTS, 0, i / SEGMENTS, 1)
    const idx: number[] = []
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    this.indexCount = idx.length

    // One instance per line of the page.
    const lines = page.lines
    this.count = lines.length
    const rects = new Float32Array(lines.length * 4)
    const meta = new Float32Array(lines.length * 4)
    const order = lines.map((l, i) => [l.y, i] as const).sort((a, b) => a[0] - b[0])
    order.forEach(([, i], rank) => {
      const l = lines[i]
      rects.set([l.x, l.y, l.w, l.h], i * 4)
      // Bass at the bottom of the page, air at the top.
      const band = 1 - rank / Math.max(1, lines.length - 1)
      meta.set([i, band, fract(Math.sin(i * 12.9898) * 43758.5453), lines.length], i * 4)
    })

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    const attr = (name: string, data: Float32Array, size: number, divisor: number) => {
      const loc = gl.getAttribLocation(this.prog, name)
      if (loc < 0) return
      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(loc, divisor)
    }
    attr('aLocal', new Float32Array(verts), 2, 0)
    attr('aRect', rects, 4, 1)
    attr('aMeta', meta, 4, 1)
    const ib = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW)

    this.fadeVao = gl.createVertexArray()!
    gl.bindVertexArray(this.fadeVao)
    const fb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, fb)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW)
    const floc = gl.getAttribLocation(this.fade, 'aLocal')
    gl.enableVertexAttribArray(floc)
    gl.vertexAttribPointer(floc, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    // The page texture, mipmapped so lines stay crisp as they fall away.
    this.pageTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.pageTex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, page.canvas)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8)

    // Audio: waveform and spectrum, one row each.
    this.audioTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.audioTex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, AUDIO_SIZE, 2, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(AUDIO_SIZE * 2).fill(128))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.resize()
    document.body.appendChild(canvas)
  }

  resize() {
    this.canvas.width = Math.round(innerWidth * this.dpr)
    this.canvas.height = Math.round(innerHeight * this.dpr)
    const gl = this.gl
    gl.clearColor(0.008, 0.008, 0.012, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /** 512 bytes of waveform, 512 bytes of spectrum. */
  audio(wave: Uint8Array, spectrum: Uint8Array) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.audioTex)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, AUDIO_SIZE, 1, gl.RED, gl.UNSIGNED_BYTE, wave)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 1, AUDIO_SIZE, 1, gl.RED, gl.UNSIGNED_BYTE, spectrum)
  }

  render(look: Look) {
    const gl = this.gl
    const w = this.canvas.width
    const h = this.canvas.height
    gl.viewport(0, 0, w, h)

    // Clear, or leave a little of the last frame behind as a trail.
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.useProgram(this.fade)
    gl.uniform1f(gl.getUniformLocation(this.fade, 'uAlpha'), 1 - look.trail)
    gl.bindVertexArray(this.fadeVao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Lines add up like light.
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.useProgram(this.prog)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.pageTex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.audioTex)

    const u = (name: string) => {
      if (!this.uni.has(name)) this.uni.set(name, gl.getUniformLocation(this.prog, name))
      return this.uni.get(name)!
    }
    const vw = innerWidth
    const vh = innerHeight
    // Focal length so that z = 0 maps 1:1 to CSS px (a 34° vertical field of view).
    const focal = vh / 2 / Math.tan((34 * Math.PI) / 360)
    gl.uniform1i(u('uPage'), 0)
    gl.uniform1i(u('uAudio'), 1)
    gl.uniform2f(u('uView'), vw, vh)
    gl.uniform2f(u('uOrigin'), look.ox, look.oy)
    gl.uniform2f(u('uTexSize'), ...this.texSize)
    gl.uniform1f(u('uFocal'), focal)
    gl.uniform3f(u('uPaper'), ...this.paper)
    gl.uniform1f(u('uWave'), look.wave)
    gl.uniform1f(u('uWaveSpan'), look.waveSpan)
    gl.uniform1f(u('uEq'), look.eq)
    gl.uniform1f(u('uTilt'), look.tilt)
    gl.uniform1f(u('uPush'), look.push)
    gl.uniform1f(u('uCollapse'), look.collapse)
    gl.uniform1f(u('uExplode'), look.explode)
    gl.uniform1f(u('uSeed'), look.seed)
    gl.uniform1f(u('uTunnel'), look.tunnel)
    gl.uniform1f(u('uTunnelZ'), look.tunnelZ)
    gl.uniform1f(u('uRoll'), look.roll)
    gl.uniform1f(u('uJitter'), look.jitter)
    gl.uniform1f(u('uSweep'), look.sweep)
    gl.uniform1f(u('uSweepAmp'), look.sweepAmp)
    gl.uniform1f(u('uBase'), look.base)
    gl.uniform1f(u('uEqLight'), look.eqLight)
    gl.uniform1f(u('uTintMix'), look.tintMix)
    gl.uniform1f(u('uHue'), look.hue)
    gl.uniform1f(u('uFlash'), look.flash)
    gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, this.count)
    gl.bindVertexArray(null)
  }

  destroy() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.canvas.remove()
  }
}

function fract(x: number) {
  return x - Math.floor(x)
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
    gl.attachShader(p, s)
  }
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

export function parseColor(css: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.fillStyle = css
  const v = ctx.fillStyle as string
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const m = v.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]
  return [m[0] / 255, m[1] / 255, m[2] / 255]
}

/**
 * The stage: one fragment shader that VJs the page.
 *
 * Input is the page texture (see page-source.ts). The shader separates ink
 * from paper, so it can relight the page in any palette, then bends it:
 * a torch in the dark, scratched rows, an LED wall, a CRT switching off,
 * a feedback tunnel. A ping-pong framebuffer carries the previous frame
 * for trails.
 */

export type Look = {
  /** 0 = the page as it is, 1 = the club. Shaped by the iris below. */
  stage: number
  irisR: number
  irisX: number
  irisY: number
  /** 1: the club spreads outward from the iris centre. -1: the page does. */
  irisDir: number
  ambient: number
  torch: number
  torchR: number
  px: number
  py: number
  tint: [number, number, number]
  tintMix: number
  slice: number
  sliceH: number
  seed: number
  rgb: number
  dots: number
  cell: number
  squash: number
  band: number
  flash: number
  feedback: number
  zoom: number
  kaleido: number
  ripple: number
  rippleX: number
  rippleY: number
  rippleAmp: number
  grain: number
}

export function restingLook(): Look {
  return {
    stage: 0,
    irisR: 1e5,
    irisX: 0,
    irisY: 0,
    irisDir: 1,
    ambient: 1,
    torch: 0,
    torchR: 150,
    px: -1e4,
    py: -1e4,
    tint: [1, 1, 1],
    tintMix: 0,
    slice: 0,
    sliceH: 22,
    seed: 0,
    rgb: 0,
    dots: 0,
    cell: 8,
    squash: 0,
    band: 1,
    flash: 0,
    feedback: 0,
    zoom: 1,
    kaleido: 0,
    ripple: -1,
    rippleX: 0,
    rippleY: 0,
    rippleAmp: 0,
    grain: 0,
  }
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform sampler2D uPage;
uniform sampler2D uPrev;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec3 uPaper;

uniform float uStage, uIrisR, uIrisDir;
uniform vec2 uIris;
uniform float uAmbient, uTorch, uTorchR;
uniform vec2 uPointer;
uniform vec3 uTint;
uniform float uTintMix;
uniform float uSlice, uSliceH, uSeed, uRgb;
uniform float uDots, uCell, uSquash, uBand, uFlash;
uniform float uFeedback, uZoom, uKaleido;
uniform float uRipple, uRippleAmp;
uniform vec2 uRippleC;
uniform float uGrain;

const vec3 CLUB = vec3(0.012, 0.012, 0.016);
const vec3 INK = vec3(0.96, 0.96, 0.98);

float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec4 pageLod(vec2 p, float lod) {
  vec2 uv = p * uDpr / uRes;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(uPaper, 1.0);
  vec4 c = textureLod(uPage, uv, lod);
  // Transparent source pixels are paper.
  return vec4(mix(uPaper, c.rgb, c.a), 1.0);
}
vec4 page(vec2 p) { return pageLod(p, 0.0); }

// How much of this pixel is ink, keeping the page's hierarchy of greys.
float inkOf(vec3 c) { return clamp(distance(c, uPaper) / 1.55, 0.0, 1.0); }

vec3 club(vec3 c, float light, vec2 p) {
  float m = inkOf(c);
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  vec3 ink = mix(INK, uTint, uTintMix);
  ink = mix(ink, c * 1.1, smoothstep(0.15, 0.45, chroma)); // logos keep their colour
  return CLUB + (ink - CLUB) * m * light;
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = frag / uDpr;               // css px, top-left origin
  vec2 size = uRes / uDpr;
  vec2 c = size * 0.5;

  // ---- Geometry: everything that moves the page before we look at it.
  vec2 q = p;

  if (uKaleido > 0.5) {
    vec2 d = q - c;
    float seg = 6.2831853 / uKaleido;
    float a = atan(d.y, d.x);
    a = mod(a, seg);
    a = abs(a - seg * 0.5);
    q = c + vec2(cos(a), sin(a)) * length(d);
  }

  q = c + (q - c) / uZoom;

  if (uRipple >= 0.0) {
    vec2 d = q - uRippleC;
    float r = length(d);
    float front = uRipple * 900.0;
    float w = exp(-abs(r - front) / 50.0) * exp(-uRipple * 2.2);
    q -= normalize(d + 1e-4) * sin((r - front) / 14.0) * w * uRippleAmp;
  }

  if (uSlice > 0.0) {
    float row = floor(q.y / uSliceH);
    float on = step(0.55, hash(row * 1.37 + uSeed));
    q.x += (hash(row + uSeed * 3.1) - 0.5) * 2.0 * uSlice * on;
  }

  // CRT: the picture collapses to a line.
  float sy = mix(1.0, 0.003, uSquash);
  q.y = c.y + (q.y - c.y) / sy;
  float alive = step(abs(q.y - c.y), c.y) * step(0.001, 1.0 - uSquash + 0.002);

  // ---- LED wall: sample once per cell.
  vec2 cellC = (floor(q / uCell) + 0.5) * uCell;
  vec2 sq = mix(q, cellC, step(0.5, uDots));

  // ---- Light.
  float torch = uTorch * exp(-pow(distance(p, uPointer) / uTorchR, 2.0));
  float light = uAmbient + torch * 2.2;

  vec3 col;
  vec4 base = page(sq);
  if (uRgb > 0.0) {
    vec2 o = vec2(uRgb, 0.0);
    col = vec3(
      club(page(sq + o).rgb, light, p).r,
      club(base.rgb, light, p).g,
      club(page(sq - o).rgb, light, p).b
    );
  } else {
    col = club(base.rgb, light, p);
  }

  if (uDots > 0.0) {
    // How much ink the whole cell holds (mip level ≈ cell size), not one sample.
    vec3 avg = pageLod(cellC, log2(max(1.0, uCell * uDpr))).rgb;
    float m = clamp(inkOf(avg) * 4.0, 0.0, 1.0);
    col = CLUB + (mix(INK, uTint, uTintMix) - CLUB) * m * light;
    float r = uCell * 0.42;
    float dot = smoothstep(r, r - 1.2, distance(q, cellC)) * step(0.06, m);
    vec3 led = CLUB + (col - CLUB) * dot * 1.25 + mix(INK, uTint, uTintMix) * 0.025 * dot;
    col = mix(col, led, uDots);
  }

  // Warm halo of the torch on the floor.
  col += mix(INK, uTint, 0.7) * torch * 0.035;

  // A curtain that only lets a band of the picture through.
  float band = step(abs(p.y - c.y), uBand * c.y + 0.5);
  col = mix(CLUB, col, band * alive);

  // Flash: one frame of the room, lit from the front.
  float m0 = inkOf(base.rgb);
  col = mix(col, vec3(0.94) - vec3(m0 * 0.9), uFlash);

  // Trails.
  if (uFeedback > 0.0) {
    vec2 f = gl_FragCoord.xy / uRes - 0.5;
    float ang = 0.006;
    f = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * f / 1.018;
    vec3 prev = texture(uPrev, f + 0.5).rgb;
    prev = prev.gbr * 0.25 + prev * 0.75; // hue drifts as it falls away
    col = max(col, prev * uFeedback);
  }

  col += (hash2(frag + fract(uTime) * 91.0) - 0.5) * uGrain;

  // ---- The iris: where the club ends and the page begins.
  float d = distance(p, uIris);
  float s = clamp((uIrisR - d) / 90.0, 0.0, 1.0);
  if (uIrisDir < 0.0) s = 1.0 - s;
  s *= uStage;

  vec3 home = page(p).rgb;
  outColor = vec4(mix(home, col, s), 1.0);
}`

const BLIT = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uRes;
void main() { outColor = texture(uTex, gl_FragCoord.xy / uRes); }`

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture }

export class Stage {
  canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private prog: WebGLProgram
  private blit: WebGLProgram
  private pageTex: WebGLTexture
  private targets: Target[] = []
  private flip = 0
  private uni = new Map<string, WebGLUniformLocation | null>()
  private paper: [number, number, number]
  dpr: number

  static create(paper: string, dpr: number): Stage | null {
    try {
      return new Stage(paper, dpr)
    } catch {
      return null
    }
  }

  private constructor(paper: string, dpr: number) {
    this.dpr = dpr
    this.paper = parseColor(paper)
    const canvas = document.createElement('canvas')
    canvas.className = 'rave-stage'
    canvas.setAttribute('aria-hidden', 'true')
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false })
    if (!gl) throw new Error('webgl2')
    this.canvas = canvas
    this.gl = gl
    this.prog = program(gl, VERT, FRAG)
    this.blit = program(gl, VERT, BLIT)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    for (const p of [this.prog, this.blit]) {
      const loc = gl.getAttribLocation(p, 'aPos')
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    }

    this.pageTex = texture(gl)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    this.resize()
    document.body.appendChild(canvas)
  }

  resize() {
    const gl = this.gl
    const w = Math.round(innerWidth * this.dpr)
    const h = Math.round(innerHeight * this.dpr)
    this.canvas.width = w
    this.canvas.height = h
    for (const t of this.targets) {
      gl.deleteFramebuffer(t.fb)
      gl.deleteTexture(t.tex)
    }
    this.targets = [0, 1].map(() => {
      const tex = texture(gl)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      const fb = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return { fb, tex }
    })
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  upload(source: HTMLCanvasElement) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.pageTex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.generateMipmap(gl.TEXTURE_2D)
  }

  render(look: Look, time: number) {
    const gl = this.gl
    const w = this.canvas.width
    const h = this.canvas.height
    const read = this.targets[this.flip]
    const write = this.targets[1 - this.flip]

    gl.useProgram(this.prog)
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb)
    gl.viewport(0, 0, w, h)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.pageTex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, read.tex)

    const u = (name: string) => {
      if (!this.uni.has(name)) this.uni.set(name, gl.getUniformLocation(this.prog, name))
      return this.uni.get(name)!
    }
    gl.uniform1i(u('uPage'), 0)
    gl.uniform1i(u('uPrev'), 1)
    gl.uniform2f(u('uRes'), w, h)
    gl.uniform1f(u('uDpr'), this.dpr)
    gl.uniform1f(u('uTime'), time)
    gl.uniform3f(u('uPaper'), ...this.paper)
    gl.uniform1f(u('uStage'), look.stage)
    gl.uniform1f(u('uIrisR'), look.irisR)
    gl.uniform1f(u('uIrisDir'), look.irisDir)
    gl.uniform2f(u('uIris'), look.irisX, look.irisY)
    gl.uniform1f(u('uAmbient'), look.ambient)
    gl.uniform1f(u('uTorch'), look.torch)
    gl.uniform1f(u('uTorchR'), look.torchR)
    gl.uniform2f(u('uPointer'), look.px, look.py)
    gl.uniform3f(u('uTint'), ...look.tint)
    gl.uniform1f(u('uTintMix'), look.tintMix)
    gl.uniform1f(u('uSlice'), look.slice)
    gl.uniform1f(u('uSliceH'), look.sliceH)
    gl.uniform1f(u('uSeed'), look.seed)
    gl.uniform1f(u('uRgb'), look.rgb)
    gl.uniform1f(u('uDots'), look.dots)
    gl.uniform1f(u('uCell'), look.cell)
    gl.uniform1f(u('uSquash'), look.squash)
    gl.uniform1f(u('uBand'), look.band)
    gl.uniform1f(u('uFlash'), look.flash)
    gl.uniform1f(u('uFeedback'), look.feedback)
    gl.uniform1f(u('uZoom'), look.zoom)
    gl.uniform1f(u('uKaleido'), look.kaleido)
    gl.uniform1f(u('uRipple'), look.ripple)
    gl.uniform1f(u('uRippleAmp'), look.rippleAmp)
    gl.uniform2f(u('uRippleC'), look.rippleX, look.rippleY)
    gl.uniform1f(u('uGrain'), look.grain)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.useProgram(this.blit)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, write.tex)
    gl.uniform1i(gl.getUniformLocation(this.blit, 'uTex'), 0)
    gl.uniform2f(gl.getUniformLocation(this.blit, 'uRes'), w, h)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    this.flip = 1 - this.flip
  }

  destroy() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.canvas.remove()
  }
}

function texture(gl: WebGL2RenderingContext) {
  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
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
  gl.bindAttribLocation(p, 0, 'aPos')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

export function parseColor(css: string): [number, number, number] {
  const ctx = document.createElement('canvas').getContext('2d')!
  ctx.fillStyle = css
  const hex = ctx.fillStyle as string
  if (hex.startsWith('#')) {
    const n = parseInt(hex.slice(1), 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const m = hex.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]
  return [m[0] / 255, m[1] / 255, m[2] / 255]
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

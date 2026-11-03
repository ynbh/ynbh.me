/**
 * The page, as pixels and lines.
 *
 * The show turns every line of the page into its own piece of geometry, so
 * it needs two things: one texture of the whole page, and the box of every
 * visual line in it.
 *
 * - Where the browser supports HTML-in-canvas (`<canvas layoutsubtree>` or
 *   `<canvas content="drawable">` + `drawElementImage`), a clone of the page
 *   is laid out inside a canvas and the browser paints it there: the texture
 *   is the page, pixel for pixel.
 * - Everywhere else, the page is rasterized from layout: text word by word at
 *   the positions layout gave it, images where they sit.
 */

export type Line = {
  /** Box in CSS px, relative to the content element's top-left. */
  x: number
  y: number
  w: number
  h: number
}

export type PageCapture = {
  canvas: HTMLCanvasElement
  /** Texture pixels per CSS px. */
  scale: number
  width: number
  height: number
  lines: Line[]
  live: boolean
  destroy(): void
}

const MAX_TEXTURE = 8192

type Mode = 'layoutsubtree' | 'drawable' | null

export function htmlInCanvasMode(): Mode {
  if (typeof HTMLCanvasElement === 'undefined') return null
  if (typeof (CanvasRenderingContext2D.prototype as any).drawElementImage !== 'function') return null
  if ('layoutSubtree' in HTMLCanvasElement.prototype) return 'layoutsubtree'
  if ('content' in HTMLCanvasElement.prototype) return 'drawable'
  return null
}

export async function capturePage(content: HTMLElement, dpr: number): Promise<PageCapture> {
  const box = content.getBoundingClientRect()
  const width = Math.ceil(box.width)
  const height = Math.ceil(box.height)
  const scale = Math.min(dpr, MAX_TEXTURE / Math.max(width, height))
  const lines = measureLines(content, box)

  const mode = htmlInCanvasMode()
  if (mode) {
    try {
      const canvas = await liveCapture(content, mode, width, height, scale)
      return { canvas, scale, width, height, lines, live: true, destroy: () => canvas.remove() }
    } catch {}
  }
  const canvas = rasterCapture(content, box, width, height, scale)
  return { canvas, scale, width, height, lines, live: false, destroy() {} }
}

/* ------------------------------------------------------------------ */
/* HTML-in-canvas                                                       */
/* ------------------------------------------------------------------ */

function liveCapture(
  content: HTMLElement,
  mode: Exclude<Mode, null>,
  width: number,
  height: number,
  scale: number
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  if (mode === 'layoutsubtree') canvas.setAttribute('layoutsubtree', '')
  else canvas.setAttribute('content', 'drawable')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.setAttribute('inert', '')
  canvas.className = 'rave-source'
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)

  const clone = content.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-rave-content')
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
  clone.querySelectorAll('[data-rave-record]').forEach((el) => el.removeAttribute('data-rave-record'))
  if (mode === 'drawable') clone.setAttribute('drawable', '')
  Object.assign(clone.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    margin: '0',
    width: `${width}px`,
    maxWidth: 'none',
    minHeight: '0',
  })
  canvas.appendChild(clone)
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D & {
    drawElementImage(el: Element, dx: number, dy: number, dw: number, dh: number): void
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      canvas.remove()
      reject(new Error('no paint'))
    }, 1500)
    ;(canvas as any).onpaint = () => {
      try {
        ctx.reset()
        ctx.drawElementImage(clone, 0, 0, canvas.width, canvas.height)
        clearTimeout(timeout)
        ;(canvas as any).onpaint = null
        resolve(canvas)
      } catch (e) {
        // No snapshot yet: wait for the next paint.
        ;(canvas as any).requestPaint?.()
      }
    }
    ;(canvas as any).requestPaint?.()
  })
}

/* ------------------------------------------------------------------ */
/* Fallback: rasterize text and images from layout                      */
/* ------------------------------------------------------------------ */

function rasterCapture(content: HTMLElement, box: DOMRect, width: number, height: number, scale: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, -box.left * scale, -box.top * scale)

  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  const range = document.createRange()
  const metrics = new Map<string, { a: number; d: number }>()

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el instanceof HTMLImageElement && el.complete && el.naturalWidth) {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        if (s.visibility === 'hidden' || s.display === 'none') continue
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(r.left, r.top, r.width, r.height, parseFloat(s.borderTopLeftRadius) || 0)
        ctx.fillStyle = s.backgroundColor
        ctx.fill()
        ctx.clip()
        const p = parseFloat(s.paddingLeft) || 0
        ctx.drawImage(el, r.left + p, r.top + p, r.width - p * 2, r.height - p * 2)
        ctx.restore()
      }
      continue
    }

    const text = node.textContent ?? ''
    if (!text.trim()) continue
    const parent = node.parentElement
    if (!parent) continue
    const s = getComputedStyle(parent)
    if (s.visibility === 'hidden' || s.display === 'none') continue

    const font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`
    ctx.font = font
    ctx.fillStyle = s.color
    ctx.textBaseline = 'alphabetic'
    let m = metrics.get(font)
    if (!m) {
      const tm = ctx.measureText('Hg')
      m = { a: tm.fontBoundingBoxAscent, d: tm.fontBoundingBoxDescent }
      metrics.set(font, m)
    }

    // Word by word, so wrapped lines land where layout put them.
    const re = /\S+/g
    let match: RegExpExecArray | null
    while ((match = re.exec(text))) {
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      const r = range.getBoundingClientRect()
      if (!r.width) continue
      ctx.fillText(match[0], r.left, r.top + (r.height - (m.a + m.d)) / 2 + m.a)
    }
  }
  return canvas
}

/* ------------------------------------------------------------------ */
/* Lines: every visual line of text (with its logo), as a box           */
/* ------------------------------------------------------------------ */

function measureLines(content: HTMLElement, box: DOMRect): Line[] {
  const rects: DOMRect[] = []
  const range = document.createRange()
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node instanceof HTMLImageElement || node instanceof SVGSVGElement) {
        const r = (node as Element).getBoundingClientRect()
        if (r.width && r.height) rects.push(r)
      }
      continue
    }
    if (!node.textContent?.trim()) continue
    range.selectNodeContents(node)
    for (const r of Array.from(range.getClientRects())) if (r.width > 0.5 && r.height > 0.5) rects.push(r)
  }

  // Group runs into lines: same vertical band, close horizontally.
  rects.sort((a, b) => a.top + a.height / 2 - (b.top + b.height / 2) || a.left - b.left)
  const lines: { l: number; t: number; r: number; b: number }[] = []
  for (const r of rects) {
    const cy = r.top + r.height / 2
    const line = lines.find((L) => cy > L.t && cy < L.b && r.left < L.r + 160)
    if (line) {
      line.l = Math.min(line.l, r.left)
      line.r = Math.max(line.r, r.right)
      line.t = Math.min(line.t, r.top)
      line.b = Math.max(line.b, r.bottom)
    } else lines.push({ l: r.left, t: r.top, r: r.right, b: r.bottom })
  }

  const pad = 3
  return lines.map((L) => ({
    x: L.l - box.left - pad,
    y: L.t - box.top - pad,
    w: L.r - L.l + pad * 2,
    h: L.b - L.t + pad * 2,
  }))
}

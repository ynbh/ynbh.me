/**
 * The page, as pixels.
 *
 * The light show is a shader, and its only footage is the page itself. This
 * module turns the page into a viewport-sized canvas the shader can sample.
 *
 * - Where the browser supports HTML-in-canvas (`<canvas layoutsubtree>` +
 *   `drawElementImage`), a live clone of the page is laid out *inside* a
 *   canvas and drawn every paint. It is pixel-exact and stays interactive:
 *   rows still take hover while the set is playing.
 * - Everywhere else, the page is rasterized once by measuring its text and
 *   images, and the visible window is blitted on scroll.
 */

export type PageSource = {
  canvas: HTMLCanvasElement
  live: boolean
  /** True when the canvas holds new pixels since the last call. */
  update(): boolean
  resize(): void
  destroy(): void
}

const MAX_TEXTURE = 8192

export function supportsHtmlInCanvas() {
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    'layoutSubtree' in HTMLCanvasElement.prototype &&
    typeof (CanvasRenderingContext2D.prototype as any).drawElementImage === 'function'
  )
}

export function createPageSource(content: HTMLElement, dpr: number): PageSource {
  if (supportsHtmlInCanvas()) {
    try {
      return liveSource(content, dpr)
    } catch {}
  }
  return rasterSource(content, dpr)
}

/* ------------------------------------------------------------------ */
/* HTML-in-canvas                                                       */
/* ------------------------------------------------------------------ */

function liveSource(content: HTMLElement, dpr: number): PageSource {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('layoutsubtree', '')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.className = 'rave-source'
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D & {
    drawElementImage(el: Element, dx: number, dy: number): void
  }

  const clone = content.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-rave-content')
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
  clone.querySelectorAll('[data-rave-record]').forEach((el) => el.removeAttribute('data-rave-record'))
  clone.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'))
  clone.style.position = 'absolute'
  clone.style.margin = '0'
  canvas.appendChild(clone)
  document.body.appendChild(canvas)

  // The clone is for looking at (and hovering), not for leaving the set.
  const swallow = (e: Event) => e.preventDefault()
  canvas.addEventListener('click', swallow)

  let dirty = true
  let lastScroll = -1
  const layout = () => {
    const r = content.getBoundingClientRect()
    clone.style.left = `${r.left}px`
    clone.style.top = `${r.top + scrollY}px`
    clone.style.width = `${r.width}px`
    canvas.width = Math.round(innerWidth * dpr)
    canvas.height = Math.round(innerHeight * dpr)
    dirty = true
  }

  // Fires whenever the clone repaints (hover, scroll) — not every frame.
  ;(canvas as any).onpaint = () => {
    ctx.reset()
    const top = parseFloat(clone.style.top) - scrollY
    ctx.drawElementImage(clone, parseFloat(clone.style.left) * dpr, top * dpr)
    dirty = true
  }
  layout()

  return {
    canvas,
    live: true,
    update() {
      if (scrollY !== lastScroll) {
        lastScroll = scrollY
        ;(canvas as any).requestPaint?.()
      }
      const d = dirty
      dirty = false
      return d
    },
    resize: layout,
    destroy() {
      canvas.removeEventListener('click', swallow)
      canvas.remove()
    },
  }
}

/* ------------------------------------------------------------------ */
/* Fallback: rasterize text and images from layout                      */
/* ------------------------------------------------------------------ */

function rasterSource(content: HTMLElement, dpr: number): PageSource {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const sheet = document.createElement('canvas')
  const sctx = sheet.getContext('2d')!
  let scale = dpr
  let originY = 0
  let lastScroll = -1

  const paint = () => {
    canvas.width = Math.round(innerWidth * dpr)
    canvas.height = Math.round(innerHeight * dpr)
    const box = content.getBoundingClientRect()
    originY = box.top + scrollY
    const height = Math.max(box.height, 1)
    scale = Math.min(dpr, MAX_TEXTURE / height)
    sheet.width = Math.round(innerWidth * scale)
    sheet.height = Math.round(height * scale)
    sctx.setTransform(scale, 0, 0, scale, 0, -originY * scale)
    sctx.clearRect(0, originY, innerWidth, height)
    drawTree(sctx, content)
    lastScroll = -1
  }

  paint()

  return {
    canvas,
    live: false,
    update() {
      if (scrollY === lastScroll) return false
      lastScroll = scrollY
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const sy = (scrollY - originY) * scale
      ctx.drawImage(
        sheet,
        0,
        sy,
        sheet.width,
        innerHeight * scale,
        0,
        0,
        canvas.width,
        canvas.height
      )
      return true
    },
    resize: paint,
    destroy() {},
  }
}

function drawTree(ctx: CanvasRenderingContext2D, root: HTMLElement) {
  const sy = scrollY
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  const range = document.createRange()
  const metrics = new Map<string, { a: number; d: number }>()

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el instanceof HTMLImageElement && el.complete && el.naturalWidth) {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        if (s.visibility === 'hidden' || s.display === 'none') continue
        const radius = parseFloat(s.borderTopLeftRadius) || 0
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(r.left, r.top + sy, r.width, r.height, radius)
        ctx.fillStyle = s.backgroundColor
        ctx.fill()
        ctx.clip()
        const p = parseFloat(s.paddingLeft) || 0
        ctx.drawImage(el, r.left + p, r.top + sy + p, r.width - p * 2, r.height - p * 2)
        ctx.restore()
      }
      continue
    }

    const text = node.textContent ?? ''
    if (!text.trim()) continue
    const parent = node.parentElement
    if (!parent) continue
    const s = getComputedStyle(parent)
    if (s.visibility === 'hidden' || s.display === 'none' || parent.closest('[aria-hidden="true"] svg'))
      continue

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
      const baseline = r.top + sy + (r.height - (m.a + m.d)) / 2 + m.a
      ctx.fillText(match[0], r.left, baseline)
    }
  }
}

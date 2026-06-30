'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export interface ProjectTileProps {
  title: string
  description: string
  href: string
  /** GitHub `owner/repo` — used to fetch the auto-generated social preview. */
  repo?: string
  /** Custom image URL (overrides repo). */
  image?: string
  /** Fallback gradient when neither repo nor image is provided. */
  gradient?: string
  /** Small uppercase label rendered above the title overlay (used only when no image). */
  subtitle?: string
  meta?: string
}

const fallbackGradients = [
  'linear-gradient(135deg, #1f2937 0%, #0f172a 50%, #020617 100%)',
  'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 50%, #020617 100%)',
  'linear-gradient(135deg, #064e3b 0%, #022c22 50%, #020617 100%)',
  'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 50%, #020617 100%)',
  'linear-gradient(135deg, #7c2d12 0%, #1c1917 50%, #020617 100%)',
  'linear-gradient(135deg, #831843 0%, #1c1917 50%, #020617 100%)',
]

export function ProjectTile({
  title,
  description,
  href,
  repo,
  image,
  gradient,
  subtitle,
  meta,
}: ProjectTileProps) {
  const previewUrl =
    image ?? (repo ? `https://opengraph.githubassets.com/1/${repo}` : null)

  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    if (!previewUrl) {
      setImageLoaded(false)
      setImageFailed(false)
      return
    }

    setImageLoaded(false)
    setImageFailed(false)

    const img = new window.Image()
    img.onload = () => setImageLoaded(true)
    img.onerror = () => setImageFailed(true)
    img.src = previewUrl

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [previewUrl])

  const showPreview = Boolean(previewUrl) && imageLoaded && !imageFailed
  const showPlaceholder = !showPreview

  const surfaceStyle: React.CSSProperties = showPreview
    ? {
        backgroundImage: `url(${previewUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background:
          gradient ?? fallbackGradients[hash(title) % fallbackGradients.length],
      }

  return (
    <Link
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      draggable={false}
      className='group block no-underline focus-visible:outline focus-visible:outline-rurikon-400 focus-visible:outline-dotted focus-visible:rounded-md'
    >
      <div
        className='relative w-full aspect-[2/1] rounded-md overflow-hidden ring-1 ring-rurikon-border transition-all duration-200 group-hover:ring-rurikon-300 group-hover:-translate-y-0.5'
        style={surfaceStyle}
      >
        {showPlaceholder && (
          <>
            <div
              aria-hidden
              className='absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none'
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.12), transparent 50%)',
              }}
            />
            <div className='absolute inset-0 p-4 sm:p-5 flex flex-col justify-between'>
              <div className='flex items-start justify-between gap-3'>
                {(subtitle || repo) && (
                  <div className='text-[10px] uppercase tracking-[0.18em] text-white/60 font-medium'>
                    {subtitle ?? 'github'}
                  </div>
                )}
                {meta && (
                  <div className='text-[10px] text-white/50 font-mono whitespace-nowrap'>
                    {meta}
                  </div>
                )}
              </div>
              <h3 className='text-white font-bold text-xl sm:text-2xl tracking-tight leading-tight'>
                {title}
              </h3>
            </div>
          </>
        )}
      </div>
      <div className='mt-2 leading-snug'>
        <span className='text-rurikon-700 text-sm font-medium'>{title}</span>
        <span className='text-rurikon-400 text-sm'> — {description}</span>
      </div>
    </Link>
  )
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

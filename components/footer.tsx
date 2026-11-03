'use client'

import { useEffect, useState } from 'react'
import ThemeToggle from './theme-toggle'

/**
 * The record glyph is the easter egg's origin: holding Option (Alt) lifts it
 * out into the pad board, and a long-press does the same on touch screens.
 */
export default function Footer() {
  const [key, setKey] = useState('⌥')

  useEffect(() => {
    const platform: string =
      (navigator as any).userAgentData?.platform ?? navigator.platform ?? ''
    if (!/mac|iphone|ipad/i.test(platform)) setKey('alt')
  }, [])

  return (
    <footer className='mt-[72px] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[13px] text-ink3'>
      <span data-rave-footer-text>
        Wanna chat?{' '}
        <a className='link text-ink2' href='mailto:ybhat@umd.edu'>
          ybhat@umd.edu
        </a>
      </span>
      <span className='flex items-center gap-3'>
        <ThemeToggle />
        <span aria-hidden className='select-none text-hair'>
          ·
        </span>
        <span className='flex items-center gap-2'>
          <span className='hint-fine select-none whitespace-nowrap' aria-hidden>
            hold{' '}
            <kbd className='font-mono text-[11px] text-ink2' suppressHydrationWarning>
              {key}
            </kbd>
          </span>
          <button
            type='button'
            data-rave-record
            aria-label={`Hold ${key === '⌥' ? 'Option' : 'Alt'}, or press and hold here, to reveal the pad board`}
            className='record-glyph press grid size-5 place-items-center rounded-full'
          >
            <svg viewBox='0 0 14 14' className='size-[14px]' aria-hidden>
              <circle cx='7' cy='7' r='6.5' fill='currentColor' />
              <circle
                cx='7'
                cy='7'
                r='4.5'
                fill='none'
                stroke='var(--color-bg)'
                strokeOpacity='.35'
                strokeWidth='.6'
              />
              <circle className='record-label' cx='7' cy='7' r='2' fill='var(--color-bg)' />
            </svg>
          </button>
        </span>
      </span>
    </footer>
  )
}

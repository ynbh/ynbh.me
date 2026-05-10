'use client'

import cn from 'clsx'
import { Fragment } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

import ThemeToggle from './theme-toggle'

const items: { href: string; label: string }[] = [
  { href: '/', label: 'about' },
  { href: '/thoughts', label: 'thoughts' },
  { href: '/projects', label: 'projects' },
  { href: '/resume', label: 'resume' },
]

function Item({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href + '/'))

  return (
    <Link
      href={href}
      draggable={false}
      className={cn(
        'transition-colors',
        isActive
          ? 'text-rurikon-800'
          : 'text-rurikon-300 hover:text-rurikon-600',
        'focus-visible:outline focus-visible:outline-rurikon-400',
        'focus-visible:rounded-xs focus-visible:outline-dotted'
      )}
    >
      {label}
    </Link>
  )
}

export default function Navbar() {
  return (
    <header className='flex flex-col items-center gap-3 text-center'>
      <Link
        href='/'
        draggable={false}
        className='text-rurikon-800 font-semibold text-lg tracking-tight no-underline'
      >
        Yashas Bhat
      </Link>
      <nav className='flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm lowercase'>
        {items.map((item, i) => (
          <Fragment key={item.href}>
            {i > 0 && <span aria-hidden className='text-rurikon-300 select-none'>·</span>}
            <Item {...item} />
          </Fragment>
        ))}
        <span aria-hidden className='text-rurikon-300 select-none'>·</span>
        <ThemeToggle />
      </nav>
    </header>
  )
}

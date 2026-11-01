'use client'

import cn from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items: { href: string; label: string }[] = [
  { href: '/', label: 'About' },
  { href: '/thoughts', label: 'Thoughts' },
  { href: '/projects', label: 'Projects' },
  { href: '/resume', label: 'Resume' },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header className='flex items-baseline justify-between gap-6'>
      <Link
        href='/'
        draggable={false}
        data-rave-name
        className='shrink-0 whitespace-nowrap font-medium text-ink'
      >
        Yashas Bhat
      </Link>
      <nav className='flex gap-4 text-[13px] sm:gap-5'>
        {items.map(({ href, label }) => {
          const active =
            pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              draggable={false}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'transition-colors duration-150',
                active ? 'text-ink' : 'text-ink3 hover:text-ink2'
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}

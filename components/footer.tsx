import Link from 'next/link'

const links: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: 'https://github.com/ynbh',
    label: 'GitHub',
    icon: (
      <svg viewBox='0 0 24 24' aria-hidden className='w-[18px] h-[18px]' fill='currentColor'>
        <path d='M12 .5C5.73.5.75 5.48.75 11.75c0 4.97 3.22 9.18 7.69 10.66.56.1.77-.24.77-.54 0-.27-.01-1.16-.02-2.11-3.13.68-3.79-1.34-3.79-1.34-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.71 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .94-.3 3.08 1.16.9-.25 1.86-.38 2.82-.38.96 0 1.92.13 2.82.38 2.14-1.46 3.08-1.16 3.08-1.16.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.28-5.15 5.56.4.34.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.06 0 .3.2.65.78.54 4.46-1.49 7.68-5.69 7.68-10.66C23.25 5.48 18.27.5 12 .5z' />
      </svg>
    ),
  },
  {
    href: 'https://www.linkedin.com/in/yashasnbhat',
    label: 'LinkedIn',
    icon: (
      <svg viewBox='0 0 24 24' aria-hidden className='w-[18px] h-[18px]' fill='currentColor'>
        <path d='M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.05-1.86-3.05-1.86 0-2.15 1.45-2.15 2.95v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.86 3.38-1.86 3.61 0 4.28 2.38 4.28 5.47v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z' />
      </svg>
    ),
  },
  {
    href: 'mailto:ybhat@umd.edu',
    label: 'Email',
    icon: (
      <svg viewBox='0 0 24 24' aria-hidden className='w-[18px] h-[18px]' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round'>
        <rect x='3' y='5' width='18' height='14' rx='2' />
        <path d='m3 7 9 6 9-6' />
      </svg>
    ),
  },
]

export default function Footer() {
  return (
    <footer className='mt-20 pt-10 border-t border-rurikon-border flex items-center justify-center gap-5 text-rurikon-300'>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-label={l.label}
          target={l.href.startsWith('http') ? '_blank' : undefined}
          rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          className='hover:text-rurikon-700 transition-colors no-underline'
        >
          {l.icon}
        </Link>
      ))}
    </footer>
  )
}

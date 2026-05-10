'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    setMounted(true)
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <button
      type='button'
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className='text-rurikon-300 hover:text-rurikon-600 transition-colors leading-none'
      suppressHydrationWarning
    >
      {mounted ? (isDark ? 'light' : 'dark') : 'theme'}
    </button>
  )
}

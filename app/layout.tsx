import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'

// @ts-expect-error types are not available yet?
import { ViewTransition } from 'react'

import cn from 'clsx'
import localFont from 'next/font/local'
import { Geist, Geist_Mono } from 'next/font/google'
import 'katex/dist/katex.min.css'

import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--sans',
  display: 'swap',
})

const serif = localFont({
  src: './_fonts/LoraItalicVariable.woff2',
  preload: true,
  variable: '--serif',
})

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ynbh.me'),
  title: {
    template: '%s - Yashas Bhat',
    default: 'Yashas Bhat',
  },
  description:
    'Computer science student at the University of Maryland building backend systems, developer tools, and AI workflows.',
  openGraph: {
    type: 'website',
    siteName: 'Yashas Bhat',
    title: 'Yashas Bhat',
    description:
      'Computer science student at the University of Maryland building backend systems, developer tools, and AI workflows.',
    url: '/',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yashas Bhat',
    description:
      'Computer science student at the University of Maryland building backend systems, developer tools, and AI workflows.',
    images: ['/opengraph-image'],
  },
}

export const viewport: Viewport = {
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfc' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0b0d' },
  ],
}

// Runs synchronously at the top of <body> before any paint. Default is dark;
// flips to light only if the user explicitly chose light. Wrapped in IIFE so
// nothing leaks; try/catch in case localStorage is blocked (private mode, etc).
const themeInitScript = `
(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang='en'
      className='dark overflow-x-hidden touch-manipulation'
      suppressHydrationWarning
    >
      <body
        className={cn(
          geistSans.variable,
          serif.variable,
          mono.variable,
          'min-h-screen w-full',
          'text-sm leading-6 sm:text-[15px] sm:leading-7 md:text-base md:leading-7',
          'text-rurikon-500',
          'antialiased'
        )}
      >
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
          suppressHydrationWarning
        />
        <div className='fixed h-10 sm:h-14 w-full top-0 left-0 z-30 pointer-events-none content-fade-out' />
        <div className='mx-auto max-w-2xl px-6 sm:px-10 pt-10 sm:pt-14 pb-16 flex flex-col min-h-screen'>
          <Navbar />
          <main className='relative flex-1 mt-10 sm:mt-14'>
            <ViewTransition name='crossfade'>
              <article>
                {children}
              </article>
            </ViewTransition>
          </main>
          <Footer />
        </div>
        <Analytics />
      </body>
    </html>
  )
}

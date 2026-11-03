import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'

// @ts-expect-error types are not available yet?
import { ViewTransition } from 'react'

import cn from 'clsx'
import localFont from 'next/font/local'
import { Geist_Mono } from 'next/font/google'
import 'katex/dist/katex.min.css'

import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import Rave from '@/components/rave/rave'
import './globals.css'

const sans = localFont({
  src: './_fonts/InterVariable.woff2',
  variable: '--sans',
  display: 'swap',
  preload: true,
})

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--mono',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
const metadataBase = new URL(
  siteUrl
    ? siteUrl.startsWith('http')
      ? siteUrl
      : `https://${siteUrl}`
    : 'https://ynbh.me',
)

export const metadata: Metadata = {
  metadataBase,
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
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0c' },
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
          sans.variable,
          mono.variable,
          'min-h-screen w-full text-[15px] leading-[1.6] antialiased'
        )}
      >
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
          suppressHydrationWarning
        />
        <div
          data-rave-content
          className='mx-auto flex min-h-screen w-full max-w-[640px] flex-col px-6 pt-16 pb-12 sm:px-8 sm:pt-24 sm:pb-16'>
          <Navbar />
          <main className='relative mt-10 flex-1'>
            <ViewTransition name='crossfade'>
              <article>{children}</article>
            </ViewTransition>
          </main>
          <Footer />
        </div>
        <Rave />
        <Analytics />
      </body>
    </html>
  )
}

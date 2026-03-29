import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'

// @ts-expect-error types are not available yet?
import { ViewTransition } from 'react'

import cn from 'clsx'
import localFont from 'next/font/local'
import { Google_Sans_Code, TikTok_Sans } from 'next/font/google'
import 'katex/dist/katex.min.css'

import Navbar from '@/components/navbar'
import './globals.css'

const tiktokSans = TikTok_Sans({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['opsz'],
  variable: '--sans',
  display: 'swap',
})

const serif = localFont({
  src: './_fonts/LoraItalicVariable.woff2',
  preload: true,
  variable: '--serif',
})

const mono = Google_Sans_Code({
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
  colorScheme: 'only light',
  themeColor: '#fcfcfc',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en' className='overflow-x-hidden touch-manipulation'>
      <body
        className={cn(
          tiktokSans.variable,
          serif.variable,
          mono.variable,
          'w-full p-6 sm:p-10 md:p-14',
          'text-sm leading-6 sm:text-[15px] sm:leading-7 md:text-base md:leading-7',
          'text-rurikon-500',
          'antialiased'
        )}
      >
        <div className='fixed sm:hidden h-6 sm:h-10 md:h-14 w-full top-0 left-0 z-30 pointer-events-none content-fade-out' />
        <div className='flex flex-col mobile:flex-row'>
          <Navbar />
          <main className='relative flex-1 max-w-2xl [contain:inline-size]'>
            <div className='absolute w-full h-px opacity-50 bg-rurikon-border right-0 mobile:right-auto mobile:left-0 mobile:w-px mobile:h-full mobile:opacity-100 mix-blend-multiply' />
            <ViewTransition name='crossfade'>
              <article className='pl-0 pt-6 mobile:pt-0 mobile:pl-6 sm:pl-10 md:pl-14'>
                {children}
              </article>
            </ViewTransition>
          </main>
        </div>
        <Analytics />
      </body>
    </html>
  )
}

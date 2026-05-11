import { renderOgImage } from './_og/template'

export const alt = 'Yashas Bhat'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return renderOgImage({
    eyebrow: 'ynbh.me',
    meta: 'maryland · cs · 2027',
    title: 'Yashas Bhat',
    accent: 'Bhat',
    description:
      'cs student at umd building backend systems, dev tools, and AI workflows.',
    footLeft: 'github.com/ynbh',
    footRight: 'ynbh.me',
  })
}

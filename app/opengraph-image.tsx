import { renderOgImage } from './_og/template'

export const alt = 'Yashas Bhat'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return renderOgImage({
    title: 'Yashas Bhat',
    description:
      'CS student at University of Maryland building backend systems and developer tools.',
  })
}

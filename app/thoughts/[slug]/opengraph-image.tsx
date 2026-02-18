import { renderOgImage } from '@/app/_og/template'

export const alt = 'Thoughts by Yashas Bhat'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

function formatSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default async function Image(props: {
  params: Promise<{
    slug: string
  }>
}) {
  const { slug } = await props.params
  const module = await import('../_articles/' + `${slug}.mdx`)
  const metadata = module.metadata ?? {}

  return renderOgImage({
    eyebrow: 'Thoughts',
    title: metadata.title ?? formatSlug(slug),
    description: metadata.description,
  })
}

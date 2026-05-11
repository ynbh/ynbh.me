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

function formatDate(input?: string): string | undefined {
  if (!input) return undefined
  const normalized = input.replaceAll('.', '-')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return input
  return date
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    .toLowerCase()
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
    eyebrow: 'ynbh.me',
    meta: formatDate(metadata.date) ?? 'thoughts',
    title: metadata.title ?? formatSlug(slug),
    description: metadata.description,
    footLeft: 'ynbh.me/thoughts',
    footRight: 'yashas bhat',
  })
}

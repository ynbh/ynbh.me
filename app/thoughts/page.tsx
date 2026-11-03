import { promises as fs } from 'fs'
import { Row, Rows } from '@/components/row'
import path from 'path'

export const metadata = {
  title: 'Thoughts',
}

// In the future we can have a pagination here e.g. /1/*.mdx
const articlesDirectory = path.join(
  process.cwd(),
  'app',
  'thoughts',
  '_articles'
)

export default async function Page() {
  const articles = await fs.readdir(articlesDirectory)

  const items = []
  for (const article of articles) {
    if (!article.endsWith('.mdx')) continue
    const module = await import('./_articles/' + article)

    if (!module.metadata) throw new Error('Missing `metadata` in ' + article)
    if (module.metadata.draft) continue

    items.push({
      slug: article.replace(/\.mdx$/, ''),
      title: module.metadata.title,
      description: module.metadata.description as string | undefined,
      date: module.metadata.date || '-',
      sort: Number(String(module.metadata.date ?? '').replace(/\D/g, '') || 0),
    })
  }
  items.sort((a, b) => b.sort - a.sort)

  return (
    <div className='enter'>
      <h1 className='mb-3 text-[13px] font-normal text-ink3'>Writing</h1>
      <Rows>
        {items.map((item) => (
          <Row
            key={item.slug}
            href={`/thoughts/${item.slug}`}
            title={item.title}
            sub={item.description}
            meta={formatDate(item.date)}
          />
        ))}
      </Rows>
    </div>
  )
}

function formatDate(date: string) {
  const d = new Date(date + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

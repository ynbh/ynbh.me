import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import { codeToHtml } from 'shiki'
import Link from 'next/link'
import Image from 'next/image'

// @ts-ignore
import { InlineMath, BlockMath } from 'react-katex'

import { Card } from '@/components/tweet-card'
import { BlockSideTitle } from '@/components/block-sidetitle'

export const components: Record<
  string,
  (props: any) => ReactNode | Promise<ReactNode>
> = {
  h1: (props) => (
    <h1 className='mb-6 font-medium text-ink text-balance' {...props} />
  ),
  h2: (props) => (
    <h2 className='mt-12 mb-3 font-medium text-ink text-balance' {...props} />
  ),
  h3: (props) => (
    <h3 className='mt-10 mb-3 text-[13px] font-normal text-ink3' {...props} />
  ),
  ul: (props) => (
    <ul
      className='mt-4 list-disc list-outside pl-5 marker:text-ink3 [&>li+li]:mt-1'
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className='mt-4 list-decimal list-outside pl-5 marker:text-ink3 [&>li+li]:mt-1'
      {...props}
    />
  ),
  li: (props) => <li className='pl-1' {...props} />,
  a: ({ href, ...props }) => {
    return (
      <Link
        className='link break-words'
        href={href}
        draggable={false}
        {...(href?.startsWith('https://') || href?.startsWith('http://')
          ? {
            target: '_blank',
            rel: 'noopener noreferrer',
          }
          : {})}
        {...props}
      />
    )
  },
  strong: (props) => <strong className='font-medium text-ink' {...props} />,
  em: (props) => <em className='not-italic text-ink' {...props} />,
  p: (props) => <p className='mt-4' {...props} />,
  blockquote: (props) => <blockquote className='mt-4' {...props} />,
  pre: (props) => (
    <pre className='mt-4 whitespace-pre md:whitespace-pre-wrap' {...props} />
  ),
  code: async (props) => {
    if (typeof props.children === 'string') {
      const code = await codeToHtml(props.children, {
        lang: 'jsx',
        themes: {
          light: 'vitesse-light',
          dark: 'vitesse-dark',
        },
        defaultColor: false,
        transformers: [
          {
            pre: (hast) => {
              if (hast.children.length !== 1) {
                throw new Error('<pre>: Expected a single <code> child')
              }
              if (hast.children[0].type !== 'element') {
                throw new Error('<pre>: Expected a <code> child')
              }
              return hast.children[0]
            },
            postprocess(html) {
              return html.replace(/^<code>|<\/code>$/g, '')
            },
          },
        ],
      })

      return (
        <code
          className='inline shiki-host'
          dangerouslySetInnerHTML={{ __html: code }}
        />
      )
    }

    return <code className='inline' {...props} />
  },
  Card,
  Image,
  img: async ({ src, alt, title }) => {
    let img: React.ReactNode
    const isSvg = src.endsWith('.svg')

    if (src.startsWith('https://')) {
      img = (
        <Image
          className='mt-6'
          src={src}
          alt={alt}
          quality={95}
          placeholder={isSvg ? undefined : 'blur'}
          draggable={false}
        />
      )
    } else {
      const image = await import('./assets/images/' + src)
      img = (
        <Image
          className='mt-6'
          src={image.default}
          alt={alt}
          quality={95}
          placeholder={isSvg ? undefined : 'blur'}
          draggable={false}
        />
      )
    }

    if (title) {
      return <BlockSideTitle title={title}>{img}</BlockSideTitle>
    }

    return img
  },
  // Whitespace separates sections; the divider itself stays invisible.
  hr: (props) => <hr className='my-4 border-0' {...props} />,
  BlockSideTitle,
  InlineMath,
  BlockMath,
}

export function useMDXComponents(inherited: MDXComponents): MDXComponents {
  return {
    ...inherited,
    ...(components as any),
  }
}

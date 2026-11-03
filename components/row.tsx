import cn from 'clsx'
import Link from 'next/link'

/**
 * The single row pattern used everywhere on the site:
 * [logo] title · secondary ………… meta
 *                description (optional)
 */
export function Row({
  href,
  title,
  sub,
  meta,
  desc,
  logo,
}: {
  href?: string
  title: string
  sub?: string
  meta?: string
  desc?: string
  logo?: string
}) {
  const external = href?.startsWith('http')
  const content = (
    <>
      {logo && (
        <img
          src={logo}
          alt=''
          width={20}
          height={20}
          className={cn(
            'size-5 shrink-0 rounded-[5px] bg-white object-contain p-[2px] ring-1 ring-hair',
            desc ? 'mt-px' : 'self-center'
          )}
        />
      )}
      <span className='min-w-0 flex-1'>
        <span className='font-medium text-ink'>{title}</span>
        {sub && <span className='text-ink3'> {sub}</span>}
        {meta && <span className='meta text-ink3 sm:hidden'> · {meta}</span>}
        {desc && (
          <span className='mt-0.5 block text-[14px] leading-[1.55] text-ink2'>
            {desc}
          </span>
        )}
      </span>
      {meta && (
        <span className={cn('meta hidden shrink-0 text-ink3 sm:block', desc && 'mt-0.5')}>
          {meta}
        </span>
      )}
    </>
  )

  const className = cn(
    'row -mx-2 flex gap-3 rounded-lg px-2 py-1.5',
    desc ? 'items-start' : 'items-baseline'
  )

  if (!href) {
    return (
      <div className={className}>
        {content}
      </div>
    )
  }

  return (
    <Link
      href={href}
      draggable={false}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {content}
    </Link>
  )
}

export function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className='mt-14'>
      <h2 className='mb-3 text-[13px] font-normal text-ink3'>
        {label}
      </h2>
      {children}
    </section>
  )
}

export function Rows({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-col gap-1'>{children}</div>
}

export function ExternalArrow() {
  return (
    <svg
      viewBox='0 0 10 10'
      aria-hidden
      className='ml-1 inline-block size-2 align-[1px] opacity-55'
    >
      <path
        d='M3 1h6v6M9 1L1 9'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.4'
      />
    </svg>
  )
}

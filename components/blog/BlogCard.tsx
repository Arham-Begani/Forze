import Link from 'next/link'
import { formatRelativeDate } from '@/components/blog/format-date'

interface BlogCardProps {
  slug: string
  title: string
  description: string
  featuredImage?: string | null
  authorName: string
  publishedAt: string | null
  viewCount: number
}

export function BlogCard({
  slug,
  title,
  description,
  featuredImage,
  authorName,
  publishedAt,
  viewCount,
}: BlogCardProps) {
  const publishedLabel = publishedAt ? formatRelativeDate(publishedAt) : 'Freshly published'
  const hasImage = Boolean(featuredImage)
  const featuredImageSrc = featuredImage ?? undefined

  return (
    <article className='group h-full'>
      <Link
        href={`/blog/${slug}`}
        className='flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-black/10 bg-white/88 shadow-[0_20px_60px_-34px_rgba(42,24,10,0.42)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(42,24,10,0.48)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c07a3a] focus-visible:ring-offset-2 dark:border-white/10 dark:bg-[#15120f]/88 dark:shadow-[0_26px_70px_-34px_rgba(0,0,0,0.72)] dark:focus-visible:ring-[#d4924a] dark:focus-visible:ring-offset-[#110f0c]'
      >
        <div className='relative aspect-[4/3] overflow-hidden border-b border-black/5 bg-[#eadfce] dark:border-white/10 dark:bg-[#1b1714]'>
          {hasImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredImageSrc}
                alt={title}
                className='h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]'
                loading='lazy'
              />
              <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent' />
            </>
          ) : (
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(192,122,58,0.34),_transparent_42%),linear-gradient(135deg,#f3e7d7_0%,#f8f3ea_52%,#efe3d3_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(212,146,74,0.22),_transparent_38%),linear-gradient(135deg,#18120e_0%,#221912_48%,#120e0b_100%)]'>
              <div className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/20' />
              <div className='flex h-full flex-col justify-between p-5'>
                <span className='w-fit rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7a4f29] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-[#f0c998]'>
                  Forze Journal
                </span>
                <div className='space-y-2'>
                  <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8a6340] dark:text-[#d7b18a]'>
                    Founder brief
                  </p>
                  <p className='max-w-[13rem] text-sm leading-6 text-[#5d4b3d] dark:text-[#ddc8b4]'>
                    Practical writing on validation, launch timing, and sharper early-stage decisions.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            className={
              hasImage
                ? 'absolute inset-x-0 bottom-0 flex items-center justify-between px-5 pb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-white/82'
                : 'absolute inset-x-0 bottom-0 flex items-center justify-between px-5 pb-4 text-[11px] font-medium uppercase tracking-[0.22em] text-[#7b614d] dark:text-[#cab39d]'
            }
          >
            <span>Essay</span>
            <time dateTime={publishedAt ?? undefined}>{publishedLabel}</time>
          </div>
        </div>

        <div className='flex flex-1 flex-col gap-4 p-6'>
          <div className='flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-[#8a7460] dark:text-[#a28d79]'>
            <span className='truncate'>{authorName}</span>
            <span className='h-px w-8 bg-black/10 dark:bg-white/10' />
            <span>{viewCount.toLocaleString()} views</span>
          </div>

          <div className='space-y-3'>
            <h3 className='text-[1.45rem] font-semibold leading-[1.15] tracking-[-0.03em] text-[#19120d] transition-colors group-hover:text-[#9f5f2c] dark:text-[#fbf3e8] dark:group-hover:text-[#efb46f]'>
              {title}
            </h3>
            <p className='line-clamp-3 text-[0.98rem] leading-7 text-[#625142] dark:text-[#c6b6a6]'>
              {description}
            </p>
          </div>

          <div className='mt-auto flex items-center justify-between border-t border-black/5 pt-4 text-sm font-medium text-[#9f5f2c] dark:border-white/10 dark:text-[#efb46f]'>
            <span>Open article</span>
            <span aria-hidden='true' className='transition-transform duration-300 group-hover:translate-x-1'>
              {'->'}
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}

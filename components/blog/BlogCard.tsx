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
  return (
    <article className='group flex flex-col overflow-hidden rounded-lg border border-[#e8e4dc] bg-white transition-shadow hover:shadow-md dark:border-[#272523] dark:bg-[#0d0d0c]'>
      {featuredImage && (
        <Link href={`/blog/${slug}`} className='block h-48 w-full overflow-hidden bg-[#f4f2ed] dark:bg-[#111110]'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={featuredImage}
            alt={title}
            className='h-full w-full object-cover transition-transform group-hover:scale-[1.02]'
            loading='lazy'
          />
        </Link>
      )}

      <div className='flex flex-1 flex-col p-6'>
        <Link href={`/blog/${slug}`} className='mb-2 block'>
          <h3 className='text-lg font-semibold text-gray-900 transition-colors hover:text-[#c07a3a] dark:text-gray-50 dark:hover:text-[#d4924a]'>
            {title}
          </h3>
        </Link>

        <p className='mb-4 line-clamp-3 text-sm text-gray-600 dark:text-gray-400'>
          {description}
        </p>

        <div className='mt-auto flex items-center justify-between text-xs text-gray-500 dark:text-gray-500'>
          <div className='flex items-center gap-2'>
            <span>{authorName}</span>
            {publishedAt && (
              <>
                <span>·</span>
                <time dateTime={publishedAt}>{formatRelativeDate(publishedAt)}</time>
              </>
            )}
          </div>
          <span>{viewCount.toLocaleString()} views</span>
        </div>

        <Link
          href={`/blog/${slug}`}
          className='mt-4 inline-block text-sm font-medium text-[#c07a3a] hover:underline dark:text-[#d4924a]'
        >
          Read more →
        </Link>
      </div>
    </article>
  )
}

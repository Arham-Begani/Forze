import type { Metadata } from 'next'
import { listPublishedBlogPosts } from '@/lib/queries/blog-queries'
import { BlogCard } from '@/components/blog/BlogCard'
import Link from 'next/link'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://forze.in'

export const metadata: Metadata = {
  title: 'Blog | Forze — Startup Validation & Launch',
  description:
    'Learn how non-technical founders validate ideas, build MVPs, and scale startups. Tips, strategies, and real founder stories from the Forze team.',
  alternates: { canonical: `${BASE_URL}/blog` },
  openGraph: {
    title: 'Blog | Forze',
    description: 'Startup validation insights from the Forze team',
    url: `${BASE_URL}/blog`,
    type: 'website',
  },
}

// Next.js 16 delivers searchParams as a Promise on RSC pages.
type PageProps = { searchParams: Promise<{ page?: string }> }

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams
  const parsedPage = Number.parseInt(pageParam ?? '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const { posts, total, pageSize } = await listPublishedBlogPosts(page, 12)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <main className='min-h-screen bg-[#faf9f6] dark:bg-[#111110]'>
      <section className='mx-auto max-w-4xl px-6 py-16 text-center'>
        <p className='mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#c07a3a] dark:text-[#d4924a]'>
          Forze Blog
        </p>
        <h1 className='mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 md:text-5xl'>
          Startup validation, on the record
        </h1>
        <p className='text-lg text-gray-600 dark:text-gray-400'>
          How founders validate ideas, ship MVPs, and move with evidence — not hope.
        </p>
      </section>

      <section className='mx-auto max-w-6xl px-6 pb-20'>
        {posts.length === 0 ? (
          <div className='rounded-lg border border-dashed border-[#e8e4dc] p-12 text-center text-gray-500 dark:border-[#272523]'>
            <p>No posts yet. Check back soon.</p>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {posts.map((post) => (
              <BlogCard
                key={post.id}
                slug={post.slug}
                title={post.title}
                description={post.description}
                featuredImage={post.featured_image_url}
                authorName={post.author_name}
                publishedAt={post.published_at}
                viewCount={post.view_count}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className='mt-12 flex justify-center gap-2' aria-label='Pagination'>
            {Array.from({ length: totalPages }).map((_, i) => {
              const n = i + 1
              const active = n === page
              return (
                <Link
                  key={n}
                  href={n === 1 ? '/blog' : `/blog?page=${n}`}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'rounded-md bg-[#c07a3a] px-4 py-2 text-sm font-medium text-white dark:bg-[#d4924a]'
                      : 'rounded-md border border-[#e8e4dc] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-[#f4f2ed] dark:border-[#272523] dark:bg-[#0d0d0c] dark:text-gray-200 dark:hover:bg-[#111110]'
                  }
                >
                  {n}
                </Link>
              )
            })}
          </nav>
        )}
      </section>

      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Forze Blog',
            url: `${BASE_URL}/blog`,
            publisher: {
              '@type': 'Organization',
              name: 'Forze',
              url: BASE_URL,
            },
          }),
        }}
      />
    </main>
  )
}

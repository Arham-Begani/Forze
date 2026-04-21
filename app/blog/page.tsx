import type { Metadata } from 'next'
import Link from 'next/link'
import { BlogCard } from '@/components/blog/BlogCard'
import { formatRelativeDate } from '@/components/blog/format-date'
import { listPublishedBlogPosts } from '@/lib/queries/blog-queries'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') || 'https://forze.in'

export const metadata: Metadata = {
  title: 'Blog | Forze - Startup Validation & Launch',
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

type PageProps = { searchParams: Promise<{ page?: string }> }

export default async function BlogIndexPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams
  const parsedPage = Number.parseInt(pageParam ?? '1', 10)
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const { posts, total, pageSize } = await listPublishedBlogPosts(page, 12)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const featuredPost = posts[0] ?? null
  const remainingPosts = featuredPost ? posts.slice(1) : []
  const featuredHasImage = Boolean(featuredPost?.featured_image_url)
  const editorialPillars = ['Validation', 'Positioning', 'Launch strategy']
  const pageSummary =
    page === 1 ? 'New essays, practical playbooks, and founder-grade breakdowns.' : `Page ${page} of the archive.`

  return (
    <main className='relative min-h-screen overflow-hidden bg-[#f5efe5] text-[#17110c] dark:bg-[#110f0c] dark:text-[#f8efe4]'>
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <div className='absolute left-[-12rem] top-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(192,122,58,0.16)_0%,_transparent_68%)] blur-3xl dark:bg-[radial-gradient(circle,_rgba(212,146,74,0.13)_0%,_transparent_68%)]' />
        <div className='absolute right-[-10rem] top-0 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,_rgba(66,56,42,0.10)_0%,_transparent_68%)] blur-3xl dark:bg-[radial-gradient(circle,_rgba(255,255,255,0.06)_0%,_transparent_68%)]' />
      </div>

      <section className='relative border-b border-black/8 dark:border-white/8'>
        <div className='mx-auto max-w-6xl px-6 py-16 md:py-20'>
          <div className='grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end'>
            <div className='max-w-3xl'>
              <p className='mb-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#9f5f2c] dark:text-[#efb46f]'>
                Forze Journal
              </p>
              <h1 className='max-w-4xl text-5xl font-semibold leading-[0.94] tracking-[-0.06em] md:text-7xl'>
                Field notes for founders building with evidence.
              </h1>
              <p className='mt-6 max-w-2xl text-lg leading-8 text-[#5e5043] dark:text-[#c4b3a2]'>
                {pageSummary} Sharp writing on validation, positioning, MVP scope, and the
                decisions that keep early-stage teams out of the guesswork trap.
              </p>
            </div>

            <div className='space-y-4'>
              <div className='rounded-[1.75rem] border border-black/10 bg-white/70 p-5 shadow-[0_20px_50px_-34px_rgba(42,24,10,0.35)] backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:shadow-[0_20px_50px_-34px_rgba(0,0,0,0.6)]'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b6d55] dark:text-[#aa937e]'>
                  Library
                </p>
                <p className='mt-3 text-3xl font-semibold tracking-[-0.05em]'>{total}</p>
                <p className='mt-2 text-sm leading-6 text-[#645243] dark:text-[#c4b3a2]'>
                  Published essays for founders thinking about market proof before product
                  sprawl.
                </p>
              </div>

              <div className='flex flex-wrap gap-2'>
                {editorialPillars.map((pillar) => (
                  <span
                    key={pillar}
                    className='rounded-full border border-black/10 bg-white/65 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[#735a45] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-[#d5c0ab]'
                  >
                    {pillar}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className='relative mx-auto max-w-6xl px-6 py-12 md:py-16'>
        {featuredPost ? (
          <div className='space-y-14'>
            <div className='grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:items-stretch'>
              <Link
                href={`/blog/${featuredPost.slug}`}
                className='group relative overflow-hidden rounded-[2rem] border border-black/10 bg-[#eadfce] shadow-[0_30px_80px_-38px_rgba(42,24,10,0.46)] transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c07a3a] focus-visible:ring-offset-2 dark:border-white/10 dark:bg-[#1a1612] dark:shadow-[0_32px_80px_-38px_rgba(0,0,0,0.72)] dark:focus-visible:ring-[#d4924a] dark:focus-visible:ring-offset-[#110f0c]'
              >
                <div className='relative min-h-[24rem]'>
                  {featuredPost.featured_image_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={featuredPost.featured_image_url}
                        alt={featuredPost.title}
                        className='absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]'
                      />
                      <div className='absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/10' />
                    </>
                  ) : (
                    <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(192,122,58,0.34),_transparent_40%),linear-gradient(135deg,#f3e7d7_0%,#f8f4ec_54%,#eadfce_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(212,146,74,0.24),_transparent_36%),linear-gradient(135deg,#17120f_0%,#221912_52%,#120d0a_100%)]' />
                  )}
                  <div className='absolute inset-0 flex flex-col justify-end p-7 md:p-10'>
                    <span
                      className={
                        featuredHasImage
                          ? 'mb-5 w-fit rounded-full border border-white/18 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/85 backdrop-blur-md'
                          : 'mb-5 w-fit rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7c532c] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-[#efb46f]'
                      }
                    >
                      Lead story
                    </span>
                    <h2
                      className={
                        featuredHasImage
                          ? 'max-w-2xl text-3xl font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-5xl'
                          : 'max-w-2xl text-3xl font-semibold leading-[1.02] tracking-[-0.05em] text-[#1b130d] md:text-5xl dark:text-[#f8efe4]'
                      }
                    >
                      {featuredPost.title}
                    </h2>
                  </div>
                </div>
              </Link>

              <div className='flex flex-col justify-between rounded-[2rem] border border-black/10 bg-white/72 p-7 shadow-[0_24px_70px_-38px_rgba(42,24,10,0.34)] backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:shadow-[0_28px_70px_-38px_rgba(0,0,0,0.68)] md:p-8'>
                <div>
                  <div className='flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8d7158] dark:text-[#aa937e]'>
                    <span>{featuredPost.author_name}</span>
                    <span className='h-px w-8 bg-black/10 dark:bg-white/10' />
                    <time dateTime={featuredPost.published_at ?? undefined}>
                      {featuredPost.published_at
                        ? formatRelativeDate(featuredPost.published_at)
                        : 'Freshly published'}
                    </time>
                  </div>

                  <p className='mt-6 text-base leading-8 text-[#625243] dark:text-[#c7b8a8]'>
                    {featuredPost.description}
                  </p>

                  <div className='mt-8 grid gap-3 sm:grid-cols-2'>
                    <div className='rounded-[1.25rem] border border-black/8 bg-black/[0.02] p-4 dark:border-white/8 dark:bg-white/[0.03]'>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d7158] dark:text-[#aa937e]'>
                        Reach
                      </p>
                      <p className='mt-2 text-2xl font-semibold tracking-[-0.04em]'>
                        {featuredPost.view_count.toLocaleString()}
                      </p>
                      <p className='mt-1 text-sm text-[#6d5948] dark:text-[#bda996]'>Readers so far</p>
                    </div>
                    <div className='rounded-[1.25rem] border border-black/8 bg-black/[0.02] p-4 dark:border-white/8 dark:bg-white/[0.03]'>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d7158] dark:text-[#aa937e]'>
                        Format
                      </p>
                      <p className='mt-2 text-2xl font-semibold tracking-[-0.04em]'>Essay</p>
                      <p className='mt-1 text-sm text-[#6d5948] dark:text-[#bda996]'>Strategy with founder context</p>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className='mt-8 inline-flex w-fit items-center gap-3 rounded-full bg-[#17110c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#9f5f2c] dark:bg-[#f5eadb] dark:text-[#17110c] dark:hover:bg-[#efb46f]'
                >
                  Read the full essay
                  <span aria-hidden='true'>{'->'}</span>
                </Link>
              </div>
            </div>

            {remainingPosts.length > 0 ? (
              <div className='space-y-6'>
                <div className='flex flex-col gap-2 md:flex-row md:items-end md:justify-between'>
                  <div>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.3em] text-[#9f5f2c] dark:text-[#efb46f]'>
                      Archive
                    </p>
                    <h2 className='mt-2 text-3xl font-semibold tracking-[-0.05em]'>
                      More for the operator&apos;s desk
                    </h2>
                  </div>
                  <p className='max-w-xl text-sm leading-6 text-[#6a594a] dark:text-[#baa794]'>
                    A tighter read on positioning, MVP decisions, and how to avoid building
                    with borrowed conviction.
                  </p>
                </div>

                <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
                  {remainingPosts.map((post) => (
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
              </div>
            ) : null}
          </div>
        ) : (
          <div className='rounded-[2rem] border border-dashed border-black/10 bg-white/60 p-12 text-center text-[#6a594a] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-[#baa794]'>
            <p>No posts yet. Check back soon.</p>
          </div>
        )}

        {totalPages > 1 && (
          <nav className='mt-14 flex flex-wrap justify-center gap-3' aria-label='Pagination'>
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
                      ? 'rounded-full bg-[#17110c] px-5 py-3 text-sm font-semibold text-white dark:bg-[#f5eadb] dark:text-[#17110c]'
                      : 'rounded-full border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#5e5043] backdrop-blur-sm transition hover:border-[#c07a3a]/40 hover:text-[#9f5f2c] dark:border-white/10 dark:bg-white/5 dark:text-[#d5c0ab] dark:hover:border-[#d4924a]/40 dark:hover:text-[#efb46f]'
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

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BlogCard } from '@/components/blog/BlogCard'
import { BlogSchemaMarkup, generateBlogMetadata } from '@/components/blog/BlogMeta'
import { estimateReadingTimeFromHtml, formatAbsoluteDate } from '@/components/blog/format-date'
import {
  getPublishedBlogPostBySlug,
  getRelatedBlogPosts,
  incrementBlogViewCount,
} from '@/lib/queries/blog-queries'

type RouteParams = { slug: string }
type PageProps = { params: Promise<RouteParams> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPublishedBlogPostBySlug(slug)
  if (!post) return {}

  return generateBlogMetadata({
    title: post.meta_title,
    description: post.meta_description,
    slug,
    ogImage: post.og_image_url,
    canonicalUrl: post.canonical_url,
    publishedAt: post.published_at,
    authorName: post.author_name,
  })
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = await getPublishedBlogPostBySlug(slug)
  if (!post) notFound()

  incrementBlogViewCount(post.id).catch((err) =>
    console.error('[blog/[slug]] view increment failed:', err)
  )

  const related = await getRelatedBlogPosts(post, 3)
  const publishedIso = post.published_at ?? post.created_at
  const readingTime = estimateReadingTimeFromHtml(post.content)
  const topicLabels = [
    post.primary_keyword,
    ...(post.secondary_keywords ?? []).filter(Boolean).slice(0, 2),
  ].filter(Boolean) as string[]
  const internalLinks = post.internal_links ?? []

  return (
    <main className='relative min-h-screen overflow-hidden bg-[#f5efe5] text-[#17110c] dark:bg-[#110f0c] dark:text-[#f8efe4]'>
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <div className='absolute left-[-14rem] top-10 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(192,122,58,0.15)_0%,_transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,_rgba(212,146,74,0.12)_0%,_transparent_70%)]' />
        <div className='absolute right-[-10rem] top-32 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(47,38,29,0.10)_0%,_transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,_rgba(255,255,255,0.06)_0%,_transparent_70%)]' />
      </div>

      <article className='relative'>
        <section className='border-b border-black/8 dark:border-white/8'>
          <div className='mx-auto max-w-6xl px-6 pb-12 pt-8 md:pb-16 md:pt-10'>
            <Link
              href='/blog'
              className='inline-flex items-center gap-2 text-sm font-medium text-[#7e6651] transition hover:text-[#9f5f2c] dark:text-[#b79f8b] dark:hover:text-[#efb46f]'
            >
              <span aria-hidden='true'>&lt;-</span>
              <span>Back to all posts</span>
            </Link>

            <div className='mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end'>
              <div>
                <p className='text-[11px] font-semibold uppercase tracking-[0.34em] text-[#9f5f2c] dark:text-[#efb46f]'>
                  Forze Journal
                </p>
                <h1 className='mt-4 max-w-4xl text-4xl font-semibold leading-[0.96] tracking-[-0.06em] md:text-6xl'>
                  {post.title}
                </h1>
                <p className='mt-6 max-w-3xl text-lg leading-8 text-[#5f5143] dark:text-[#c4b3a2]'>
                  {post.description}
                </p>

                {topicLabels.length > 0 && (
                  <div className='mt-8 flex flex-wrap gap-2'>
                    {topicLabels.map((topic) => (
                      <span
                        key={topic}
                        className='rounded-full border border-black/10 bg-white/65 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-[#765d48] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-[#d5c0ab]'
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}

                <div className='mt-8 flex flex-wrap items-center gap-4 text-sm text-[#6a594a] dark:text-[#bda996]'>
                  <div className='flex items-center gap-3'>
                    {post.author_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.author_photo_url}
                        alt={post.author_name}
                        className='h-12 w-12 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/10'
                      />
                    ) : (
                      <div className='flex h-12 w-12 items-center justify-center rounded-full bg-[#17110c] text-sm font-semibold uppercase text-white dark:bg-[#f5eadb] dark:text-[#17110c]'>
                        {post.author_name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <p className='font-medium text-[#1e1711] dark:text-[#f8efe4]'>{post.author_name}</p>
                      <p>{formatAbsoluteDate(publishedIso)}</p>
                    </div>
                  </div>

                  <span className='hidden h-1 w-1 rounded-full bg-black/20 dark:bg-white/20 md:block' />
                  <span>{readingTime}</span>
                  <span className='hidden h-1 w-1 rounded-full bg-black/20 dark:bg-white/20 md:block' />
                  <span>{post.view_count.toLocaleString()} views</span>
                </div>
              </div>

              <div className='rounded-[1.75rem] border border-black/10 bg-white/72 p-6 shadow-[0_24px_70px_-38px_rgba(42,24,10,0.32)] backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:shadow-[0_26px_70px_-38px_rgba(0,0,0,0.66)]'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8d7158] dark:text-[#aa937e]'>
                  At a glance
                </p>
                <div className='mt-5 space-y-4 text-sm leading-6 text-[#5f5143] dark:text-[#c4b3a2]'>
                  <p>This essay is built for founders who want a cleaner decision path before they commit capital and months of build time.</p>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='rounded-[1rem] border border-black/8 bg-black/[0.02] p-4 dark:border-white/8 dark:bg-white/[0.03]'>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d7158] dark:text-[#aa937e]'>
                        Read
                      </p>
                      <p className='mt-2 text-xl font-semibold tracking-[-0.04em] text-[#1c140f] dark:text-[#f8efe4]'>
                        {readingTime}
                      </p>
                    </div>
                    <div className='rounded-[1rem] border border-black/8 bg-black/[0.02] p-4 dark:border-white/8 dark:bg-white/[0.03]'>
                      <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8d7158] dark:text-[#aa937e]'>
                        Audience
                      </p>
                      <p className='mt-2 text-xl font-semibold tracking-[-0.04em] text-[#1c140f] dark:text-[#f8efe4]'>
                        Founders
                      </p>
                    </div>
                  </div>
                  {internalLinks.length > 0 ? (
                    <p>Continue through the cluster with related reads linked alongside the article and at the end of the page.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {post.featured_image_url && (
          <section className='relative mx-auto max-w-6xl px-6 pt-10 md:pt-12'>
            <div className='overflow-hidden rounded-[2rem] border border-black/10 shadow-[0_30px_80px_-38px_rgba(42,24,10,0.44)] dark:border-white/10 dark:shadow-[0_32px_80px_-38px_rgba(0,0,0,0.72)]'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.featured_image_url}
                alt={post.title}
                className='h-auto max-h-[34rem] w-full object-cover'
              />
            </div>
          </section>
        )}

        <section className='mx-auto max-w-6xl px-6 py-10 md:py-14'>
          <div className='grid gap-12 lg:grid-cols-[16rem_minmax(0,1fr)]'>
            <aside className='hidden lg:block'>
              <div className='sticky top-24 space-y-5'>
                <div className='rounded-[1.5rem] border border-black/10 bg-white/65 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-white/5'>
                  <p className='text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8d7158] dark:text-[#aa937e]'>
                    Article details
                  </p>
                  <dl className='mt-4 space-y-4 text-sm'>
                    <div>
                      <dt className='text-[#8d7158] dark:text-[#aa937e]'>Published</dt>
                      <dd className='mt-1 font-medium text-[#1d150f] dark:text-[#f8efe4]'>
                        {formatAbsoluteDate(publishedIso)}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-[#8d7158] dark:text-[#aa937e]'>Reading time</dt>
                      <dd className='mt-1 font-medium text-[#1d150f] dark:text-[#f8efe4]'>
                        {readingTime}
                      </dd>
                    </div>
                    <div>
                      <dt className='text-[#8d7158] dark:text-[#aa937e]'>Views</dt>
                      <dd className='mt-1 font-medium text-[#1d150f] dark:text-[#f8efe4]'>
                        {post.view_count.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>

                {internalLinks.length > 0 && (
                  <div className='rounded-[1.5rem] border border-black/10 bg-white/65 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-white/5'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.26em] text-[#8d7158] dark:text-[#aa937e]'>
                      Continue reading
                    </p>
                    <ul className='mt-4 space-y-3 text-sm leading-6'>
                      {internalLinks.map((link, i) => (
                        <li key={`${link.slug}-${i}`}>
                          <Link
                            href={`/blog/${link.slug}`}
                            className='text-[#8a531f] transition hover:text-[#c07a3a] dark:text-[#e0b07a] dark:hover:text-[#efb46f]'
                          >
                            {link.anchor_text}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>

            <div className='space-y-8'>
              <div className='rounded-[2rem] border border-black/10 bg-white/82 p-6 shadow-[0_28px_70px_-40px_rgba(42,24,10,0.34)] backdrop-blur-md dark:border-white/10 dark:bg-[#181410]/82 dark:shadow-[0_32px_70px_-40px_rgba(0,0,0,0.72)] md:p-10 lg:p-12'>
                <div
                  className='blog-content text-[#241b14] dark:text-[#efe4d8]'
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />
              </div>

              {internalLinks.length > 0 && (
                <aside className='rounded-[1.75rem] border border-black/10 bg-white/70 p-6 shadow-[0_20px_60px_-36px_rgba(42,24,10,0.26)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:shadow-[0_24px_60px_-36px_rgba(0,0,0,0.62)] lg:hidden'>
                  <h2 className='text-lg font-semibold tracking-[-0.03em]'>Keep reading</h2>
                  <ul className='mt-4 space-y-3 text-sm leading-6'>
                    {internalLinks.map((link, i) => (
                      <li key={`${link.slug}-${i}`}>
                        <Link
                          href={`/blog/${link.slug}`}
                          className='text-[#8a531f] transition hover:text-[#c07a3a] dark:text-[#e0b07a] dark:hover:text-[#efb46f]'
                        >
                          {link.anchor_text} {'->'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}

              <section className='rounded-[1.75rem] border border-black/10 bg-[#17110c] p-8 text-white shadow-[0_28px_70px_-40px_rgba(42,24,10,0.52)] dark:border-white/10 dark:bg-[#f3e8d8] dark:text-[#17110c] dark:shadow-[0_30px_70px_-40px_rgba(0,0,0,0.58)]'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.3em] text-white/65 dark:text-[#6d5844]'>
                  Next step
                </p>
                <h2 className='mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.05em]'>
                  Turn the idea into evidence before you turn it into scope.
                </h2>
                <p className='mt-4 max-w-2xl text-base leading-7 text-white/78 dark:text-[#564637]'>
                  Forze is built for the work that happens before a product team gets expensive:
                  validating the market, tightening positioning, and deciding what actually deserves to be built.
                </p>
                <a
                  href='https://forze.in'
                  className='mt-6 inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#17110c] transition hover:bg-[#f1d4b0] dark:bg-[#17110c] dark:text-white dark:hover:bg-[#2a2019]'
                >
                  Start with Forze
                  <span aria-hidden='true'>{'->'}</span>
                </a>
              </section>
            </div>
          </div>
        </section>
      </article>

      {related.length > 0 && (
        <section className='border-t border-black/8 bg-[#eee4d7] dark:border-white/8 dark:bg-[#15120f]'>
          <div className='mx-auto max-w-6xl px-6 py-16'>
            <div className='mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between'>
              <div>
                <p className='text-[11px] font-semibold uppercase tracking-[0.3em] text-[#9f5f2c] dark:text-[#efb46f]'>
                  Related reads
                </p>
                <h2 className='mt-2 text-3xl font-semibold tracking-[-0.05em]'>
                  More posts in the same lane
                </h2>
              </div>
              <p className='max-w-xl text-sm leading-6 text-[#6a594a] dark:text-[#baa794]'>
                Keep the thread going with a few nearby essays pulled from the same topic cluster.
              </p>
            </div>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
              {related.map((relatedPost) => (
                <BlogCard
                  key={relatedPost.id}
                  slug={relatedPost.slug}
                  title={relatedPost.title}
                  description={relatedPost.description}
                  featuredImage={relatedPost.featured_image_url}
                  authorName={relatedPost.author_name}
                  publishedAt={relatedPost.published_at}
                  viewCount={relatedPost.view_count}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <BlogSchemaMarkup
        title={post.meta_title}
        description={post.meta_description}
        slug={slug}
        ogImage={post.og_image_url}
        canonicalUrl={post.canonical_url}
        publishedAt={publishedIso}
        modifiedAt={post.updated_at}
        authorName={post.author_name}
      />
    </main>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getPublishedBlogPostBySlug,
  getRelatedBlogPosts,
  incrementBlogViewCount,
} from '@/lib/queries/blog-queries'
import { BlogCard } from '@/components/blog/BlogCard'
import { BlogSchemaMarkup, generateBlogMetadata } from '@/components/blog/BlogMeta'
import { formatAbsoluteDate } from '@/components/blog/format-date'

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

  // Fire-and-forget view counter. Errors are swallowed so a broken metrics
  // path doesn't 500 the page.
  incrementBlogViewCount(post.id).catch((err) =>
    console.error('[blog/[slug]] view increment failed:', err)
  )

  const related = await getRelatedBlogPosts(post, 3)
  const publishedIso = post.published_at ?? post.created_at

  return (
    <main className='min-h-screen bg-[#faf9f6] dark:bg-[#111110]'>
      <article className='mx-auto max-w-3xl px-6 py-12'>
        <div className='mb-6'>
          <Link
            href='/blog'
            className='text-sm text-gray-500 hover:text-[#c07a3a] dark:text-gray-400 dark:hover:text-[#d4924a]'
          >
            ← All posts
          </Link>
        </div>

        <header className='mb-8'>
          <h1 className='mb-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 md:text-5xl'>
            {post.title}
          </h1>

          <p className='mb-6 text-lg text-gray-600 dark:text-gray-400'>{post.description}</p>

          <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-500'>
            <span className='font-medium text-gray-700 dark:text-gray-300'>
              {post.author_name}
            </span>
            <span>·</span>
            <time dateTime={publishedIso}>{formatAbsoluteDate(publishedIso)}</time>
            <span>·</span>
            <span>{post.view_count.toLocaleString()} views</span>
          </div>
        </header>

        {post.featured_image_url && (
          <div className='mb-10 overflow-hidden rounded-lg'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.featured_image_url}
              alt={post.title}
              className='h-auto max-h-[28rem] w-full object-cover'
            />
          </div>
        )}

        <div
          className='blog-content mb-12 text-gray-800 dark:text-gray-200'
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.internal_links && post.internal_links.length > 0 && (
          <aside className='mb-12 rounded-lg border border-[#e8e4dc] bg-white p-6 dark:border-[#272523] dark:bg-[#0d0d0c]'>
            <h2 className='mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50'>
              Keep reading
            </h2>
            <ul className='space-y-2 text-sm'>
              {post.internal_links.map((link, i) => (
                <li key={`${link.slug}-${i}`}>
                  <Link
                    href={`/blog/${link.slug}`}
                    className='text-[#c07a3a] hover:underline dark:text-[#d4924a]'
                  >
                    {link.anchor_text} →
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </article>

      {related.length > 0 && (
        <section className='border-t border-[#e8e4dc] bg-[#f4f2ed] dark:border-[#272523] dark:bg-[#0d0d0c]'>
          <div className='mx-auto max-w-6xl px-6 py-16'>
            <h2 className='mb-8 text-2xl font-bold text-gray-900 dark:text-gray-50'>
              More posts like this
            </h2>
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

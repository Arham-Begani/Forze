import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { TestimonialsDashboardClient } from '@/components/venture/TestimonialsDashboardClient'

export const metadata: Metadata = {
  title: 'Testimonials | Forze',
}

export default async function TestimonialsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAuth()
  const { id } = await params
  const venture = await getVenture(id, session.userId)
  if (!venture) notFound()

  return (
    <Suspense fallback={<div className="p-8 text-[var(--text-soft)]">Loading testimonials...</div>}>
      <TestimonialsDashboardClient venture={{ id: venture.id, name: venture.name }} />
    </Suspense>
  )
}

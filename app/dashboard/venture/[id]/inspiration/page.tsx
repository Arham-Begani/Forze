import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { InspirationStudio } from '@/components/venture/InspirationStudio'

export const metadata: Metadata = {
  title: 'Generate from Inspiration | Forze',
}

export default async function InspirationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAuth()
  const { id } = await params
  const venture = await getVenture(id, session.userId)
  if (!venture) notFound()

  const appliedTokens =
    (venture.context as unknown as Record<string, unknown> | null)?.inspirationTokens ?? null

  return (
    <Suspense fallback={<div className="p-8 text-[var(--text-soft)]">Loading inspiration studio…</div>}>
      <InspirationStudio
        venture={{ id: venture.id, name: venture.name }}
        appliedTokens={appliedTokens}
      />
    </Suspense>
  )
}

// app/dashboard/venture/[id]/page.tsx
import { requireAuth } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { VentureDashboard } from '@/components/venture/VentureDashboard'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Venture Dashboard | Forge',
}

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await requireAuth()
    const { id } = await params

    const venture = await getVenture(id, session.userId)
    if (!venture) notFound()

    return <VentureDashboard venture={venture as any} />
}

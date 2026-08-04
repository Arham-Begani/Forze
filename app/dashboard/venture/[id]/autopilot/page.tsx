import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireAuth } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { AutopilotDashboard } from '@/components/venture/AutopilotDashboard'

export const metadata: Metadata = {
    title: 'Autopilot | Forze',
}

export default async function AutopilotPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await requireAuth()
    const { id } = await params

    const venture = await getVenture(id, session.userId)
    if (!venture) notFound()

    return (
        <Suspense fallback={<div className="p-8 text-[var(--text-soft)]">Loading Autopilot...</div>}>
            <AutopilotDashboard ventureId={id} ventureName={venture.name} />
        </Suspense>
    )
}

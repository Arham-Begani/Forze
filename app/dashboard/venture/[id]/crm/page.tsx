import { Suspense } from 'react'
import { requireAuth } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { CrmDashboardClient } from '@/components/venture/CrmDashboardClient'

export const metadata: Metadata = {
    title: 'CRM | Forze',
}

export default async function CrmPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await requireAuth()
    const { id } = await params

    const venture = await getVenture(id, session.userId)
    if (!venture) notFound()

    return (
        <Suspense fallback={<div className="p-8 text-[var(--text-soft)]">Loading CRM...</div>}>
            <CrmDashboardClient venture={venture as any} />
        </Suspense>
    )
}

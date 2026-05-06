import { requireAuth } from '@/lib/auth'
import { getVenture } from '@/lib/queries'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { CrmDashboard } from '@/components/venture/CrmDashboard'

export const metadata: Metadata = {
  title: 'CRM Dashboard | Forze',
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

  return <CrmDashboard ventureId={id} ventureName={venture.name} />
}

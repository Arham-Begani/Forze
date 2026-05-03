import { marketingErrorResponse, requireMarketingVenture } from '@/lib/marketing-api'
import { uploadUserSuppliedInstagramImage } from '@/lib/marketing-image-gen'
import { NextRequest, NextResponse } from 'next/server'

const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/jpg'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { venture } = await requireMarketingVenture(id)

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Attach a file under "file"' }, { status: 400 })
    }

    const blob = file as File
    const mime = (blob.type || '').toLowerCase()
    if (!ACCEPTED.has(mime)) {
      return NextResponse.json({ error: 'Only PNG and JPG images are accepted' }, { status: 415 })
    }

    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 8 MB or smaller' }, { status: 413 })
    }

    const buffer = Buffer.from(await blob.arrayBuffer())
    const url = await uploadUserSuppliedInstagramImage(buffer, mime, venture.name)
    return NextResponse.json({ url })
  } catch (error) {
    return marketingErrorResponse(error)
  }
}

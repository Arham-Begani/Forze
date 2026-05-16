import { getConversationsByModule, getVentureBySubdomain } from '@/lib/queries'
import { isRenderableLandingComponent, resolveLandingComponent } from '@/lib/landing-page'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ subdomain: string }> }
) {
    const { subdomain } = await params

    const venture = await getVentureBySubdomain(subdomain)
    if (!venture) {
        return NextResponse.json({ error: 'Venture not found' }, { status: 404 })
    }

    const context = venture.context as Record<string, any> | null
    const contextLanding = context?.landing
    const landingConversations = await getConversationsByModule(venture.id, 'landing').catch(() => [])
    const latestLandingConversation = landingConversations.find((conversation) => {
        const result = conversation.result as Record<string, any> | null
        const candidate = result?.landing || result
        return isRenderableLandingComponent(candidate?.fullComponent)
    })

    const conversationLanding = latestLandingConversation
        ? ((latestLandingConversation.result as Record<string, any>)?.landing ||
            (latestLandingConversation.result as Record<string, any>))
        : null

    const landing = conversationLanding || contextLanding

    if (!landing) {
        return NextResponse.json(
            { error: 'Landing page not yet generated for this venture' },
            { status: 404 }
        )
    }

    const branding = context?.branding as Record<string, any> | undefined
    const fullComponent = resolveLandingComponent({
        ventureName: branding?.brandName || venture.name,
        fullComponent: landing.fullComponent,
        landingPageCopy: landing.landingPageCopy,
        seoMetadata: landing.seoMetadata,
        colorPalette: branding?.colorPalette,
    })

    return NextResponse.json({
        id: venture.id,
        name: venture.name,
        landing: {
            fullComponent,
            seoMetadata: landing.seoMetadata || {},
            landingPageCopy: landing.landingPageCopy || {},
            deploymentUrl: landing.deploymentUrl || contextLanding?.deploymentUrl,
        },
    })
}

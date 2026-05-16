import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Wildcard subdomain routing ───────────────────────────────────────────────
//
// Each venture has a `subdomain` (e.g. "feedflow") that resolves to
// <subdomain>.<APP_HOST> — for example feedflow.forze.in. When a tenant
// subdomain hits the app, rewrite to /sites/[subdomain] so the App Router
// can render the venture's published landing page.
//
// Local development:
//   Most modern browsers route *.localhost to 127.0.0.1 automatically. If
//   yours doesn't, add `127.0.0.1   test.localhost` to your OS hosts file
//   and visit http://test.localhost:3000.

function getBaseHost(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    return new URL(raw).host.split(':')[0].toLowerCase()
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').split(':')[0]
  }
}

function extractSubdomain(hostHeader: string): string | null {
  const hostname = (hostHeader || '').split(':')[0].toLowerCase()
  if (!hostname) return null

  const baseHost = getBaseHost()

  let subdomain: string | null = null
  if (hostname.endsWith(`.${baseHost}`)) {
    subdomain = hostname.slice(0, -(baseHost.length + 1))
  } else if (hostname.endsWith('.localhost')) {
    subdomain = hostname.slice(0, -'.localhost'.length)
  }

  if (!subdomain || subdomain === 'www' || subdomain.includes('.')) return null
  return subdomain
}

export async function proxy(request: NextRequest) {
  // Tenant subdomain → rewrite to /sites/[subdomain] and skip auth.
  // The /sites/[subdomain] page fetches the venture by slug and is public.
  // Skip rewriting for /api, /_next, and already-rewritten /sites paths so
  // landing-page API calls (lead capture, analytics, preview) still resolve.
  const subdomain = extractSubdomain(request.headers.get('host') || '')
  if (subdomain) {
    const { pathname } = request.nextUrl
    const passthrough =
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/sites/') ||
      pathname === '/favicon.ico'

    if (!passthrough) {
      const url = request.nextUrl.clone()
      url.pathname = `/sites/${subdomain}`
      return NextResponse.rewrite(url)
    }
    // For API requests on a tenant subdomain, let them flow through without
    // touching Supabase auth — these are public landing-page endpoints.
    if (pathname.startsWith('/api/')) {
      return NextResponse.next({ request })
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — required for Server Components to stay in sync
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protect all /dashboard routes
  if (pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  // Redirect logged-in users away from auth pages (but not auth callback/confirm routes)
  if ((pathname === '/signin' || pathname === '/signup') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Allow auth confirmation and callback routes to pass through without auth
  // (they handle their own verification logic)

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
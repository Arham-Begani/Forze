import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server component context — safe to ignore
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const targetPath = '/auth/callback?event=email_confirmed'
      const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL
      const safeOrigin = configuredOrigin ? new URL(configuredOrigin).origin : origin
      return NextResponse.redirect(`${safeOrigin}${targetPath}`)
    }
  }

  // Code exchange failed — redirect to sign in with error hint
  const url = request.nextUrl.clone()
  url.pathname = '/signin'
  url.searchParams.set('error', 'auth-code-error')
  return NextResponse.redirect(url)
}

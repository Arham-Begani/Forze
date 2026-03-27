import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE
    ?? process.env.SUPABASE_SERVICE_KEY

  if (!url || !serviceRole) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin billing operations')
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

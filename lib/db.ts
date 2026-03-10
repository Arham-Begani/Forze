import { createClient } from '@/lib/supabase/server'

// Re-export for use in query helpers
export async function createDb() {
  return createClient()
}

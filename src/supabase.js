import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://pcyrqifourjwirwfhiwe.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8Nlj9kEnB-Rj_nsxnv_YQg_poT8S9GH'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

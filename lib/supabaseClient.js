import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 開發環境暫時暴露到 window
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.supabase = supabase
}
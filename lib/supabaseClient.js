// 前端用的 Supabase client（只用 anon key）。
// 只用來做 Supabase Auth（登入、註冊、Google、重設密碼）；
// 資料庫的讀寫一律透過 pages/api/*（RLS 已關閉 anon 對資料表的存取，見 migration 025）。
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

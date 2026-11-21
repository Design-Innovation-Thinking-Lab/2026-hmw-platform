// 前端呼叫 pages/api/* 一律用 apiFetch：自動帶上 Supabase Auth 的 access token。
// 伺服器端（lib/auth.js）用這個 token 判斷是誰，不採信 body / query 裡的 userId。
import { supabase } from './supabaseClient'
import { clearLocalProfile } from './session'

export async function apiFetch(url, options = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token

  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...options, headers })

  // token 過期或沒登入：清掉本機快取並導回登入頁
  if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    clearLocalProfile()
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `/login?returnUrl=${returnUrl}`
  }

  return res
}

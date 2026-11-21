// 前端登入狀態的小工具。
// localStorage 裡的 userId / userName 只是「顯示用的快取」，不是驗證；
// 伺服器端每次都用 Supabase Auth 的 token 重新確認身分（lib/auth.js）。
import { supabase } from './supabaseClient'

const PROFILE_KEYS = [
  'userId', 'userName', 'userRole', 'userPermissions',
  'adminAuth', 'adminAuthTime', 'isAdmin',
]

export function clearLocalProfile() {
  if (typeof window === 'undefined') return
  PROFILE_KEYS.forEach(k => localStorage.removeItem(k))
}

/**
 * 登入後呼叫：向 /api/users/me 取得個人資料並寫入顯示用快取。
 * 回傳 user（含 profileComplete），沒有登入則回傳 null。
 */
export async function loadProfile() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) {
    clearLocalProfile()
    return null
  }

  const res = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    clearLocalProfile()
    return null
  }
  const { user } = await res.json()
  localStorage.setItem('userId', user.id)
  localStorage.setItem('userName', user.name || '')
  localStorage.setItem('userRole', user.role)
  localStorage.setItem('userPermissions', JSON.stringify(user.permissions || {}))
  return user
}

/**
 * 登入成功後要去哪裡：個人資料沒填完先去 /profile-setup。
 */
export function nextPathAfterLogin(user, returnUrl) {
  const safeReturn = typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
    ? returnUrl
    : '/dashboard'
  if (!user?.profileComplete) {
    return `/profile-setup?returnUrl=${encodeURIComponent(safeReturn)}`
  }
  return safeReturn
}

export async function logout() {
  try {
    await supabase.auth.signOut()
  } finally {
    clearLocalProfile()
  }
}

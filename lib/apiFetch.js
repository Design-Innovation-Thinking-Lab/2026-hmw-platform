// 前端呼叫自己的 /api/* 時用這個，取代 fetch。
// 會自動帶上 Supabase 的登入憑證（Authorization: Bearer <access_token>），
// 伺服器端用 lib/serverAuth.js 驗證憑證，判斷是誰、能做什麼。
// localStorage 裡的 userId、userRole 只拿來顯示畫面，伺服器不會相信。
import { supabase } from './supabaseClient'

// 舊版存在 localStorage 的登入資料；登入失效時一起清掉
const LOGIN_KEYS = ['userId', 'userName', 'adminAuth', 'adminAuthTime', 'isAdmin', 'userRole', 'userPermissions']

export function clearLocalLogin() {
    LOGIN_KEYS.forEach(key => localStorage.removeItem(key))
}

export async function apiFetch(url, options = {}) {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token

    const headers = new Headers(options.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const res = await fetch(url, { ...options, headers })

    // 沒登入或登入已失效：清掉舊的登入資料，回到登入頁
    if (res.status === 401 && typeof window !== 'undefined') {
        clearLocalLogin()
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        if (window.location.pathname !== '/login') {
            window.location.href = '/login'
        }
    }
    return res
}

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { loadProfile, nextPathAfterLogin } from '../../lib/session'

// Google 登入、Email 驗證信的連結都會回到這裡。
// Supabase client（detectSessionInUrl + PKCE）會自動用網址上的 code 換成 session。
export default function AuthCallbackPage() {
    const router = useRouter()
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!router.isReady) return
        let cancelled = false

        ;(async () => {
            const params = new URLSearchParams(window.location.search)
            if (params.get('error')) {
                setError('登入沒有完成，請再試一次')
                return
            }

            // getSession 會等 code 交換完成
            const { data } = await supabase.auth.getSession()
            if (cancelled) return
            if (!data?.session) {
                setError('登入連結已失效，請重新登入')
                return
            }

            const user = await loadProfile()
            if (cancelled) return
            if (!user) {
                setError('讀取帳號資料失敗，請重新登入')
                return
            }
            router.replace(nextPathAfterLogin(user, router.query.returnUrl))
        })()

        return () => { cancelled = true }
    }, [router.isReady])

    return (
        <div className="auth-page">
            <div className="auth-card">
                {error ? (
                    <>
                        <div className="alert alert-error">{error}</div>
                        <a href="/login" className="btn btn-primary btn-full">回到登入頁</a>
                    </>
                ) : (
                    <p className="auth-subtitle">登入中，請稍候…</p>
                )}
            </div>
        </div>
    )
}

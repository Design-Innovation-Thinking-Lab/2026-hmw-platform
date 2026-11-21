/**
 * GET /api/cron/worker — Vercel Cron 每分鐘呼叫一次（見 vercel.json），每次跑一輪分析工作。
 *
 * 執行時間上限 maxDuration 設在 vercel.json（800 秒），要和 CRON_MAX_DURATION_SECONDS 一致。
 * 只接受 Authorization: Bearer ${CRON_SECRET}（Vercel Cron 會自動帶上）。
 * 一個分析一輪跑不完時會暫停，下一輪接著跑（lib/analysis/cronRunner.js）。
 * 回應裡的 longestCallMs 是這一輪最長的一步（單次 LLM 呼叫，含重試）花了多久；
 * 每個分析最長的一步也存在 analysis_runs.longest_call_ms / longest_call_label。
 */
import crypto from 'crypto'
import { runWorkerTick, MAX_DURATION_SECONDS } from '../../../lib/analysis/cronRunner.js'

function isAuthorized(req) {
    const secret = process.env.CRON_SECRET
    if (!secret) return false
    const header = req.headers.authorization || ''
    const expected = `Bearer ${secret}`
    const a = Buffer.from(header)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    if (!process.env.CRON_SECRET) {
        console.error('CRON_SECRET is not set')
        return res.status(500).json({ error: 'Server misconfigured' })
    }
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
        const summary = await runWorkerTick({ budgetMs: MAX_DURATION_SECONDS * 1000 - 20 * 1000 })
        return res.status(200).json({ ok: true, ...summary })
    } catch (err) {
        console.error('Cron worker tick failed:', err)
        return res.status(500).json({ ok: false, error: 'Worker tick failed' })
    }
}

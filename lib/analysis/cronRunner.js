/**
 * lib/analysis/cronRunner.js — 跑「一輪」分析工作（只能在伺服器端使用）
 *
 * Vercel 不能跑常駐程式，所以改成 Vercel Cron 每分鐘呼叫 /api/cron/worker，
 * 每次呼叫跑一輪：
 *   1. 用 claim_analysis_runs（migration 026）原子地搶下幾個待執行的分析，並設定租約
 *   2. 執行到剩下的時間不夠再開始新的一步為止
 *   3. 時間不夠就暫停（放掉租約），下一輪接著跑；已經有結果的步驟／逐字稿會跳過
 *
 * 如果某一輪被 Vercel 中途砍掉（超過 maxDuration），租約過期後下一輪也會接手，
 * 但會記一次 crash_count；超過上限就標成失敗，避免同一步一直重跑、一直花錢。
 *
 * 本機開發用 server/worker.js 重複呼叫 runWorkerTick()，邏輯完全相同。
 */
import { createClient } from '@supabase/supabase-js'
import { runAnalysisFlow, PauseSignal, CancelSignal } from './engine.js'

let _supabase = null
function db() {
    if (!_supabase) {
        _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        })
    }
    return _supabase
}

function envInt(name, fallback) {
    const n = parseInt(process.env[name] || '', 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
}

// 要和 vercel.json 裡 /api/cron/worker 的 maxDuration 一致
export const MAX_DURATION_SECONDS = envInt('CRON_MAX_DURATION_SECONDS', 800)
// 留給收尾（存進度、回應）的時間
const SAFETY_MARGIN_MS = 20 * 1000
// 剩下的時間少於這個值就不再開始新的一步（實際會取「最近分析最長的一步 × 1.25 + 30 秒」和這個值的較大者）
const DEFAULT_MIN_REMAINING_MS = envInt('CRON_MIN_REMAINING_SECONDS', 300) * 1000
// 一輪最多同時跑幾個分析
const DEFAULT_MAX_RUNS = envInt('CRON_MAX_RUNS_PER_TICK', 3)
// 同一個分析被中途砍掉幾次之後就放棄
const MAX_CRASHES = envInt('CRON_MAX_CRASHES', 2)

/**
 * 從最近的分析算出「最長的一步」要預留多少時間。
 */
async function computeMinRemainingMs(budgetMs) {
    let observed = 0
    const { data } = await db()
        .from('analysis_runs')
        .select('longest_call_ms')
        .not('longest_call_ms', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)
    for (const row of data || []) observed = Math.max(observed, row.longest_call_ms || 0)
    const fromHistory = observed > 0 ? Math.round(observed * 1.25) + 30 * 1000 : 0
    // 上限是整輪時間的 90%：比這更長的一步本來就不可能在一輪內跑完
    return Math.min(Math.max(DEFAULT_MIN_REMAINING_MS, fromHistory), Math.round(budgetMs * 0.9))
}

function makeController(run, deadline, minRemainingMs, stats) {
    let longestMs = run.longest_call_ms || 0
    let lastCancelCheck = 0

    return {
        initialUsage: run.usage_summary || null,

        async checkpoint() {
            const remaining = deadline - Date.now()
            if (remaining < minRemainingMs) {
                throw new PauseSignal(`剩 ${Math.round(remaining / 1000)} 秒，少於預留的 ${Math.round(minRemainingMs / 1000)} 秒`)
            }
            // 最多每 5 秒查一次有沒有被取消
            if (Date.now() - lastCancelCheck > 5000) {
                lastCancelCheck = Date.now()
                const { data } = await db().from('analysis_runs').select('status').eq('id', run.id).maybeSingle()
                if (!data || data.status !== 'processing') throw new CancelSignal()
            }
        },

        async recordCall(ms, label) {
            if (ms > stats.longestCallMs) {
                stats.longestCallMs = ms
                stats.longestCallLabel = label
            }
            console.log(`   ⏱️  [run:${run.id.slice(0, 8)}] ${label}: ${(ms / 1000).toFixed(1)}s`)
            if (ms > longestMs) {
                longestMs = ms
                await db().from('analysis_runs')
                    .update({ longest_call_ms: ms, longest_call_label: label.slice(0, 500) })
                    .eq('id', run.id)
            }
        },
    }
}

async function failRun(run, message) {
    const { data } = await db().from('analysis_runs').update({
        status: 'failed',
        locked_until: null,
        finished_at: new Date().toISOString(),
        meta: { ...(run.meta || {}), error: message, user_message: message },
    }).eq('id', run.id).eq('status', 'processing').select('id')
    if ((data || []).length > 0 && run.room_id) {
        await db().from('research_rooms').update({ analysis_status: 'failed' }).eq('id', run.room_id)
    }
}

/**
 * 跑一輪。回傳這一輪的摘要（給 cron API 回應、寫 log）。
 *
 * @param {object} opts
 * @param {number} opts.budgetMs  這一輪最多可以用多久（預設 maxDuration − 20 秒）
 * @param {number} opts.maxRuns   最多同時跑幾個分析
 */
export async function runWorkerTick({ budgetMs, maxRuns } = {}) {
    const startedAt = Date.now()
    const budget = budgetMs || (MAX_DURATION_SECONDS * 1000 - SAFETY_MARGIN_MS)
    const deadline = startedAt + budget
    const leaseSeconds = Math.ceil(budget / 1000) + 60

    const minRemainingMs = await computeMinRemainingMs(budget)

    const { data: runs, error } = await db().rpc('claim_analysis_runs', {
        lease_seconds: leaseSeconds,
        max_runs: maxRuns || DEFAULT_MAX_RUNS,
    })
    if (error) throw new Error(`claim_analysis_runs failed: ${error.message}`)

    const stats = { longestCallMs: 0, longestCallLabel: null }
    const outcomes = await Promise.all((runs || []).map(async (run) => {
        if (run.crash_count > MAX_CRASHES) {
            const msg = `分析中斷了 ${run.crash_count} 次（某一步超過單次執行的時間上限約 ${MAX_DURATION_SECONDS} 秒），已停止。請聯繫管理員。`
            console.error(`❌ [run:${run.id.slice(0, 8)}] ${msg}`)
            await failRun(run, msg)
            return { runId: run.id, state: 'failed' }
        }
        console.log(`🚀 [run:${run.id.slice(0, 8)}] tick #${run.tick_count}${run.crash_count ? `（上一輪被中斷 ${run.crash_count} 次）` : ''}`)
        try {
            const controller = makeController(run, deadline, minRemainingMs, stats)
            const result = await runAnalysisFlow(run.project_id, run.id, run.room_id, controller)
            return { runId: run.id, state: result?.state || 'completed' }
        } catch (err) {
            // runAnalysisFlow 自己會處理錯誤；這裡是保險
            console.error(`❌ [run:${run.id.slice(0, 8)}] unexpected error`, err)
            await failRun(run, '分析過程發生錯誤，請重新執行分析')
            return { runId: run.id, state: 'failed' }
        }
    }))

    const summary = {
        claimed: outcomes.length,
        completed: outcomes.filter(o => o.state === 'completed').length,
        paused: outcomes.filter(o => o.state === 'paused').length,
        cancelled: outcomes.filter(o => o.state === 'cancelled').length,
        failed: outcomes.filter(o => o.state === 'failed').length,
        runs: outcomes,
        elapsedMs: Date.now() - startedAt,
        budgetMs: budget,
        minRemainingMs,
        longestCallMs: stats.longestCallMs,
        longestCallLabel: stats.longestCallLabel,
    }
    if (summary.claimed > 0) {
        console.log(`🧾 cron tick: ${JSON.stringify({ ...summary, runs: undefined })}`)
    }
    return summary
}

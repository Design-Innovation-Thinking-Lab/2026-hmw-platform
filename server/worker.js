/**
 * server/worker.js — 本機開發用的分析 worker
 *
 * 正式環境（Vercel）不能跑常駐程式，改由 Vercel Cron 每分鐘呼叫 /api/cron/worker。
 * 本機沒有 Vercel Cron，就用這支程式重複呼叫同一個 runWorkerTick()（lib/analysis/cronRunner.js），
 * 行為和正式環境一樣：每輪最多跑 CRON_MAX_DURATION_SECONDS（預設 800 秒），跑不完下一輪接著跑。
 *
 *   npm run worker                    # 一直輪詢
 *   WORKER_MODE=job npm run worker    # 只跑一輪就結束
 *
 * （舊版還會解析 files.status='uploaded' 的檔案，但現在已經沒有任何程式會產生這個狀態，已移除。）
 */
import { runWorkerTick } from '../lib/analysis/cronRunner.js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE config in env（請準備 .env.local）')
  process.exit(1)
}

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 5000)
const isJobMode = process.env.WORKER_MODE === 'job'

async function main() {
  console.log(`Worker started (mode: ${isJobMode ? 'job' : 'polling'})`)
  while (true) {
    try {
      await runWorkerTick()
    } catch (err) {
      console.error('Worker tick error', err)
      if (isJobMode) process.exit(1)
    }
    if (isJobMode) process.exit(0)
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main()

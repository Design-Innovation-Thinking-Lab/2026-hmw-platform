/**
 * server/worker.js - Minimal Background Worker
 *
 * Responsibilities:
 *  1. Parse uploaded files (status='uploaded' -> 'parsed')
 *  2. Run Analysis Flows (analysis_runs status='pending' -> 'completed')
 */
// 本地開發時載入 .env.local，Cloud Run 環境變數會直接注入
try {
  const dotenv = await import('dotenv')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  dotenv.default.config({ path: path.resolve(__dirname, '..', '.env.local') })
} catch (e) {
  // Cloud Run 環境不需要 dotenv
}
import { createClient } from '@supabase/supabase-js'
import { parseFileToParagraphs } from './parseWorker.js'
import { runAnalysisFlow } from '../lib/analysis/engine.js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE config in env')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 5000)
const MAX_CONCURRENT_ANALYSES = Number(process.env.MAX_CONCURRENT_ANALYSES || 15)
const MAX_CONCURRENT_FILES = Number(process.env.MAX_CONCURRENT_FILES || 3)

// Track active concurrent jobs
const activeAnalyses = new Map() // runId -> Promise
const activeFiles = new Map()    // fileId -> Promise

// --- FILE PARSING JOB ---

async function claimNextFile() {
  const { data: rows, error } = await supabaseAdmin
    .from('files')
    .select('*')
    .eq('status', 'uploaded')
    .limit(1)

  if (error || !rows || rows.length === 0) return null

  const file = rows[0]
  if (activeFiles.has(file.id)) return null

  const { data: updated, error: uerr } = await supabaseAdmin
    .from('files')
    .update({ status: 'processing' })
    .match({ id: file.id, status: 'uploaded' })
    .select()
    .single()

  return uerr ? null : updated
}

async function processFile(file) {
  try {
    console.log('Processing file', file.id, file.storage_path)
    const parsed = await parseFileToParagraphs({
      supabaseAdmin,
      bucket: file.bucket || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads',
      path: file.storage_path
    })

    if (parsed.paragraphs && parsed.paragraphs.length) {
      const rows = parsed.paragraphs.map(p => ({
        project_id: file.project_id,
        file_id: file.id,
        speaker: p.speaker || null,
        content: p.text,
      }))
      const { error: terr } = await supabaseAdmin.from('transcripts').insert(rows)
      if (terr) throw terr
    }

    await supabaseAdmin.from('files').update({ status: 'parsed' }).eq('id', file.id)
    console.log('File processed', file.id)
  } catch (err) {
    console.error('Error processing file', file.id, err)
    await supabaseAdmin.from('files').update({ status: 'error', meta: { error: String(err) } }).eq('id', file.id)
  }
}

// --- ANALYSIS JOB ---

async function claimNextAnalysisRun() {
  const { data: rows, error } = await supabaseAdmin
    .from('analysis_runs')
    .select('*')
    .eq('status', 'pending')
    .limit(1)

  if (error || !rows || rows.length === 0) return null

  const run = rows[0]
  if (activeAnalyses.has(run.id)) return null

  const { data: updated, error: uerr } = await supabaseAdmin
    .from('analysis_runs')
    .update({ status: 'processing' })
    .match({ id: run.id, status: 'pending' })
    .select()
    .single()

  return uerr ? null : updated
}

async function processAnalysisRun(run) {
  try {
    await runAnalysisFlow(run.project_id, run.id, run.room_id)
  } catch (e) {
    console.error('Unexpected error in analysis run', run.id, e)
  }
}


// --- ORPHANED JOB RECOVERY ---

/**
 * On startup, any job stuck in an in-progress state belongs to a previous
 * worker process that was killed (Heroku restarts the dyno on every deploy
 * and roughly every 24h). This deployment runs a single worker dyno, so
 * nothing can legitimately be in-progress at startup — reset orphans so they
 * get re-claimed and re-run cleanly.
 *
 * NOTE: this assumes a single worker. If the worker is ever scaled to >1
 * instance, this would clobber a sibling's in-flight jobs; a heartbeat/lease
 * mechanism would be needed instead.
 */
async function recoverOrphanedJobs() {
  // Analysis runs stuck in 'processing'
  const { data: orphanRuns, error: runErr } = await supabaseAdmin
    .from('analysis_runs')
    .select('id')
    .eq('status', 'processing')

  if (runErr) {
    console.error('Orphan recovery: failed to query analysis_runs', runErr)
  } else if (orphanRuns && orphanRuns.length > 0) {
    for (const run of orphanRuns) {
      // Wipe partial results so the re-run produces a clean, complete output
      await supabaseAdmin.from('analysis_results').delete().eq('analysis_run_id', run.id)
      await supabaseAdmin.from('analysis_runs').update({ status: 'pending' }).eq('id', run.id)
      console.log(`♻️  Recovered orphaned analysis run ${run.id} → pending`)
    }
    console.log(`♻️  Recovered ${orphanRuns.length} orphaned analysis run(s)`)
  }

  // Files stuck in 'processing'
  const { data: orphanFiles, error: fileErr } = await supabaseAdmin
    .from('files')
    .select('id')
    .eq('status', 'processing')

  if (fileErr) {
    console.error('Orphan recovery: failed to query files', fileErr)
  } else if (orphanFiles && orphanFiles.length > 0) {
    for (const file of orphanFiles) {
      // Wipe partial transcripts so re-parsing doesn't create duplicates
      await supabaseAdmin.from('transcripts').delete().eq('file_id', file.id)
      await supabaseAdmin.from('files').update({ status: 'uploaded' }).eq('id', file.id)
      console.log(`♻️  Recovered orphaned file ${file.id} → uploaded`)
    }
    console.log(`♻️  Recovered ${orphanFiles.length} orphaned file(s)`)
  }
}


// --- MAIN LOOP (concurrent) ---

async function runLoop() {
  const isJobMode = process.env.WORKER_MODE === 'job'
  console.log(`Worker started... (mode: ${isJobMode ? 'job' : 'polling'}, max concurrent analyses: ${MAX_CONCURRENT_ANALYSES}, max concurrent files: ${MAX_CONCURRENT_FILES})`)

  while (true) {
    try {
      let claimedWork = false

      // 1. Claim file parsing jobs up to available slots
      while (activeFiles.size < MAX_CONCURRENT_FILES) {
        const file = await claimNextFile()
        if (!file) break
        claimedWork = true
        const promise = processFile(file).finally(() => activeFiles.delete(file.id))
        activeFiles.set(file.id, promise)
      }

      // 2. Claim analysis runs up to available slots
      while (activeAnalyses.size < MAX_CONCURRENT_ANALYSES) {
        const job = await claimNextAnalysisRun()
        if (!job) break
        claimedWork = true
        console.log(`🚀 Claimed analysis run ${job.id} (active: ${activeAnalyses.size + 1}/${MAX_CONCURRENT_ANALYSES})`)
        const promise = processAnalysisRun(job).finally(() => {
          activeAnalyses.delete(job.id)
          console.log(`✅ Analysis run ${job.id} finished (active: ${activeAnalyses.size}/${MAX_CONCURRENT_ANALYSES})`)
        })
        activeAnalyses.set(job.id, promise)
      }

      // 3. No new work and nothing running
      if (!claimedWork && activeAnalyses.size === 0 && activeFiles.size === 0) {
        if (isJobMode) {
          console.log('Job mode: no more work, exiting.')
          process.exit(0)
        }
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

    } catch (err) {
      console.error('Worker loop error', err)
      if (isJobMode && activeAnalyses.size === 0 && activeFiles.size === 0) {
        process.exit(1)
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    }
  }
}

recoverOrphanedJobs()
  .catch(err => console.error('Orphan recovery failed (continuing anyway)', err))
  .then(() => runLoop())
  .catch(err => {
    console.error('Worker failed', err)
    process.exit(1)
  })
import { createClient } from '@supabase/supabase-js'
import nunjucks from 'nunjucks'
import { generateContent } from '../llm/claude.js'
import { smartPreprocess } from './smartInject.js'
import { processAttachments } from './attachmentProcessor.js'


// Lazy-initialize Supabase Admin Client
let _supabaseAdmin = null
function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in environment')
        }
        _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false }
        })
    }
    return _supabaseAdmin
}

// Configure Nunjucks with custom filters
const nunjucksEnv = new nunjucks.Environment(null, { autoescape: false })

// Register custom filters (not built-in to Nunjucks, but commonly used in templates)
nunjucksEnv.addFilter('tojson', (obj, indent) => {
    return JSON.stringify(obj, null, indent || 0)
})
nunjucksEnv.addFilter('dump', (obj) => {
    return JSON.stringify(obj, null, 2)
})

/**
 * Main entry point to run analysis for a project or room.
 * Executes steps in order, passing results from previous steps to the next.
 * Tracks token usage and execution time for each step.
 * 
 * @param {string} projectId - Project ID (optional if roomId is provided)
 * @param {string} analysisRunId - Analysis run ID
 * @param {string} roomId - Room ID for room-based analysis (optional)
 */
export async function runAnalysisFlow(projectId, analysisRunId, roomId = null) {
    const runStartTime = Date.now()

    // If roomId is provided but no projectId, fetch it from the room
    let effectiveProjectId = projectId
    if (roomId && !effectiveProjectId) {
        const { data: room } = await getSupabaseAdmin()
            .from('research_rooms')
            .select('project_id')
            .eq('id', roomId)
            .single()

        if (room?.project_id) {
            effectiveProjectId = room.project_id
        } else {
            console.error('Room has no associated project_id')
            throw new Error('Room has no associated project for analysis steps')
        }
    }

    const runTag = `[run:${analysisRunId.slice(0, 8)}]`

    console.log(`\n${'='.repeat(60)}`)
    console.log(`${runTag} 🚀 Starting Analysis Flow`)
    console.log(`${runTag}    Project: ${effectiveProjectId}`)
    console.log(`${runTag}    Run ID:  ${analysisRunId}`)
    console.log(`${runTag}    Room ID: ${roomId || 'N/A'}`)
    console.log(`${'='.repeat(60)}\n`)

    // Update status to processing
    await getSupabaseAdmin().from('analysis_runs').update({
        status: 'processing',
        started_at: new Date().toISOString()
    }).eq('id', analysisRunId)

    // Usage tracking for the entire run
    const usageSummary = {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalExecutionTimeMs: 0,
        stepUsage: {} // { stepIndex: { title, tokens, timeMs, apiCalls } }
    }

    try {
        // 1. Fetch Configuration (Steps with Roles)
        const { data: steps, error: stepError } = await getSupabaseAdmin()
            .from('analysis_flow_steps')
            .select('*, analysis_roles(*)')
            .eq('project_id', effectiveProjectId)
            .eq('is_active', true)
            .order('step_index', { ascending: true })

        if (stepError || !steps) {
            console.error('Error fetching steps', stepError)
            throw new Error('Failed to fetch analysis steps')
        }

        console.log(`📋 Found ${steps.length} active steps to execute`)

        // 2. Fetch Files/Transcripts
        // If roomId is provided, use room_transcripts; otherwise use files/transcripts
        let files = []

        if (roomId) {
            // Room-based analysis: fetch room_transcripts
            const { data: roomTranscripts, error: rtError } = await getSupabaseAdmin()
                .from('room_transcripts')
                .select('*')
                .eq('room_id', roomId)

            if (rtError) {
                console.error('Error fetching room transcripts', rtError)
                throw new Error('Failed to fetch room transcripts')
            }

            if (!roomTranscripts || roomTranscripts.length === 0) {
                console.log('⚠️ No room transcripts to analyze.')
                await getSupabaseAdmin().from('analysis_runs').update({
                    status: 'completed',
                    meta: { message: 'No transcripts to analyze' },
                    finished_at: new Date().toISOString()
                }).eq('id', analysisRunId)

                // Update room status
                await getSupabaseAdmin().from('research_rooms').update({
                    analysis_status: 'completed'
                }).eq('id', roomId)
                return
            }

            console.log(`📄 Found ${roomTranscripts.length} room transcripts to analyze`)

            // Convert room_transcripts to file-like structure for compatibility
            files = roomTranscripts.map(t => ({
                id: t.id,
                filename: t.file_name || `Transcript ${t.id.slice(0, 8)}`,
                transcripts: [{ speaker: 'Participant', content: t.content }],
                meta: { uploader_id: t.uploader_id, created_at: t.created_at }
            }))
        } else {
            // Project-based analysis: use files/transcripts
            const { data: projectFiles, error: fileError } = await getSupabaseAdmin()
                .from('files')
                .select('*, transcripts(*)')
                .eq('project_id', effectiveProjectId)
                .eq('status', 'parsed')

            if (fileError) {
                console.error('Error fetching files', fileError)
                throw new Error('Failed to fetch files')
            }

            if (!projectFiles || projectFiles.length === 0) {
                console.log('⚠️ No parsed files to analyze.')
                await getSupabaseAdmin().from('analysis_runs').update({
                    status: 'completed',
                    meta: { message: 'No files to analyze' },
                    finished_at: new Date().toISOString()
                }).eq('id', analysisRunId)
                return
            }

            console.log(`📁 Found ${projectFiles.length} files to analyze`)
            files = projectFiles
        }

        // 2.5 Fetch room research info (for room-based analysis)
        let researchContext = ''
        if (roomId) {
            const { data: roomInfo } = await getSupabaseAdmin()
                .from('research_rooms')
                .select('name, research_topic, research_purpose')
                .eq('id', roomId)
                .single()

            // Build file names list
            const fileNamesList = files.map((f, i) => `${i + 1}. ${f.filename}`).join('\n')

            if (roomInfo) {
                researchContext = `
【研究背景資訊】
研究主題：${roomInfo.research_topic || roomInfo.name || '未設定'}
研究目的：${roomInfo.research_purpose || '未設定'}

【受訪者/逐字稿列表】共 ${files.length} 份
${fileNamesList}

⚠️ 重要提醒：
1. 標註資料來源時，只能使用上方列出的實際受訪者/檔案名稱，不可虛構或使用不存在的名稱。
2. 當要求引用「受訪者原話」、「原始資料來源」或「逐字稿代表語句」時，請直接引用逐字稿中受訪者的實際發言內容（原文），而非僅列出檔案名稱。格式範例：「我覺得這個功能很難用」(來源：S01_逐字稿)

請在分析過程中始終以上述研究目的為導向。
`
                console.log(`📌 Research Topic: ${roomInfo.research_topic || roomInfo.name}`)
                console.log(`📄 Files: ${files.map(f => f.filename).join(', ')}`)
            }
        }

        // 3. Create a result store to track all results during this run
        const resultStore = {
            byStep: {},
            all: []
        }

        // 4. Execute Steps in Order
        const totalSteps = steps.length
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i]

            // Update progress in database
            await getSupabaseAdmin().from('analysis_runs').update({
                meta: {
                    total_steps: totalSteps,
                    current_step: step.step_index,
                    current_step_title: step.title,
                    progress_percent: Math.round((i / totalSteps) * 100)
                }
            }).eq('id', analysisRunId)

            console.log(`\n${'─'.repeat(50)}`)
            console.log(`📌 Step ${step.step_index}: ${step.title} (${i + 1}/${totalSteps})`)
            console.log(`   Scope: ${step.analysis_scope}`)
            console.log(`   Role: ${step.analysis_roles?.name || 'Default'}`)
            console.log(`${'─'.repeat(50)}`)

            const baseSystemPrompt = step.analysis_roles?.system_prompt ||
                'You are an expert analyst. Provide detailed, structured analysis.'

            // Automatically include research context in every step
            const systemPrompt = researchContext
                ? `${baseSystemPrompt}\n\n${researchContext}\n\n【語言要求】請全程使用繁體中文回覆。`
                : `${baseSystemPrompt}\n\n【語言要求】請全程使用繁體中文回覆。`

            // Initialize step usage tracking
            usageSummary.stepUsage[step.step_index] = {
                title: step.title,
                scope: step.analysis_scope,
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                executionTimeMs: 0,
                apiCalls: 0
            }

            if (step.analysis_scope === 'individual') {
                await processIndividualStep(
                    step, files, systemPrompt, effectiveProjectId, analysisRunId, resultStore, usageSummary, roomId
                )
            } else if (step.analysis_scope === 'collective') {
                await processCollectiveStep(
                    step, files, systemPrompt, effectiveProjectId, analysisRunId, resultStore, usageSummary, roomId
                )
            }

            // Log step summary
            const stepUsage = usageSummary.stepUsage[step.step_index]
            console.log(`   📊 Step Usage: ${stepUsage.totalTokens} tokens, ${stepUsage.executionTimeMs}ms, ${stepUsage.apiCalls} API calls`)
        }

        const totalRunTime = Date.now() - runStartTime
        usageSummary.totalExecutionTimeMs = totalRunTime

        console.log(`\n${'='.repeat(60)}`)
        console.log(`✅ Analysis Flow Completed Successfully`)
        console.log(`   Total Time: ${(totalRunTime / 1000).toFixed(2)}s`)
        console.log(`   Total Tokens: ${usageSummary.totalTokens}`)
        console.log(`${'='.repeat(60)}\n`)

        // Update status to completed
        const { error: updateError } = await getSupabaseAdmin().from('analysis_runs').update({
            status: 'completed',
            finished_at: new Date().toISOString(),
            usage_summary: usageSummary,
            meta: {
                total_steps: totalSteps,
                current_step: totalSteps,
                current_step_title: '分析完成',
                progress_percent: 100
            }
        }).eq('id', analysisRunId)

        if (updateError) {
            console.error('❌ Error updating analysis run status:', updateError)
        } else {
            console.log('✅ Analysis run status updated to completed')
        }

        // If room-based, update room status
        if (roomId) {
            const { error: roomError } = await getSupabaseAdmin().from('research_rooms').update({
                analysis_status: 'completed'
            }).eq('id', roomId)

            if (roomError) {
                console.error('❌ Error updating room status:', roomError)
            } else {
                console.log('✅ Room status updated to completed')
            }
        }

    } catch (err) {
        console.error('\n❌ Analysis Flow Failed:', err)
        const totalRunTime = Date.now() - runStartTime
        usageSummary.totalExecutionTimeMs = totalRunTime

        const userMessage = err.isRetryExhausted
            ? '分析因連線逾時中斷，請重新執行分析'
            : '分析過程發生錯誤，請重新執行分析'

        await getSupabaseAdmin().from('analysis_runs').update({
            status: 'failed',
            meta: { error: String(err), user_message: userMessage },
            finished_at: new Date().toISOString(),
            usage_summary: usageSummary
        }).eq('id', analysisRunId)

        // If room-based, update room status to failed
        if (roomId) {
            await getSupabaseAdmin().from('research_rooms').update({
                analysis_status: 'failed'
            }).eq('id', roomId)
        }
    }
}
/**
 * Retry wrapper for LLM API calls.
 * Retries up to maxAttempts times with exponential backoff.
 * Throws a retry-exhausted error if all attempts fail.
 */
async function withRetry(fn, { maxAttempts = 3, delayMs = 3000, label = '' } = {}) {
    let lastError
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err
            console.warn(`   ⚠️ ${label} 失敗 (第 ${attempt}/${maxAttempts} 次): ${err.message}`)
            if (attempt < maxAttempts) {
                await new Promise(r => setTimeout(r, delayMs * attempt))
            }
        }
    }
    const retryError = new Error(`分析因連線逾時中斷，請重新執行分析`)
    retryError.isRetryExhausted = true
    retryError.label = label
    retryError.originalError = lastError
    throw retryError
}

/**
 * Returns true if a result JSON is an error object (not real analysis data)
 */
function isErrorResult(result) {
    return result &&
        typeof result === 'object' &&
        typeof result.error === 'string' &&
        Object.keys(result).length <= 2  // {error, raw} or just {error}
}

/**
 * Get results from a specific previous step
 */
function getPreviousStepResult(stepIndex, fileId, resultStore) {
    const stepResults = resultStore.byStep[stepIndex]
    if (!stepResults) return null

    if (fileId) {
        const r = stepResults[fileId]
        return (r && !isErrorResult(r)) ? r : null
    } else {
        const r = stepResults['__collective__']
        return (r && !isErrorResult(r)) ? r : null
    }
}

/**
 * Get all results from a specific previous step (for collective analysis)
 * Filters out error results so downstream steps only receive valid data.
 * Handles both individual-scope steps (keyed by fileId) and
 * collective-scope steps (keyed by __collective__).
 */
function getAllResultsFromStep(stepIndex, resultStore) {
    const stepResults = resultStore.byStep[stepIndex]
    if (!stepResults) return []

    // ── Case 1: previous step was a collective step ──────────────────────
    // Its result is stored under '__collective__' only.
    const collectiveResult = stepResults['__collective__']
    const individualKeys = Object.keys(stepResults).filter(k => k !== '__collective__')

    if (collectiveResult && individualKeys.length === 0) {
        // Previous step was collective
        if (isErrorResult(collectiveResult)) {
            console.warn(`   ⚠️  Step ${stepIndex}: collective result is an error, returning empty`)
            return []
        }
        return [{ fileId: '__collective__', result: collectiveResult }]
    }

    // ── Case 2: previous step was an individual step ─────────────────────
    const all = Object.entries(stepResults)
        .filter(([key]) => key !== '__collective__')
        .map(([fileId, result]) => ({ fileId, result }))

    const valid = all.filter(({ result }) => !isErrorResult(result))

    if (valid.length === 0 && all.length > 0) {
        console.warn(`   ⚠️  Step ${stepIndex}: all ${all.length} individual results are errors, returning empty array`)
    } else if (valid.length < all.length) {
        console.warn(`   ⚠️  Step ${stepIndex}: filtered ${all.length - valid.length} error result(s), keeping ${valid.length} valid`)
    }

    return valid
}

/**
 * Build the context object for prompt template rendering
 */
async function fetchStepAttachments(step) {
    if (!step.id) return { attachments: [], has_attachments: false, attachment_count: 0, attachment_text: '' }

    const { data: rawAttachments, error } = await getSupabaseAdmin()
        .from('analysis_step_attachments')
        .select('*')
        .eq('step_id', step.id)
        .order('created_at', { ascending: true })

    if (error || !rawAttachments?.length) {
        return { attachments: [], has_attachments: false, attachment_count: 0, attachment_text: '' }
    }

    const processed = await processAttachments(rawAttachments)
    const parts = processed
        .filter(a => a.markdown)
        .map(a => [
            `=== 附件：${a.filename}${a.description ? ' (' + a.description + ')' : ''} ===${a.format !== 'text' ? ' [格式：' + a.format + ']' : ''}`,
            a.markdown
        ].join('\n'))

    return {
        attachments: processed,
        has_attachments: processed.some(a => a.markdown),
        attachment_count: processed.length,
        attachment_text: parts.length > 0 ? parts.join('\n\n') : '（附件無法轉換為文字）'
    }
}

async function buildContext({ step, file, files, resultStore, previousStepIndex, prefetchedAttachments }) {
    // ── Token / context-window guard ─────────────────────────────────────
    // Limit how much transcript text is sent per call to avoid exceeding the
    // model's context window. Tune via environment variables.
    const TRANSCRIPT_MAX_CHARS = parseInt(process.env.TRANSCRIPT_MAX_CHARS || '40000')
    const PREV_RESULTS_MAX_CHARS = parseInt(process.env.PREV_RESULTS_MAX_CHARS || '60000')

    function truncate(text, max, label) {
        if (!text || text.length <= max) return text
        console.warn(`   ✂️  Truncating ${label}: ${text.length} → ${max} chars`)
        return text.slice(0, max) + `\n...[truncated ${text.length - max} chars]`
    }

    // Individual transcript (for individual-scope steps)
    const rawTranscript = file
        ? file.transcripts.map(t => `${t.speaker || 'Speaker'}: ${t.content}`).join('\n\n')
        : null

    // Collective files list (for collective-scope steps)
    const fileContexts = files.map(f => ({
        id: f.id,
        filename: f.filename,
        transcript: truncate(
            f.transcripts.map(t => t.content).join('\n'),
            TRANSCRIPT_MAX_CHARS,
            `${f.filename} transcript`
        )
    }))

    // Previous step results — also cap total JSON size
    let prevAllResults = previousStepIndex > 0
        ? getAllResultsFromStep(previousStepIndex, resultStore)
        : []
    const prevAllJson = JSON.stringify(prevAllResults)
    if (prevAllJson.length > PREV_RESULTS_MAX_CHARS) {
        console.warn(`   ✂️  previous_step_all_results too large (${prevAllJson.length} chars), compacting...`)
        // Keep only essential fields to reduce size
        prevAllResults = prevAllResults.map(({ fileId, result }) => ({
            fileId,
            result: typeof result === 'object'
                ? Object.fromEntries(
                    Object.entries(result).map(([k, v]) => [
                        k,
                        typeof v === 'string' && v.length > 500
                            ? v.slice(0, 500) + '...(truncated)'
                            : v
                    ])
                )
                : result
        }))
    }

    const context = {
        transcript: truncate(rawTranscript, TRANSCRIPT_MAX_CHARS, 'individual transcript'),
        filename: file?.filename || null,
        file_meta: file?.meta || null,

        files: fileContexts,

        previous_step_result: previousStepIndex > 0
            ? getPreviousStepResult(previousStepIndex, file?.id, resultStore)
            : null,

        previous_step_all_results: prevAllResults,

        steps: {},

        current_step: {
            index: step.step_index,
            title: step.title,
            scope: step.analysis_scope
        },

        // List of all actual transcript file names for reference
        all_filenames: files.map(f => f.filename),
        file_count: files.length
    }

    for (let i = 1; i < step.step_index; i++) {
        const stepResults = resultStore.byStep[i]
        if (stepResults) {
            if (stepResults['__collective__']) {
                context.steps[i] = stepResults['__collective__']
            } else {
                context.steps[i] = Object.entries(stepResults).map(([fid, res]) => ({
                    file_id: fid,
                    result: res
                }))
            }
        }
    }

    // Use pre-fetched attachments (fetched once per step, not per file)
    if (prefetchedAttachments) {
        context.attachments = prefetchedAttachments.attachments
        context.has_attachments = prefetchedAttachments.has_attachments
        context.attachment_count = prefetchedAttachments.attachment_count
        context.attachment_text = prefetchedAttachments.attachment_text
    } else {
        context.attachments = []
        context.has_attachments = false
        context.attachment_count = 0
        context.attachment_text = ''
    }

    return context
}

/**
 * Simple concurrency limiter (avoids adding external dependency like p-limit).
 * Controls how many async tasks run simultaneously.
 */
function createConcurrencyLimiter(concurrency) {
    let active = 0
    const queue = []

    return function limit(fn) {
        return new Promise((resolve, reject) => {
            const run = async () => {
                active++
                try {
                    resolve(await fn())
                } catch (err) {
                    reject(err)
                } finally {
                    active--
                    if (queue.length > 0) {
                        queue.shift()()
                    }
                }
            }

            if (active < concurrency) {
                run()
            } else {
                queue.push(run)
            }
        })
    }
}

// Default concurrency for parallel file analysis.
// Can be tuned via ANALYSIS_CONCURRENCY env var.
const ANALYSIS_CONCURRENCY = parseInt(process.env.ANALYSIS_CONCURRENCY || '3')

/**
 * Run a step for EACH file individually (parallel with concurrency limit).
 */
async function processIndividualStep(step, files, systemPrompt, projectId, analysisRunId, resultStore, usageSummary, roomId = null) {
    if (!resultStore.byStep[step.step_index]) {
        resultStore.byStep[step.step_index] = {}
    }

    const previousStepIndex = step.step_index - 1
    const limit = createConcurrencyLimiter(ANALYSIS_CONCURRENCY)

    // Pre-fetch attachments once for this step (shared across all files)
    const prefetchedAttachments = await fetchStepAttachments(step)
    if (prefetchedAttachments.attachment_count > 0) {
        console.log(`   📎 Loaded ${prefetchedAttachments.attachment_count} attachment(s) for step`)
    }

    console.log(`   ⚡ Processing ${files.length} files in parallel (concurrency: ${ANALYSIS_CONCURRENCY})`)

    const tasks = files.map(file => limit(async () => {
        const { data: existing } = await getSupabaseAdmin()
            .from('analysis_results')
            .select('id, result_json')
            .eq('step_id', step.id)
            .eq('file_id', file.id)
            .eq('analysis_run_id', analysisRunId)
            .maybeSingle()

        if (existing) {
            console.log(`   ⏭️ Skipping ${file.filename} (already done)`)
            resultStore.byStep[step.step_index][file.id] = existing.result_json
            return
        }

        console.log(`   📄 Analyzing: ${file.filename}`)

        const context = await buildContext({
            step,
            file,
            files,
            resultStore,
            previousStepIndex,
            prefetchedAttachments
        })

        if (context.previous_step_result) {
            console.log(`      └─ Using result from Step ${previousStepIndex} for ${file.filename}`)
        }

        const resolvedTemplate = smartPreprocess(step.prompt_template, step.analysis_scope, step.step_index)
        const prompt = nunjucksEnv.renderString(resolvedTemplate, context)

        const startTime = Date.now()

        const { result, usage } = await withRetry(
            () => generateContent({
                prompt,
                systemPrompt,
                jsonSchema: step.output_schema,
                attachments: context.attachments || [],
                supabaseAdmin: getSupabaseAdmin()
            }),
            { maxAttempts: 3, delayMs: 3000, label: file.filename }
        )

        const executionTimeMs = Date.now() - startTime

        // Update usage tracking (these accumulations are safe — JS is single-threaded)
        usageSummary.stepUsage[step.step_index].promptTokens += usage.promptTokens
        usageSummary.stepUsage[step.step_index].completionTokens += usage.completionTokens
        usageSummary.stepUsage[step.step_index].totalTokens += usage.totalTokens
        usageSummary.stepUsage[step.step_index].executionTimeMs += executionTimeMs
        usageSummary.stepUsage[step.step_index].apiCalls += 1

        usageSummary.totalPromptTokens += usage.promptTokens
        usageSummary.totalCompletionTokens += usage.completionTokens
        usageSummary.totalTokens += usage.totalTokens

        // Store in result store
        resultStore.byStep[step.step_index][file.id] = result
        resultStore.all.push({
            stepIndex: step.step_index,
            fileId: file.id,
            result
        })

        // Save to database with usage info
        // Use null for file_id in room-based analysis (room_transcripts.id is not in files table)
        const { error: insertError } = await getSupabaseAdmin().from('analysis_results').insert({
            project_id: projectId,
            analysis_run_id: analysisRunId,
            step_id: step.id,
            file_id: roomId ? null : file.id,
            result_json: result,
            status: 'success',
            prompt_tokens: usage.promptTokens,
            completion_tokens: usage.completionTokens,
            total_tokens: usage.totalTokens,
            execution_time_ms: executionTimeMs
        })

        if (insertError) {
            console.error(`      ❌ DB Insert Error for ${file.filename}: ${insertError.message}`)
        }

        console.log(`      ✓ ${file.filename} completed (${usage.totalTokens} tokens, ${executionTimeMs}ms)`)
    }))

    await Promise.all(tasks)
}

/**
 * Run a step ONCE using aggregated data from all files and previous steps.
 */
async function processCollectiveStep(step, files, systemPrompt, projectId, analysisRunId, resultStore, usageSummary, roomId = null) {
    if (!resultStore.byStep[step.step_index]) {
        resultStore.byStep[step.step_index] = {}
    }

    const { data: existing } = await getSupabaseAdmin()
        .from('analysis_results')
        .select('id, result_json')
        .eq('step_id', step.id)
        .eq('analysis_run_id', analysisRunId)
        .is('file_id', null)
        .maybeSingle()

    if (existing) {
        console.log(`   ⏭️ Skipping (already done)`)
        resultStore.byStep[step.step_index]['__collective__'] = existing.result_json
        return
    }

    console.log(`   🔄 Running collective analysis...`)

    const previousStepIndex = step.step_index - 1

    // Pre-fetch attachments once for this step
    const prefetchedAttachments = await fetchStepAttachments(step)

    const context = await buildContext({
        step,
        file: null,
        files,
        resultStore,
        previousStepIndex,
        prefetchedAttachments
    })

    const prevResultCount = context.previous_step_all_results.length
    if (prevResultCount > 0) {
        const isFromCollective = context.previous_step_all_results[0]?.fileId === '__collective__'
        console.log(`      └─ Using ${prevResultCount} result(s) from Step ${previousStepIndex}${isFromCollective ? ' (collective)' : ' (individual)'}`)
    } else {
        console.warn(`      └─ ⚠️  No valid results from Step ${previousStepIndex} — will fall back to raw transcripts`)
    }

    const resolvedTemplate = smartPreprocess(step.prompt_template, step.analysis_scope, step.step_index)
    const prompt = nunjucksEnv.renderString(resolvedTemplate, context)

    const startTime = Date.now()

    const { result, usage } = await withRetry(
        () => generateContent({
            prompt,
            systemPrompt,
            jsonSchema: step.output_schema,
            attachments: context.attachments || [],
            supabaseAdmin: getSupabaseAdmin()
        }),
        { maxAttempts: 3, delayMs: 3000, label: `Step ${step.step_index} ${step.title}` }
    )

    const executionTimeMs = Date.now() - startTime

    // Update usage tracking
    usageSummary.stepUsage[step.step_index].promptTokens += usage.promptTokens
    usageSummary.stepUsage[step.step_index].completionTokens += usage.completionTokens
    usageSummary.stepUsage[step.step_index].totalTokens += usage.totalTokens
    usageSummary.stepUsage[step.step_index].executionTimeMs += executionTimeMs
    usageSummary.stepUsage[step.step_index].apiCalls += 1

    usageSummary.totalPromptTokens += usage.promptTokens
    usageSummary.totalCompletionTokens += usage.completionTokens
    usageSummary.totalTokens += usage.totalTokens

    // Store in result store
    resultStore.byStep[step.step_index]['__collective__'] = result
    resultStore.all.push({
        stepIndex: step.step_index,
        fileId: null,
        result
    })

    // Save to database with usage info
    await getSupabaseAdmin().from('analysis_results').insert({
        project_id: projectId,
        analysis_run_id: analysisRunId,
        step_id: step.id,
        file_id: null,
        result_json: result,
        status: 'success',
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        execution_time_ms: executionTimeMs
    })

    console.log(`      ✓ Completed (${usage.totalTokens} tokens, ${executionTimeMs}ms)`)
}

/**
 * Helper: Get available template variables documentation
 */
export function getTemplateVariables() {
    return {
        individual: [
            { name: 'transcript', description: '當前檔案的逐字稿內容' },
            { name: 'filename', description: '當前檔案名稱' },
            { name: 'file_meta', description: '當前檔案的 metadata' },
            { name: 'previous_step_result', description: '前一步驟對此檔案的分析結果' },
            { name: 'steps[n]', description: '第 n 步驟的所有結果（陣列）' },
            { name: 'current_step.index', description: '當前步驟編號' },
            { name: 'current_step.title', description: '當前步驟標題' },
        ],
        collective: [
            { name: 'files', description: '所有檔案列表（含 transcript）' },
            { name: 'previous_step_result', description: '前一步驟的結果（若為 collective）' },
            { name: 'previous_step_all_results', description: '前一步驟所有檔案的結果陣列' },
            { name: 'steps[n]', description: '第 n 步驟的結果' },
            { name: 'current_step.index', description: '當前步驟編號' },
            { name: 'current_step.title', description: '當前步驟標題' },
        ]
    }
}

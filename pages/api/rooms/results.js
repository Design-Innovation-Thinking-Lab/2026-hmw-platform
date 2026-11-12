import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

export default async function handler(req, res) {
    const { method } = req
    const { roomId } = req.query

    if (!roomId) {
        return res.status(400).json({ error: 'Missing roomId' })
    }

    // GET: Fetch room analysis results (specifically the final HMW step)
    if (method === 'GET') {
        try {
            const { runId } = req.query

            // Get room info
            const { data: room, error: roomError } = await supabaseAdmin
                .from('research_rooms')
                .select('id, name, room_code, research_topic, analysis_status, current_analysis_run_id, projects(name)')
                .eq('id', roomId)
                .single()

            if (roomError) throw roomError

            // Get all completed analysis runs for this room (for history)
            const { data: allRuns } = await supabaseAdmin
                .from('analysis_runs')
                .select('id, project_id, status, meta, created_at, finished_at, projects(name)')
                .eq('room_id', roomId)
                .in('status', ['completed', 'completed_with_errors'])
                .order('finished_at', { ascending: false })
                .limit(20)

            // If specific runId provided, use that; otherwise use latest
            let targetRun = null
            if (runId) {
                targetRun = allRuns?.find(r => r.id === runId)
            } else if (allRuns && allRuns.length > 0) {
                targetRun = allRuns[0]
            }

            if (!targetRun) {
                return res.status(200).json({
                    room,
                    results: null,
                    hmwItems: [],
                    analysisHistory: allRuns || []
                })
            }

            // Get all results for this run
            const { data: results, error: resultsError } = await supabaseAdmin
                .from('analysis_results')
                .select(`
                    *,
                    analysis_flow_steps ( id, step_index, title, analysis_scope )
                `)
                .eq('analysis_run_id', targetRun.id)
                .order('created_at', { ascending: true })

            if (resultsError) throw resultsError

            // Find all successful collective steps
            const collectiveResults = results
                .filter(r => r.analysis_flow_steps?.analysis_scope === 'collective')
                .filter(r => r.status === 'success')

            // The final collective step is the HMW step
            const finalResult = collectiveResults.length > 0
                ? collectiveResults[collectiveResults.length - 1]
                : null

            // Parse HMW items from the final result
            let hmwItems = []
            if (finalResult?.result_json) {
                const resultData = finalResult.result_json

                if (Array.isArray(resultData)) {
                    // Result itself is an array → use directly
                    hmwItems = resultData
                } else if (resultData && typeof resultData === 'object') {
                    // Find any key whose name contains "hmw" / "how might we" / "howmightwe"
                    // case-insensitive, spaces optional
                    const HMW_KEY_RE = /hmw|how\s*might\s*we/i
                    const hmwKey = Object.keys(resultData).find(
                        k => HMW_KEY_RE.test(k) && Array.isArray(resultData[k]) && resultData[k].length > 0
                    )
                    if (hmwKey) {
                        hmwItems = resultData[hmwKey]
                    } else {
                        // Generic fallback: first array value in the object
                        const firstArr = Object.values(resultData).find(
                            v => Array.isArray(v) && v.length > 0
                        )
                        if (firstArr) hmwItems = firstArr
                    }
                }
            }

            // ──────────────────────────────────────────────────────────────
            // Normalize: flatten items where HMW questions are stored as
            // nested arrays (of strings OR objects) so each card = 1 HMW.
            //
            // Handles these structures:
            // A) {"JTBD":"...", "HMW問題":["Q1","Q2"]}
            //    → two cards, each with HMW_question + JTBD context
            //
            // B) {"對應 JTBD":"...", "核心主題":"...", "HMW 問題(...)":
            //       [{"HMW":"Q1","對應的原始資料來源":"..."},
            //        {"HMW":"Q2","對應的原始資料來源":"..."}]}
            //    → two cards, each with HMW_question + all parent context
            // ──────────────────────────────────────────────────────────────
            const HMW_NESTED_KEYS = new Set([
                'HMW', 'hmw', 'HMW問題', 'HMW_question', 'hmw_question',
                'question', 'HMW 問題', 'statement'
            ])

            if (hmwItems.length > 0) {
                const normalized = []

                // All known scalar HMW question field names
                const SCALAR_HMW_KEYS = [
                    'HMW_question', 'hmw_question', 'HMW問題句', 'HMW問題',
                    'HMW', 'hmw', 'question', 'statement', 'HMW 問題'
                ]

                for (const item of hmwItems) {
                    if (typeof item !== 'object' || item === null) {
                        normalized.push(item)
                        continue
                    }

                    // ── Priority: if item already has a scalar HMW key → it's a
                    // complete card. Just normalise the key to HMW_question. ──
                    const scalarHmwKey = SCALAR_HMW_KEYS.find(
                        k => item[k] && typeof item[k] === 'string'
                    )
                    if (scalarHmwKey) {
                        normalized.push({ ...item, HMW_question: item[scalarHmwKey] })
                        continue
                    }

                    // ── Otherwise look for a nested array to expand ───────────
                    const entries = Object.entries(item)
                    const scalarFields = Object.fromEntries(
                        entries.filter(([, v]) => !Array.isArray(v))
                    )
                    // Only expand arrays whose KEY name looks like an HMW list
                    const HMW_ARRAY_KEY_RE = /hmw|how might|問題|statement/i
                    const arrayEntry = entries.find(([k, v]) =>
                        Array.isArray(v) && v.length > 0 && HMW_ARRAY_KEY_RE.test(k)
                    )

                    if (!arrayEntry) {
                        normalized.push(item)
                        continue
                    }

                    const [, nestedArr] = arrayEntry
                    const firstEl = nestedArr[0]

                    if (typeof firstEl === 'string') {
                        // ── Case A: array of HMW strings ──
                        for (const hmwQ of nestedArr) {
                            if (typeof hmwQ === 'string' && hmwQ.trim()) {
                                normalized.push({ ...scalarFields, HMW_question: hmwQ })
                            }
                        }
                    } else if (typeof firstEl === 'object' && firstEl !== null) {
                        // ── Case B: array of HMW objects ──
                        for (const hmwObj of nestedArr) {
                            if (typeof hmwObj !== 'object' || hmwObj === null) continue
                            const hmwText = SCALAR_HMW_KEYS.reduce((found, k) => found || hmwObj[k], null)
                            if (!hmwText) continue
                            const nestedExtra = Object.fromEntries(
                                Object.entries(hmwObj).filter(([k]) => !SCALAR_HMW_KEYS.includes(k))
                            )
                            normalized.push({ ...scalarFields, ...nestedExtra, HMW_question: hmwText })
                        }
                    } else {
                        normalized.push(item)
                    }
                }

                hmwItems = normalized
            }


            // Extract JTBD items from the second-to-last collective step (JTBD step)
            let jtbdItems = []
            if (collectiveResults.length >= 2) {
                const jtbdResult = collectiveResults[collectiveResults.length - 2]
                if (jtbdResult?.result_json) {
                    const jtbdData = jtbdResult.result_json
                    if (Array.isArray(jtbdData)) {
                        jtbdItems = jtbdData
                    } else if (jtbdData.JTBD_list) {
                        jtbdItems = jtbdData.JTBD_list
                    } else if (jtbdData.jtbd_list) {
                        jtbdItems = jtbdData.jtbd_list
                    } else if (jtbdData.items) {
                        jtbdItems = jtbdData.items
                    } else if (jtbdData.insights) {
                        jtbdItems = jtbdData.insights
                    } else {
                        // Generic fallback: find the first array value in the object
                        const arrayVal = Object.values(jtbdData).find(v => Array.isArray(v) && v.length > 0)
                        if (arrayVal) jtbdItems = arrayVal
                    }
                }
            }

            // Get existing votes for this room and run
            const { data: votes } = await supabaseAdmin
                .from('hmw_votes')
                .select('id, room_id, user_id, hmw_index, vote, analysis_run_id')
                .eq('room_id', roomId)
                .eq('analysis_run_id', targetRun.id)

            return res.status(200).json({
                room,
                runId: targetRun.id,
                currentRun: targetRun,
                results: finalResult,
                hmwItems,
                jtbdItems,
                votes: votes || [],
                allResults: results,
                analysisHistory: allRuns || []
            })

        } catch (err) {
            console.error('Error fetching room results:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Submit a vote
    if (method === 'POST') {
        const { hmwIndex, userId, vote, runId } = req.body

        if (hmwIndex === undefined || !userId) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        try {
            // Build query for existing vote
            let existingQuery = supabaseAdmin
                .from('hmw_votes')
                .select('id')
                .eq('room_id', roomId)
                .eq('user_id', userId)
                .eq('hmw_index', hmwIndex)

            if (runId) {
                existingQuery = existingQuery.eq('analysis_run_id', runId)
            }

            const { data: existing } = await existingQuery.single()

            if (existing) {
                // Update existing vote
                if (vote === null) {
                    // Remove vote
                    await supabaseAdmin
                        .from('hmw_votes')
                        .delete()
                        .eq('id', existing.id)
                } else {
                    await supabaseAdmin
                        .from('hmw_votes')
                        .update({ vote })
                        .eq('id', existing.id)
                }
            } else if (vote !== null) {
                // Create new vote
                const insertData = {
                    room_id: roomId,
                    user_id: userId,
                    hmw_index: hmwIndex,
                    vote
                }
                if (runId) {
                    insertData.analysis_run_id = runId
                }
                await supabaseAdmin
                    .from('hmw_votes')
                    .insert(insertData)
            }

            // Return updated votes for this run
            let votesQuery = supabaseAdmin
                .from('hmw_votes')
                .select('id, room_id, user_id, hmw_index, vote, analysis_run_id')
                .eq('room_id', roomId)

            if (runId) {
                votesQuery = votesQuery.eq('analysis_run_id', runId)
            }

            const { data: votes } = await votesQuery

            return res.status(200).json({ success: true, votes: votes || [] })

        } catch (err) {
            console.error('Error processing vote:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}

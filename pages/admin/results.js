import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminSidebar from '../../components/AdminSidebar'
import { adminStyles } from '../../styles/adminStyles'
import {
    BarChart
} from '../../components/icons'

export default function ResultsPage() {
    const router = useRouter()
    const { projectId: queryProjectId, runId: queryRunId } = router.query

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authChecking, setAuthChecking] = useState(true)
    const [userName, setUserName] = useState('')
    const [isAdmin, setIsAdmin] = useState(false)
    const [permissions, setPermissions] = useState({})

    const [projects, setProjects] = useState([])
    const [projectId, setProjectId] = useState('')
    const [runs, setRuns] = useState([])
    const [rooms, setRooms] = useState([])
    const [steps, setSteps] = useState([])
    const [results, setResults] = useState([])
    const [selectedRoomId, setSelectedRoomId] = useState('')
    const [selectedRunId, setSelectedRunId] = useState('')
    const [selectedStepIndex, setSelectedStepIndex] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingProjects, setLoadingProjects] = useState(true)
    const [expandedResult, setExpandedResult] = useState(null)
    const [showReport, setShowReport] = useState(false)

    // Check authentication on mount
    useEffect(() => {
        const adminAuth = localStorage.getItem('adminAuth')
        const storedUserName = localStorage.getItem('userName')
        const storedIsAdmin = localStorage.getItem('isAdmin')
        const storedPerms = localStorage.getItem('userPermissions')
        if (adminAuth === 'true') {
            setIsAuthenticated(true)
            setUserName(storedUserName || '')
            setIsAdmin(storedIsAdmin === 'true')
            try { setPermissions(JSON.parse(storedPerms || '{}')) } catch (e) { setPermissions({}) }
            setAuthChecking(false)
        } else {
            router.push('/admin/login?returnUrl=' + encodeURIComponent(router.asPath))
        }
    }, [])

    // Fetch projects on mount (only if authenticated)
    useEffect(() => {
        if (isAuthenticated) {
            fetchProjects()
            fetchAllRooms()
        }
    }, [isAuthenticated])

    // Set from URL query
    useEffect(() => {
        if (queryProjectId && !projectId) setProjectId(queryProjectId)
        if (queryRunId && !selectedRunId) setSelectedRunId(queryRunId)
    }, [queryProjectId, queryRunId])

    // Fetch results whenever any filter changes (as long as at least one is set)
    useEffect(() => {
        const hasFilter = projectId || selectedRoomId || selectedRunId || startDate || endDate
        if (hasFilter) fetchResults()
    }, [projectId, selectedRoomId, selectedRunId, startDate, endDate])

    async function fetchProjects() {
        setLoadingProjects(true)
        try {
            const storedUserId = localStorage.getItem('userId')
            const res = await fetch(`/api/projects${storedUserId ? `?userId=${storedUserId}` : ''}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setProjects(data.projects || [])
        } catch (err) {
            console.error('Error fetching projects:', err)
        } finally {
            setLoadingProjects(false)
        }
    }

    async function fetchAllRooms() {
        try {
            const res = await fetch('/api/admin/rooms')
            const data = await res.json()
            if (res.ok) setRooms(data.rooms || [])
        } catch (err) {
            console.error('Error fetching rooms:', err)
        }
    }

    async function fetchResults() {
        const params = new URLSearchParams()
        if (projectId)    params.set('projectId', projectId)
        if (selectedRoomId) params.set('roomId', selectedRoomId)
        if (selectedRunId)  params.set('runId', selectedRunId)
        if (startDate)    params.set('startDate', startDate)
        if (endDate)      params.set('endDate', endDate)
        if (!params.toString()) return

        setLoading(true)
        try {
            const res = await fetch(`/api/analysis/results?${params}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setResults(data.results || [])
            setRuns(data.runs || [])
            setSteps(data.steps || [])
            // Merge API rooms with independently fetched rooms (keep the fuller list)
            if (data.rooms?.length > 0) setRooms(prev => {
                const ids = new Set(prev.map(r => r.id))
                const extra = data.rooms.filter(r => !ids.has(r.id))
                return extra.length ? [...prev, ...extra] : prev
            })
        } catch (err) {
            console.error('Error fetching results:', err)
        } finally {
            setLoading(false)
        }
    }

    function handleProjectChange(e) {
        const newProjectId = e.target.value
        setProjectId(newProjectId)
        setSelectedRunId('')
        setResults([])
        setShowReport(false)
    }

    function handleRoomChange(e) {
        const newRoomId = e.target.value
        setSelectedRoomId(newRoomId)
        setSelectedRunId('')
        setShowReport(false)
    }

    function handleRunChange(e) {
        setSelectedRunId(e.target.value)
        setShowReport(false)
    }

    // Get filtered runs based on selected room and date range
    const filteredRuns = runs.filter(r => {
        // Filter by room
        if (selectedRoomId && r.room_id !== selectedRoomId) return false
        // Filter by start date
        if (startDate) {
            const runDate = new Date(r.created_at)
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            if (runDate < start) return false
        }
        // Filter by end date
        if (endDate) {
            const runDate = new Date(r.created_at)
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            if (runDate > end) return false
        }
        return true
    })

    // Filter results by step
    const filteredResults = selectedStepIndex
        ? results.filter(r => r.analysis_flow_steps?.step_index === parseInt(selectedStepIndex))
        : results

    // Group results by step
    const groupedResults = {}
    filteredResults.forEach(r => {
        const stepIndex = r.analysis_flow_steps?.step_index || 0
        if (!groupedResults[stepIndex]) {
            groupedResults[stepIndex] = {
                step: r.analysis_flow_steps,
                results: []
            }
        }
        groupedResults[stepIndex].results.push(r)
    })

    const selectedProject = projects.find(p => p.id === projectId)
    const selectedRun = runs.find(r => r.id === selectedRunId)

    // Calculate usage stats from results
    function calculateUsageFromResults() {
        const stats = {
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalTokens: 0,
            totalExecutionTimeMs: 0,
            stepUsage: {}
        }

        results.forEach(r => {
            const stepIndex = r.analysis_flow_steps?.step_index || 0
            const stepTitle = r.analysis_flow_steps?.title || 'Unknown'

            if (!stats.stepUsage[stepIndex]) {
                stats.stepUsage[stepIndex] = {
                    title: stepTitle,
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                    executionTimeMs: 0,
                    apiCalls: 0
                }
            }

            const promptTokens = r.prompt_tokens || 0
            const completionTokens = r.completion_tokens || 0
            const totalTokens = r.total_tokens || 0
            const execTime = r.execution_time_ms || 0

            stats.stepUsage[stepIndex].promptTokens += promptTokens
            stats.stepUsage[stepIndex].completionTokens += completionTokens
            stats.stepUsage[stepIndex].totalTokens += totalTokens
            stats.stepUsage[stepIndex].executionTimeMs += execTime
            stats.stepUsage[stepIndex].apiCalls += 1

            stats.totalPromptTokens += promptTokens
            stats.totalCompletionTokens += completionTokens
            stats.totalTokens += totalTokens
            stats.totalExecutionTimeMs += execTime
        })

        return stats
    }

    // Get usage stats - prefer from run.usage_summary if available, otherwise calculate
    function getUsageStats() {
        if (selectedRun?.usage_summary) {
            return selectedRun.usage_summary
        }
        return calculateUsageFromResults()
    }

    const usageStats = selectedRunId ? getUsageStats() : null

    // Format time
    function formatTime(ms) {
        if (ms < 1000) return `${ms}ms`
        if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
        const minutes = Math.floor(ms / 60000)
        const seconds = ((ms % 60000) / 1000).toFixed(0)
        return `${minutes}m ${seconds}s`
    }

    // Format number with commas
    function formatNumber(num) {
        return num.toLocaleString()
    }

    const handleLogout = () => {
        localStorage.removeItem('adminAuth')
        localStorage.removeItem('adminAuthTime')
        router.push('/admin/login')
    }

    // Show loading while checking auth
    if (authChecking || !isAuthenticated) {
        return (
            <div style={styles.authLoading}>
                <span>驗證中...</span>
            </div>
        )
    }

    return (
        <div style={styles.pageWrapper}>
            {/* Sidebar */}
            <AdminSidebar
                isAdmin={isAdmin}
                currentPath="/admin/results"
                userName={userName}
                permissions={permissions}
            />

            <main style={styles.container}>
                {/* Header */}
                <header style={styles.header}>
                    <div style={styles.headerLeft}>
                        <BarChart size={28} color="#1a1a2e" style={{ marginRight: 10 }} />
                        <h1 style={styles.title}>分析結果查看</h1>
                    </div>
                </header>

                {/* Body */}
                <div style={styles.body}>
                    {/* Filters */}
                    <div style={styles.filters}>
                        {/* Room filter — shown first, no dependency on project */}
                        <div style={styles.filterGroup}>
                            <label style={styles.filterLabel}>房間</label>
                            <select value={selectedRoomId} onChange={handleRoomChange} style={styles.select}>
                                <option value="">-- 全部房間 --</option>
                                {rooms.map(room => (
                                    <option key={room.id} value={room.id}>
                                        {room.name}{room.room_code ? ` (${room.room_code})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Project/mode filter — optional */}
                        <div style={styles.filterGroup}>
                            <label style={styles.filterLabel}>分析模式</label>
                            {loadingProjects ? (
                                <span>載入中...</span>
                            ) : (
                                <select value={projectId} onChange={handleProjectChange} style={styles.select}>
                                    <option value="">-- 全部模式 --</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Date Range Filters */}
                        <div style={styles.filterGroup}>
                            <label style={styles.filterLabel}>開始日期</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                style={styles.dateInput}
                            />
                        </div>
                        <div style={styles.filterGroup}>
                            <label style={styles.filterLabel}>結束日期</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                style={styles.dateInput}
                            />
                        </div>

                        {/* Run/batch filter — shown when runs are available */}
                        {filteredRuns.length > 0 && (
                            <div style={styles.filterGroup}>
                                <label style={styles.filterLabel}>分析批次</label>
                                <select value={selectedRunId} onChange={handleRunChange} style={styles.select}>
                                    <option value="">-- 全部批次 --</option>
                                    {filteredRuns.map(run => (
                                        <option key={run.id} value={run.id}>
                                            {new Date(run.created_at).toLocaleString('zh-TW')}
                                            {run.projects?.name ? ` ・ ${run.projects.name}` : ''}
                                            {run.research_rooms?.name ? ` ・ ${run.research_rooms.name}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {steps.length > 0 && (
                            <div style={styles.filterGroup}>
                                <label style={styles.filterLabel}>步驟</label>
                                <select
                                    value={selectedStepIndex}
                                    onChange={e => setSelectedStepIndex(e.target.value)}
                                    style={styles.select}
                                >
                                    <option value="">-- 全部步驟 --</option>
                                    {steps.map(step => (
                                        <option key={step.id} value={step.step_index}>
                                            Step {step.step_index}: {step.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Report Button */}
                        {selectedRunId && results.length > 0 && (
                            <div style={styles.filterGroup}>
                                <label style={styles.filterLabel}>&nbsp;</label>
                                <button
                                    onClick={() => setShowReport(!showReport)}
                                    style={styles.reportButton}
                                >
                                    📈 {showReport ? '隱藏報告' : '查看使用報告'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Run Info */}
                    {selectedRun && (
                        <div style={styles.runInfo}>
                            <strong>批次狀態：</strong>
                            <span style={styles.statusBadge(selectedRun.status)}>{selectedRun.status}</span>
                            {selectedRun.started_at && (
                                <span style={styles.runTime}>
                                    開始: {new Date(selectedRun.started_at).toLocaleString('zh-TW')}
                                </span>
                            )}
                            {selectedRun.finished_at && (
                                <span style={styles.runTime}>
                                    完成: {new Date(selectedRun.finished_at).toLocaleString('zh-TW')}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Usage Report */}
                    {showReport && usageStats && (
                        <div style={styles.reportContainer}>
                            <div style={styles.reportHeader}>
                                <h2 style={styles.reportTitle}>📈 資源使用報告</h2>
                                <span style={styles.reportSubtitle}>
                                    {selectedProject?.name} - {new Date(selectedRun?.created_at).toLocaleDateString('zh-TW')}
                                </span>
                            </div>

                            {/* Summary Cards */}
                            <div style={styles.summaryCards}>
                                <div style={styles.summaryCard}>
                                    <div style={styles.summaryIcon}>⏱️</div>
                                    <div style={styles.summaryContent}>
                                        <div style={styles.summaryValue}>
                                            {formatTime(usageStats.totalExecutionTimeMs)}
                                        </div>
                                        <div style={styles.summaryLabel}>總執行時間</div>
                                    </div>
                                </div>
                                <div style={styles.summaryCard}>
                                    <div style={styles.summaryIcon}>🔤</div>
                                    <div style={styles.summaryContent}>
                                        <div style={styles.summaryValue}>
                                            {formatNumber(usageStats.totalTokens)}
                                        </div>
                                        <div style={styles.summaryLabel}>總 Token 數</div>
                                    </div>
                                </div>
                                <div style={styles.summaryCard}>
                                    <div style={styles.summaryIcon}>📥</div>
                                    <div style={styles.summaryContent}>
                                        <div style={styles.summaryValue}>
                                            {formatNumber(usageStats.totalPromptTokens)}
                                        </div>
                                        <div style={styles.summaryLabel}>Prompt Tokens</div>
                                    </div>
                                </div>
                                <div style={styles.summaryCard}>
                                    <div style={styles.summaryIcon}>📤</div>
                                    <div style={styles.summaryContent}>
                                        <div style={styles.summaryValue}>
                                            {formatNumber(usageStats.totalCompletionTokens)}
                                        </div>
                                        <div style={styles.summaryLabel}>Completion Tokens</div>
                                    </div>
                                </div>
                            </div>

                            {/* Step Breakdown Table */}
                            <div style={styles.stepBreakdown}>
                                <h3 style={styles.breakdownTitle}>各步驟使用明細</h3>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>步驟</th>
                                            <th style={styles.th}>標題</th>
                                            <th style={styles.thRight}>API 呼叫</th>
                                            <th style={styles.thRight}>Prompt Tokens</th>
                                            <th style={styles.thRight}>Completion Tokens</th>
                                            <th style={styles.thRight}>總 Tokens</th>
                                            <th style={styles.thRight}>執行時間</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(usageStats.stepUsage || {})
                                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                            .map(([stepIndex, usage]) => (
                                                <tr key={stepIndex} style={styles.tr}>
                                                    <td style={styles.td}>
                                                        <span style={styles.stepBadgeSmall}>{stepIndex}</span>
                                                    </td>
                                                    <td style={styles.td}>{usage.title}</td>
                                                    <td style={styles.tdRight}>{usage.apiCalls}</td>
                                                    <td style={styles.tdRight}>{formatNumber(usage.promptTokens)}</td>
                                                    <td style={styles.tdRight}>{formatNumber(usage.completionTokens)}</td>
                                                    <td style={styles.tdRight}>
                                                        <strong>{formatNumber(usage.totalTokens)}</strong>
                                                    </td>
                                                    <td style={styles.tdRight}>{formatTime(usage.executionTimeMs)}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={styles.totalRow}>
                                            <td style={styles.td} colSpan={2}><strong>總計</strong></td>
                                            <td style={styles.tdRight}>
                                                <strong>
                                                    {Object.values(usageStats.stepUsage || {}).reduce((sum, u) => sum + (u.apiCalls || 0), 0)}
                                                </strong>
                                            </td>
                                            <td style={styles.tdRight}>
                                                <strong>{formatNumber(usageStats.totalPromptTokens)}</strong>
                                            </td>
                                            <td style={styles.tdRight}>
                                                <strong>{formatNumber(usageStats.totalCompletionTokens)}</strong>
                                            </td>
                                            <td style={styles.tdRight}>
                                                <strong>{formatNumber(usageStats.totalTokens)}</strong>
                                            </td>
                                            <td style={styles.tdRight}>
                                                <strong>{formatTime(usageStats.totalExecutionTimeMs)}</strong>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {loading && <div style={styles.loading}>載入結果中...</div>}

                    {!loading && projectId && Object.keys(groupedResults).length > 0 && (
                        <div style={styles.resultsContainer}>
                            {Object.entries(groupedResults)
                                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                .map(([stepIndex, group]) => (
                                    <div key={stepIndex} style={styles.stepGroup}>
                                        <div style={styles.stepHeader}>
                                            <span style={styles.stepBadge}>{stepIndex}</span>
                                            <h3 style={styles.stepTitle}>{group.step?.title || 'Unknown Step'}</h3>
                                            <span style={styles.scopeBadge(group.step?.analysis_scope)}>
                                                {group.step?.analysis_scope === 'individual' ? '👤 個別' : '👥 集體'}
                                            </span>
                                            <span style={styles.resultCount}>{group.results.length} 結果</span>
                                        </div>

                                        <div style={styles.resultsList}>
                                            {group.results.map(result => (
                                                <div key={result.id} style={styles.resultCard}>
                                                    <div
                                                        style={styles.resultHeader}
                                                        onClick={() => setExpandedResult(
                                                            expandedResult === result.id ? null : result.id
                                                        )}
                                                    >
                                                        <div style={styles.resultInfo}>
                                                            {result.files && (
                                                                <span style={styles.fileName}>
                                                                    📄 {result.files.filename}
                                                                </span>
                                                            )}
                                                            {!result.files && (
                                                                <span style={styles.collectiveLabel}>
                                                                    🔄 集體分析結果
                                                                </span>
                                                            )}
                                                            <span style={styles.resultStatus(result.status)}>
                                                                {result.status === 'success' ? '✓' : '✗'}
                                                            </span>
                                                            {result.total_tokens > 0 && (
                                                                <span style={styles.tokenBadge}>
                                                                    {result.total_tokens} tokens
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span style={styles.expandIcon}>
                                                            {expandedResult === result.id ? '▼' : '▶'}
                                                        </span>
                                                    </div>

                                                    {expandedResult === result.id && (
                                                        <div style={styles.resultBody}>
                                                            <pre style={styles.jsonContent}>
                                                                {JSON.stringify(result.result_json, null, 2)}
                                                            </pre>
                                                            <div style={styles.resultMeta}>
                                                                <small>
                                                                    Created: {new Date(result.created_at).toLocaleString('zh-TW')}
                                                                    {result.execution_time_ms > 0 && (
                                                                        <> | Time: {formatTime(result.execution_time_ms)}</>
                                                                    )}
                                                                    {result.total_tokens > 0 && (
                                                                        <> | Tokens: {result.total_tokens}</>
                                                                    )}
                                                                </small>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}

                    {!loading && (projectId || selectedRoomId || startDate || endDate) && filteredResults.length === 0 && (
                        <div style={styles.empty}>
                            <p>尚無分析結果</p>
                            <p style={styles.emptyHint}>請確認篩選條件，或嘗試調整日期範圍</p>
                        </div>
                    )}

                    {!loading && !projectId && !selectedRoomId && !startDate && !endDate && (
                        <div style={styles.empty}>
                            <p>請選擇任一篩選條件以查看分析結果</p>
                            <p style={styles.emptyHint}>可先選房間、分析模式或日期範圍，不需全部填寫</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

const styles = {
    pageWrapper: {
        display: 'flex',
        minHeight: '100vh'
    },
    authLoading: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #fef5e7 0%, #fff5f5 50%, #f0fdf4 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 18,
        color: '#6b7280'
    },
    container: {
        flex: 1,
        marginLeft: 64,
        padding: '0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'linear-gradient(135deg, #fef5e7 0%, #fff5f5 50%, #f0fdf4 100%)',
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease'
    },
    body: {
        padding: '32px 40px',
        maxWidth: 1400,
        margin: '0 auto'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 40px',
        background: '#fff',
        borderBottom: '3px solid #1a1a2e',
        boxShadow: '0 4px 0 #e5e7eb'
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
    },
    headerIcon: {
        fontSize: 28
    },
    title: {
        fontSize: 22,
        fontWeight: 700,
        color: '#1a1a2e',
        margin: 0
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: 16
    },
    navLink: {
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: 500,
        color: '#4361ee',
        textDecoration: 'none',
        background: '#f0f4ff',
        borderRadius: 8,
        border: '2px solid #4361ee',
        display: 'flex',
        alignItems: 'center'
    },
    logoutButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        fontSize: 13,
        background: '#f3f4f6',
        color: '#374151',
        border: '2px solid #e5e7eb',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500
    },
    filters: {
        display: 'flex',
        gap: 20,
        background: '#fff',
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        flexWrap: 'wrap',
        alignItems: 'flex-end'
    },
    filterGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: 600,
        color: '#6b7280'
    },
    select: {
        padding: '10px 14px',
        fontSize: 14,
        border: '1px solid #d1d5db',
        borderRadius: 8,
        minWidth: 200,
        outline: 'none',
        background: '#fff'
    },
    dateInput: {
        padding: '10px 14px',
        fontSize: 14,
        border: '1px solid #d1d5db',
        borderRadius: 8,
        minWidth: 140,
        outline: 'none',
        background: '#fff'
    },
    reportButton: {
        padding: '10px 20px',
        fontSize: 14,
        background: '#7c3aed',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 600
    },
    runInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: '#e8edfc',
        padding: '12px 16px',
        borderRadius: 8,
        marginBottom: 20,
        fontSize: 14
    },
    statusBadge: (status) => ({
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        background: status === 'completed' ? '#dcfce7' :
            status === 'processing' ? '#fef3c7' :
                status === 'failed' ? '#fee2e2' : '#f3f4f6',
        color: status === 'completed' ? '#166534' :
            status === 'processing' ? '#92400e' :
                status === 'failed' ? '#dc2626' : '#374151'
    }),
    runTime: {
        color: '#6b7280',
        fontSize: 13
    },
    // Report styles
    reportContainer: {
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '2px solid #7c3aed'
    },
    reportHeader: {
        marginBottom: 24
    },
    reportTitle: {
        fontSize: 20,
        fontWeight: 600,
        color: '#1a1a2e',
        margin: '0 0 4px 0'
    },
    reportSubtitle: {
        fontSize: 14,
        color: '#6b7280'
    },
    summaryCards: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24
    },
    summaryCard: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        background: '#f9fafb',
        borderRadius: 8,
        border: '1px solid #e5e7eb'
    },
    summaryIcon: {
        fontSize: 28
    },
    summaryContent: {
        flex: 1
    },
    summaryValue: {
        fontSize: 24,
        fontWeight: 700,
        color: '#1a1a2e'
    },
    summaryLabel: {
        fontSize: 12,
        color: '#6b7280'
    },
    stepBreakdown: {
        marginTop: 16
    },
    breakdownTitle: {
        fontSize: 16,
        fontWeight: 600,
        color: '#374151',
        margin: '0 0 12px 0'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 14
    },
    th: {
        textAlign: 'left',
        padding: '12px 8px',
        borderBottom: '2px solid #e5e7eb',
        color: '#6b7280',
        fontWeight: 600,
        fontSize: 12
    },
    thRight: {
        textAlign: 'right',
        padding: '12px 8px',
        borderBottom: '2px solid #e5e7eb',
        color: '#6b7280',
        fontWeight: 600,
        fontSize: 12
    },
    tr: {
        borderBottom: '1px solid #f3f4f6'
    },
    td: {
        padding: '12px 8px',
        color: '#374151'
    },
    tdRight: {
        textAlign: 'right',
        padding: '12px 8px',
        color: '#374151',
        fontFamily: 'Monaco, Consolas, monospace',
        fontSize: 13
    },
    totalRow: {
        background: '#f9fafb',
        borderTop: '2px solid #e5e7eb'
    },
    stepBadgeSmall: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        background: '#4361ee',
        color: '#fff',
        borderRadius: '50%',
        fontSize: 12,
        fontWeight: 600
    },
    // Result styles
    loading: {
        textAlign: 'center',
        padding: 40,
        color: '#6b7280'
    },
    resultsContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: 24
    },
    stepGroup: {
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    stepHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 20px',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb'
    },
    stepBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        background: '#4361ee',
        color: '#fff',
        borderRadius: '50%',
        fontSize: 13,
        fontWeight: 600
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: 600,
        color: '#1a1a2e',
        margin: 0,
        flex: 1
    },
    scopeBadge: (scope) => ({
        padding: '4px 10px',
        borderRadius: 12,
        fontSize: 12,
        background: scope === 'individual' ? '#dbeafe' : '#fef3c7',
        color: scope === 'individual' ? '#1e40af' : '#92400e'
    }),
    resultCount: {
        fontSize: 13,
        color: '#6b7280'
    },
    resultsList: {
        padding: 12
    },
    resultCard: {
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        marginBottom: 8,
        overflow: 'hidden'
    },
    resultHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        cursor: 'pointer',
        background: '#fafafa',
        transition: 'background 0.2s'
    },
    resultInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
    },
    fileName: {
        fontSize: 14,
        fontWeight: 500,
        color: '#374151'
    },
    collectiveLabel: {
        fontSize: 14,
        fontWeight: 500,
        color: '#7c3aed'
    },
    resultStatus: (status) => ({
        fontSize: 14,
        color: status === 'success' ? '#10b981' : '#ef4444'
    }),
    tokenBadge: {
        fontSize: 11,
        padding: '2px 8px',
        background: '#e0e7ff',
        color: '#4338ca',
        borderRadius: 10,
        fontFamily: 'Monaco, Consolas, monospace'
    },
    expandIcon: {
        color: '#6b7280',
        fontSize: 12
    },
    resultBody: {
        padding: 16,
        borderTop: '1px solid #e5e7eb',
        background: '#fff'
    },
    jsonContent: {
        background: '#1a1a2e',
        color: '#e5e7eb',
        padding: 16,
        borderRadius: 8,
        fontSize: 12,
        overflow: 'auto',
        maxHeight: 400,
        fontFamily: 'Monaco, Consolas, monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
    },
    resultMeta: {
        marginTop: 12,
        color: '#6b7280'
    },
    empty: {
        textAlign: 'center',
        padding: 60,
        color: '#6b7280',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
    },
    emptyHint: {
        fontSize: 13,
        color: '#9ca3af'
    }
}

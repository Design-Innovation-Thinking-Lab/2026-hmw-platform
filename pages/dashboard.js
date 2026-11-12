import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
    BrainCircuit,
    LogOut,
    Home,
    ClipboardList,
    Sparkles,
    Rocket,
    FolderOpen,
    Pin,
    Users,
    Crown,
    User,
    LogIn
} from '../components/icons'

export default function DashboardPage() {
    const router = useRouter()
    const [userId, setUserId] = useState(null)
    const [userName, setUserName] = useState('')
    const [rooms, setRooms] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const [activeMode, setActiveMode] = useState(null)

    const [createForm, setCreateForm] = useState({
        name: '',
        research_topic: '',
        research_purpose: '',
        team_size: 4,
        min_votes: 1,
        max_votes: 3,
        project_id: ''
    })

    const [projects, setProjects] = useState([])
    const [loadingProjects, setLoadingProjects] = useState(false)
    const [joinCode, setJoinCode] = useState('')
    const [joiningRoom, setJoiningRoom] = useState(false)

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId')
        const storedUserName = localStorage.getItem('userName')

        if (!storedUserId) {
            router.push('/register')
            return
        }

        setUserId(storedUserId)
        setUserName(storedUserName || '')
        fetchRooms(storedUserId)
        fetchProjects(storedUserId)
    }, [])

    const fetchProjects = async (uid) => {
        setLoadingProjects(true)
        try {
            const res = await fetch(`/api/projects?userId=${uid}`)
            const data = await res.json()
            if (res.ok) setProjects(data.projects || [])
        } catch (err) {
            console.error('Error fetching projects:', err)
        } finally {
            setLoadingProjects(false)
        }
    }

    const fetchRooms = async (uid) => {
        try {
            const res = await fetch(`/api/rooms?userId=${uid}`)
            const data = await res.json()
            if (res.ok) setRooms(data.rooms || [])
        } catch (err) {
            console.error('Error fetching rooms:', err)
        }
    }

    const handleCreateRoom = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        if (!createForm.name.trim() || !createForm.research_topic.trim() || !createForm.research_purpose.trim()) {
            setError('請填寫所有必填欄位')
            setLoading(false)
            return
        }

        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', creator_id: userId, ...createForm })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSuccess(`房間建立成功！房間代碼：${data.room.room_code}`)
            setCreateForm({ name: '', research_topic: '', research_purpose: '', team_size: 4, min_votes: 1, max_votes: 3, project_id: '' })
            setActiveMode(null)
            fetchRooms(userId)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleJoinRoom = async (e) => {
        e.preventDefault()
        setJoiningRoom(true)
        setError(null)
        setSuccess(null)

        if (!joinCode.trim() || joinCode.length !== 8) {
            setError('請輸入 8 位數房間代碼')
            setJoiningRoom(false)
            return
        }

        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join', room_code: joinCode, user_id: userId })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setSuccess(`成功加入房間：${data.room.name}`)
            setJoinCode('')
            setActiveMode(null)
            fetchRooms(userId)
        } catch (err) {
            setError(err.message)
        } finally {
            setJoiningRoom(false)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('userId')
        localStorage.removeItem('userName')
        router.push('/')
    }

    const handleModeSelect = (mode) => {
        setActiveMode(activeMode === mode ? null : mode)
        setError(null)
        setSuccess(null)
    }

    const getMemberCount = (room) => room.member_count || 1

    return (
        <div className="dashboard-page">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <span className="dashboard-logo">
                        <BrainCircuit size={24} color="#4361ee" />
                        <span className="hidden-mobile">Human-AI HMW 平台</span>
                    </span>
                </div>
                <div className="dashboard-header-actions">
                    <button onClick={() => router.push('/')} className="btn btn-ghost btn-sm">
                        <Home size={16} />
                        <span className="hidden-mobile">首頁</span>
                    </button>
                    <span className="user-name-tag">
                        <User size={16} />
                        {userName}
                    </span>
                    <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                        <LogOut size={14} />
                        <span className="hidden-mobile">登出</span>
                    </button>
                </div>
            </header>

            <main className="dashboard-main">
                <h1 className="dashboard-title">歡迎回來，{userName}！</h1>
                <p className="dashboard-subtitle">建立研究房間或加入現有房間開始分析</p>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                {/* Action Buttons */}
                <div className="action-btn-row">
                    <button
                        className={`action-btn action-btn-blue ${activeMode === 'create' ? 'action-btn-active' : ''}`}
                        onClick={() => handleModeSelect('create')}
                    >
                        <Home size={28} />
                        <span>建立新房間</span>
                    </button>
                    <button
                        className={`action-btn action-btn-green ${activeMode === 'join' ? 'action-btn-active' : ''}`}
                        onClick={() => handleModeSelect('join')}
                    >
                        <ClipboardList size={28} />
                        <span>加入房間</span>
                    </button>
                </div>

                {/* Create Room Form */}
                {activeMode === 'create' && (
                    <div className="expanded-card">
                        <form onSubmit={handleCreateRoom}>
                            <div className="form-group">
                                <label className="form-label">房間名稱 *</label>
                                <input
                                    type="text"
                                    value={createForm.name}
                                    onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="例：產品訪談分析"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">研究主題 *</label>
                                <textarea
                                    value={createForm.research_topic}
                                    onChange={e => setCreateForm(prev => ({ ...prev, research_topic: e.target.value }))}
                                    placeholder="例：使用者線上購物體驗研究"
                                    className="form-textarea"
                                    rows={2}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">研究目的 *</label>
                                <textarea
                                    value={createForm.research_purpose}
                                    onChange={e => setCreateForm(prev => ({ ...prev, research_purpose: e.target.value }))}
                                    placeholder="例：了解使用者在線上購物時遇到的痛點，以改善結帳流程體驗"
                                    className="form-textarea"
                                    rows={3}
                                />
                                <small className="form-hint">研究目的會在 AI 分析時作為參考依據，請具體描述</small>
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">組員人數</label>
                                    <input
                                        type="number"
                                        value={createForm.team_size}
                                        onChange={e => setCreateForm(prev => ({ ...prev, team_size: parseInt(e.target.value) || 1 }))}
                                        min="1" max="20"
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">最少投票數</label>
                                    <input
                                        type="number"
                                        value={createForm.min_votes}
                                        onChange={e => setCreateForm(prev => ({ ...prev, min_votes: parseInt(e.target.value) || 1 }))}
                                        min="1" max="10"
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">最多投票數</label>
                                    <input
                                        type="number"
                                        value={createForm.max_votes}
                                        onChange={e => setCreateForm(prev => ({ ...prev, max_votes: parseInt(e.target.value) || 3 }))}
                                        min="1" max="20"
                                        className="form-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">分析模式</label>
                                {loadingProjects ? (
                                    <span className="form-hint">載入中...</span>
                                ) : (
                                    <select
                                        value={createForm.project_id}
                                        onChange={e => setCreateForm(prev => ({ ...prev, project_id: e.target.value }))}
                                        className="form-select"
                                    >
                                        <option value="">-- 使用預設模式 --</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}{p.is_default ? ' (預設)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={() => setActiveMode(null)} className="btn btn-ghost btn-full">
                                    取消
                                </button>
                                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                                    {loading ? '建立中...' : (
                                        <><Sparkles size={18} /> 建立房間</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Join Room Form */}
                {activeMode === 'join' && (
                    <div className="expanded-card-green">
                        <form onSubmit={handleJoinRoom}>
                            <div className="form-group">
                                <label className="form-label">輸入房間代碼（8 位數）</label>
                                <input
                                    type="text"
                                    value={joinCode}
                                    onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                    placeholder="12345678"
                                    className="form-input"
                                    maxLength={8}
                                    autoFocus
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={() => setActiveMode(null)} className="btn btn-ghost btn-full">
                                    取消
                                </button>
                                <button type="submit" className="btn btn-success btn-full" disabled={joiningRoom}>
                                    {joiningRoom ? '加入中...' : (
                                        <><Rocket size={18} /> 加入房間</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* History Section */}
                <div className="history-section">
                    <h2 className="history-title">
                        <FolderOpen size={24} color="#1a1a2e" />
                        歷史紀錄
                    </h2>
                    {rooms.length > 0 ? (
                        <div className="rooms-grid">
                            {rooms.map(room => (
                                <div key={room.id} className="room-card">
                                    <div className="room-card-header">
                                        <span className="room-name">{room.name}</span>
                                        <span className="room-code-badge">代碼：{room.room_code}</span>
                                    </div>
                                    <div className="room-meta">
                                        <Pin size={14} style={{ flexShrink: 0 }} />
                                        {room.research_topic}
                                    </div>
                                    <div className="room-footer">
                                        <span className="room-members">
                                            <Users size={14} />
                                            {getMemberCount(room)} 人
                                        </span>
                                        <span className="room-role">
                                            {room.userRole === 'creator' ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Crown size={14} /> 創建者
                                                </span>
                                            ) : (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <User size={14} /> 成員
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => router.push(`/room/${room.room_code}`)}
                                        className="btn btn-primary btn-full"
                                        style={{ marginTop: 8 }}
                                    >
                                        <LogIn size={16} /> 進入房間
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>尚無歷史紀錄</p>
                            <p className="empty-state-hint">建立或加入房間後，紀錄會顯示在這裡</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  BrainCircuit,
  BarChart2,
  Target,
  Lightbulb,
  Sparkles,
  ClipboardList,
  Frown,
  HelpCircle,
  Check,
  Rocket,
  Mail,
  CheckCircle,
  Send,
  ArrowRight,
  Menu,
  X,
  DoorOpen,
  FileText,
  Upload,
  SlidersHorizontal,
  ThumbsUp,
  LayoutCards
} from '../components/icons'

export default function LandingPage() {
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    problem: ''
  })
  const [contactLoading, setContactLoading] = useState(false)
  const [contactSuccess, setContactSuccess] = useState(false)
  const [contactError, setContactError] = useState(null)

  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState('')

  // Check login state on mount
  useEffect(() => {
    const userId = localStorage.getItem('userId')
    const storedUserName = localStorage.getItem('userName')
    if (userId) {
      setIsLoggedIn(true)
      setUserName(storedUserName || '用戶')
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('userId')
    localStorage.removeItem('userName')
    localStorage.removeItem('adminAuth')
    localStorage.removeItem('isAdmin')
    setIsLoggedIn(false)
    setUserName('')
    setMobileNavOpen(false)
  }

  const handleStart = () => router.push('/register')
  const handleLogin = () => router.push('/login')

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    setContactLoading(true)
    setContactError(null)

    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.problem.trim()) {
      setContactError('請填寫所有欄位')
      setContactLoading(false)
      return
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setContactSuccess(true)
      setContactForm({ name: '', email: '', problem: '' })
    } catch (err) {
      setContactError(err.message)
    } finally {
      setContactLoading(false)
    }
  }

  return (
    <div className="page-container">

      {/* ===== Header ===== */}
      <header className="landing-header">
        <a href="/" className="logo-link">
          <div className="logo">
            <BrainCircuit size={28} color="#4361ee" />
            <span className="logo-text">Human-AI HMW</span>
          </div>
        </a>

        {/* Desktop Nav */}
        <nav className="landing-nav">
          <a href="#about" className="landing-nav-link">關於平台</a>
          <a href="#process" className="landing-nav-link">分析流程</a>
          <a href="#contact" className="landing-nav-link">聯絡我們</a>
          <a href="/admin" className="landing-nav-link">管理後台</a>
          {isLoggedIn ? (
            <>
              <span className="user-greeting">Hi, {userName}</span>
              <button onClick={handleLogout} className="btn-logout-nav">登出</button>
            </>
          ) : (
            <button onClick={handleLogin} className="btn-login-nav">登入</button>
          )}
          <button onClick={handleStart} className="btn-start-nav">
            Start <ArrowRight size={16} strokeWidth={3} />
          </button>
        </nav>

        {/* Mobile Hamburger */}
        <button
          className="hamburger-btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="開啟選單"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile Nav Drawer */}
      {mobileNavOpen && (
        <div className="mobile-nav-drawer" onClick={() => setMobileNavOpen(false)}>
          <div className="mobile-nav-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span className="logo-text">Human-AI HMW</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={24} />
              </button>
            </div>
            <a href="#about" className="mobile-nav-link" onClick={() => setMobileNavOpen(false)}>關於平台</a>
            <a href="#process" className="mobile-nav-link" onClick={() => setMobileNavOpen(false)}>分析流程</a>
            <a href="#contact" className="mobile-nav-link" onClick={() => setMobileNavOpen(false)}>聯絡我們</a>
            <a href="/admin" className="mobile-nav-link" onClick={() => setMobileNavOpen(false)}>管理後台</a>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isLoggedIn ? (
                <>
                  <span style={{ color: '#374151', fontSize: 15 }}>Hi, {userName}!</span>
                  <button onClick={handleLogout} className="btn btn-outline btn-full">登出</button>
                </>
              ) : (
                <button onClick={handleLogin} className="btn btn-outline btn-full">登入</button>
              )}
              <button onClick={handleStart} className="btn btn-success btn-full">
                Start <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Hero Section ===== */}
      <main className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot"></span>
            AI-Powered Design Thinking
          </div>
          <h1 className="hero-title">
            從訪談洞察<br />
            <span className="hero-title-highlight">定義問題，</span><br />
            重構設計機會
          </h1>
          <p className="hero-subtitle">
            上傳訪談逐字稿，讓 AI 分析並生成 How Might We 問題，<br />
            透過群眾投票與 AI 推薦進行思辨比較
          </p>
          <div className="hero-buttons">
            <button onClick={handleStart} className="btn btn-success btn-lg">
              開始使用 <ArrowRight size={18} />
            </button>
            <button onClick={handleLogin} className="btn btn-outline btn-lg">
              已有帳號？登入
            </button>
          </div>
          <div className="hero-stats">
            <div>
              <div className="stat-number">由你決定</div>
              <div className="stat-label">分析步驟</div>
            </div>
            <div>
              <div className="stat-number">AI</div>
              <div className="stat-label">智能分析</div>
            </div>
            <div>
              <div className="stat-number">HMW</div>
              <div className="stat-label">問題生成</div>
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="hero-visual">
          <div className="card-neobrutalism">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <BarChart2 size={32} color="#4361ee" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a2e' }}>訪談分析報告</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>8 steps • AI Generated</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>分析進度</div>
              <div className="progress-bar-outer" style={{ flex: 1, height: 12 }}>
                <div className="progress-bar-inner" style={{ width: '100%', background: '#10b981' }}></div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>100%</div>
            </div>
            <button className="btn btn-success btn-full">查看結果</button>
          </div>

          {/* Floating Elements */}
          <div className="floating-card floating-card-1">
            <Target size={18} color="#dc2626" />
            <span>痛點分析</span>
          </div>
          <div className="floating-card floating-card-2">
            <Lightbulb size={18} color="#d97706" />
            <span>洞察發現</span>
          </div>
          <div className="floating-card-3">
            <Sparkles size={22} color="#f59e0b" />
          </div>
        </div>
      </main>

      {/* ===== Process Section ===== */}
      <section id="process" className="process-section">
        <h2 className="section-title">Design Thinking 定義問題階段</h2>
        <p className="section-subtitle">
          有了同理心階段得到的使用者洞察資料後，必須重新解構跟定義核心問題！
        </p>

        <div className="process-steps">
          {[
            { label: 'EMPATHIZE', color: '#4361ee', current: false },
            { label: 'DEFINE', color: '#10b981', current: true },
            { label: 'IDEATE', color: '#f59e0b', current: false },
            { label: 'PROTOTYPE', color: '#ef4444', current: false },
            { label: 'TEST', color: '#991b1b', current: false },
          ].map(step => (
            <div key={step.label} style={{ position: 'relative', textAlign: 'center' }}>
              <div
                className="step-hex"
                style={{ backgroundColor: step.color }}
              >
                {step.label}
              </div>
              {step.current && (
                <div className="current-indicator">← 目前階段</div>
              )}
            </div>
          ))}
        </div>

        <div className="feature-cards">
          <div className="feature-card">
            <div className="feature-icon"><ClipboardList size={40} color="#4361ee" /></div>
            <h3 className="feature-title">缺口盤點</h3>
            <p className="feature-desc">分析訪談內容，找出現有問題與挑戰</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><Frown size={40} color="#ef4444" /></div>
            <h3 className="feature-title">痛點分析</h3>
            <p className="feature-desc">識別使用者的痛點與未被滿足的需求</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><HelpCircle size={40} color="#f59e0b" /></div>
            <h3 className="feature-title">HMW 生成</h3>
            <p className="feature-desc">生成「我們該如何...」問題陳述</p>
          </div>
        </div>
      </section>

      {/* ===== About Section ===== */}
      <section id="about" className="about-section">
        <div className="about-card">
          <h2 className="about-title">
            <BrainCircuit size={28} color="#1a1a2e" />
            關於 Human-AI HMW 平台
          </h2>
          <p className="about-text">
            這個平台是為 HMW（How Might We）設計工作坊所打造的 AI 輔助工具。
            透過上傳訪談逐字稿，AI 將協助你：
          </p>
          <ul className="about-list">
            {[
              '整理逐字稿成完整語句',
              '分析使用者痛點與需求',
              '重新解構並定義核心問題',
              '生成 HMW 問題陳述',
              '透過投票進行群眾思辨',
            ].map(item => (
              <li key={item} className="about-list-item">
                <Check size={18} color="#10b981" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== How It Works Section ===== */}
      <section className="hiw-section">
        <div className="hiw-header">
          <div className="hiw-badge">平台介紹</div>
          <h2 className="hiw-title">如何使用本平台？</h2>
          <p className="hiw-subtitle">六個步驟，從研究到洞察，輕鬆生成 HMW 設計問題</p>
        </div>

        <div className="hiw-steps">
          {[
            {
              step: '01',
              icon: <DoorOpen size={32} color="#4361ee" />,
              title: '開立房間',
              desc: '建立研究專案房間，邀請團隊成員加入協作',
              color: '#e0e7ff',
              border: '#4361ee',
            },
            {
              step: '02',
              icon: <Target size={32} color="#7c3aed" />,
              title: '輸入研究目的',
              desc: '清楚定義本次研究的目標與範疇，讓 AI 更精準地按照目標分析',
              color: '#ede9fe',
              border: '#7c3aed',
            },
            {
              step: '03',
              icon: <FileText size={32} color="#0891b2" />,
              title: '準備逐字稿',
              desc: '拖曳檔案到此處，或點擊選擇檔案支援txt, docx, pdf檔，可同時選取多個檔案上傳',
              color: '#cffafe',
              border: '#0891b2',
            },
            {
              step: '04',
              icon: <Upload size={32} color="#059669" />,
              title: '上傳逐字稿',
              desc: '系統自動解析所有訪談資料',
              color: '#d1fae5',
              border: '#059669',
            },
            {
              step: '05',
              icon: <SlidersHorizontal size={32} color="#d97706" />,
              title: '選擇分析模式',
              desc: '依需求選擇不同分析模式',
              color: '#fef3c7',
              border: '#d97706',
            },
            {
              step: '06',
              icon: <LayoutCards size={32} color="#dc2626" />,
              title: '得到 HMW 卡片',
              desc: 'AI 生成 How Might We 問題卡片，支援群眾投票表決最佳HMW',
              color: '#fee2e2',
              border: '#dc2626',
              badge: <span className="hiw-vote-badge"><ThumbsUp size={12} color="#dc2626" /> 趣味投票</span>,
            },
          ].map((item, i, arr) => (
            <div key={item.step} className="hiw-step-wrapper">
              <div className="hiw-step-card" style={{ '--step-border': item.border }}>
                <div className="hiw-step-num" style={{ background: item.color, color: item.border }}>{item.step}</div>
                <div className="hiw-step-icon" style={{ background: item.color, borderColor: item.border }}>
                  {item.icon}
                </div>
                <h3 className="hiw-step-title">{item.title}</h3>
                <p className="hiw-step-desc">{item.desc}</p>
                {item.badge && <div className="hiw-badge-row">{item.badge}</div>}
              </div>
              {i < arr.length - 1 && (
                <div className="hiw-arrow">
                  <ArrowRight size={20} color="#9ca3af" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA Section ===== */}
      <section className="cta-section">
        <h2 className="cta-title">準備好開始了嗎？</h2>
        <p className="cta-subtitle">建立研究房間，邀請團隊成員一起分析</p>
        <button onClick={handleStart} className="btn btn-outline btn-lg">
          <Rocket size={20} />
          立即開始
        </button>
      </section>

      {/* ===== Contact Section ===== */}
      <section id="contact" style={{
        padding: 'var(--space-10) var(--space-4)',
        margin: 'var(--space-3)',
        background: '#fff',
        borderRadius: 'var(--radius-2xl)',
        border: '3px solid var(--color-dark)',
        boxShadow: 'var(--shadow-neobrutalism-xl)'
      }}>
        <h2 className="contact-title">
          <Mail size={28} color="#1a1a2e" />
          聯絡我們
        </h2>
        <p className="contact-subtitle">本平台僅供學術研究使用，研究過程中所蒐集之資料，僅限於本研究之分析與學術成果使用，不作其他商業用途。遇到問題或有任何建議時，歡迎與我們聯繫</p>

        {contactSuccess ? (
          <div className="contact-success flex-center" style={{ padding: 40, borderRadius: 16 }}>
            <CheckCircle size={24} style={{ marginRight: 10 }} />
            訊息已送出！我們會盡快回覆您
          </div>
        ) : (
          <form onSubmit={handleContactSubmit} style={{ maxWidth: 600, margin: '0 auto' }}>
            {contactError && <div className="alert alert-error">{contactError}</div>}

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">姓名 *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={e => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="您的姓名"
                  className="form-input"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">發生問題 *</label>
              <textarea
                value={contactForm.problem}
                onChange={e => setContactForm(prev => ({ ...prev, problem: e.target.value }))}
                placeholder="請描述您遇到的問題或想要詢問的事項..."
                className="form-textarea"
                rows={4}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={contactLoading} style={{ marginTop: 8 }}>
              {contactLoading ? '送出中...' : (
                <>
                  <Send size={18} />
                  送出訊息
                </>
              )}
            </button>
          </form>
        )}
      </section>

      {/* ===== Footer ===== */}
      <footer className="landing-footer">
        <p>© 2024 Human-AI HMW Platform. Designed for Design Thinking Workshops.</p>
        <p style={{ marginTop: 8 }}>
          研究者聯絡信箱：
          <a href="mailto:drhhtang@gapps.ntust.edu.tw" className="footer-email">
            drhhtang@gapps.ntust.edu.tw
          </a>
        </p>
      </footer>
    </div>
  )
}

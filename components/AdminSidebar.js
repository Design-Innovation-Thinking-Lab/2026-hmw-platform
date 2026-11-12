import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
    Home,
    Settings,
    ClipboardList,
    Users,
    BarChart,
    Shield,
    LogOut,
    Menu,
    ChevronLeft
} from './icons'

/**
 * AdminSidebar with permission-based menu visibility.
 *
 * @param {object} props
 * @param {boolean} props.isAdmin - Is user system_admin
 * @param {string}  props.currentPath
 * @param {string}  props.userName
 * @param {object}  props.permissions - { manage_modes, manage_roles, view_results, manage_users }
 */
export default function AdminSidebar({ isAdmin = false, currentPath = '', userName = '', permissions = {} }) {
    const router = useRouter()
    const [isExpanded, setIsExpanded] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('sidebarExpanded')
        if (saved === 'true') {
            setIsExpanded(true)
        }
    }, [])

    const toggleSidebar = () => {
        const newState = !isExpanded
        setIsExpanded(newState)
        localStorage.setItem('sidebarExpanded', newState.toString())
    }

    const handleLogout = () => {
        localStorage.removeItem('adminAuth')
        localStorage.removeItem('adminAuthTime')
        localStorage.removeItem('isAdmin')
        localStorage.removeItem('userId')
        localStorage.removeItem('userName')
        router.push('/')
    }

    // Menu items with permission requirements
    const menuItems = [
        { icon: Home, label: '首頁', path: '/', exact: true, always: true },
        { icon: Settings, label: '分析模式管理', path: '/admin', exact: true, permKey: 'manage_modes' },
        { icon: Users, label: '角色管理', path: '/admin/roles', exact: true, permKey: 'manage_roles' },
        { icon: BarChart, label: '分析結果', path: '/admin/results', exact: true, permKey: 'view_results' },
        { icon: Shield, label: '權限管理', path: '/admin/users', exact: true, permKey: 'manage_users' },
    ]

    const isActive = (item) => {
        if (item.exact) {
            return currentPath === item.path
        }
        return currentPath.startsWith(item.path)
    }

    const isVisible = (item) => {
        if (item.always) return true
        // system_admin sees everything
        if (isAdmin) return true
        // Check per-feature permission
        if (item.permKey && permissions[item.permKey]) return true
        return false
    }

    return (
        <aside style={{
            ...styles.sidebar,
            width: isExpanded ? 200 : 64
        }}>
            {/* User Greeting */}
            <div style={styles.userSection}>
                {isExpanded ? (
                    <span style={styles.greeting}>Hi, {userName || 'User'}!</span>
                ) : (
                    <span style={styles.userInitial}>{(userName || 'U')[0].toUpperCase()}</span>
                )}
            </div>

            {/* Toggle Button */}
            <button onClick={toggleSidebar} style={styles.toggleButton}>
                {isExpanded ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>

            {/* Menu Items */}
            <nav style={styles.nav}>
                {menuItems.map((item, index) => {
                    if (!isVisible(item)) return null

                    const Icon = item.icon
                    const active = isActive(item)

                    return (
                        <a
                            key={index}
                            href={item.path}
                            style={{
                                ...styles.menuItem,
                                ...(active ? styles.menuItemActive : {}),
                                justifyContent: isExpanded ? 'flex-start' : 'center'
                            }}
                            title={!isExpanded ? item.label : undefined}
                        >
                            <Icon size={22} color={active ? '#4361ee' : '#6b7280'} />
                            {isExpanded && (
                                <span style={{
                                    ...styles.menuLabel,
                                    color: active ? '#4361ee' : '#374151'
                                }}>
                                    {item.label}
                                </span>
                            )}
                        </a>
                    )
                })}
            </nav>

            {/* Logout Button */}
            <button onClick={handleLogout} style={{
                ...styles.logoutButton,
                justifyContent: isExpanded ? 'flex-start' : 'center'
            }}>
                <LogOut size={20} color="#dc2626" />
                {isExpanded && <span style={styles.logoutLabel}>登出</span>}
            </button>
        </aside>
    )
}

const styles = {
    sidebar: {
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        background: '#fff',
        borderRight: '2px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 8px',
        transition: 'width 0.2s ease',
        zIndex: 100,
        boxShadow: '2px 0 8px rgba(0,0,0,0.05)'
    },
    userSection: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 0 16px 0',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: 8
    },
    greeting: {
        fontSize: 14,
        fontWeight: 600,
        color: '#1a1a2e',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    userInitial: {
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: '#4361ee',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        fontWeight: 700
    },
    toggleButton: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '10px 0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: '#6b7280',
        marginBottom: 8
    },
    nav: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 4
    },
    menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px',
        borderRadius: 10,
        textDecoration: 'none',
        transition: 'background 0.15s',
        cursor: 'pointer'
    },
    menuItemActive: {
        background: '#f0f4ff'
    },
    menuLabel: {
        fontSize: 14,
        fontWeight: 500,
        whiteSpace: 'nowrap'
    },
    logoutButton: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px',
        background: '#fef2f2',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        marginTop: 'auto'
    },
    logoutLabel: {
        fontSize: 14,
        fontWeight: 500,
        color: '#dc2626'
    }
}

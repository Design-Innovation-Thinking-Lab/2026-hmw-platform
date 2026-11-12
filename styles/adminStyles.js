/**
 * Shared Admin Page Styles
 * This file contains all unified styles used across admin pages
 * for consistency and easier maintenance.
 * 
 * All admin pages should use these styles via:
 * import { adminStyles } from '../../styles/adminStyles'
 * const styles = { ...adminStyles }
 */

export const adminStyles = {
    // ========== Layout ==========
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
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'linear-gradient(135deg, #fef5e7 0%, #fff5f5 50%, #f0fdf4 100%)',
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease'
    },

    // ========== Header (統一) ==========
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
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: 16
    },
    headerTitleGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
    },
    // 統一標題字體大小為 22px
    title: {
        fontSize: 22,
        fontWeight: 700,
        color: '#1a1a2e',
        margin: 0
    },

    // ========== Body Content (統一內頁區塊) ==========
    // 統一 padding 為 32px 40px, maxWidth 為 1400
    body: {
        padding: '32px 40px',
        maxWidth: 1400,
        margin: '0 auto'
    },
    // 保留 mainContent 作為別名，向後兼容
    mainContent: {
        padding: '32px 40px',
        maxWidth: 1400,
        margin: '0 auto'
    },

    // ========== Messages (統一) ==========
    error: {
        padding: 14,
        background: '#fee2e2',
        color: '#dc2626',
        borderRadius: 8,
        marginBottom: 16,
        border: '2px solid #fecaca'
    },
    success: {
        padding: 14,
        background: '#dcfce7',
        color: '#16a34a',
        borderRadius: 8,
        marginBottom: 16,
        border: '2px solid #86efac'
    },
    loading: {
        textAlign: 'center',
        padding: 60,
        color: '#6b7280',
        fontSize: 16
    },
    empty: {
        textAlign: 'center',
        padding: 80,
        background: '#fff',
        borderRadius: 16,
        border: '2px dashed #d1d5db'
    },
    emptyText: {
        fontSize: 18,
        color: '#374151',
        marginBottom: 8
    },
    emptyHint: {
        fontSize: 14,
        color: '#6b7280'
    },

    // ========== Buttons (統一) ==========
    addButton: {
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        fontSize: 14,
        background: '#4361ee',
        color: '#fff',
        border: '3px solid #1a1a2e',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 600,
        boxShadow: '3px 3px 0 #1a1a2e'
    },
    editButton: {
        flex: 1,
        padding: '10px 16px',
        fontSize: 14,
        background: '#4361ee',
        color: '#fff',
        border: '2px solid #1a1a2e',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    deleteButton: {
        padding: '10px 16px',
        fontSize: 14,
        background: '#fff',
        color: '#dc2626',
        border: '2px solid #fecaca',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center'
    },
    setDefaultButton: {
        padding: '10px 16px',
        fontSize: 14,
        background: '#fff',
        color: '#92400e',
        border: '2px solid #fde68a',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center'
    },
    unsetDefaultButton: {
        padding: '10px 16px',
        fontSize: 14,
        background: '#fef3c7',
        color: '#92400e',
        border: '2px solid #f59e0b',
        borderRadius: 8,
        cursor: 'pointer',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center'
    },
    cancelButton: {
        flex: 1,
        padding: '12px 20px',
        fontSize: 14,
        background: '#f3f4f6',
        color: '#374151',
        border: '2px solid #e5e7eb',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 500
    },
    submitButton: {
        flex: 1,
        padding: '12px 20px',
        fontSize: 14,
        background: '#10b981',
        color: '#fff',
        border: '2px solid #1a1a2e',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 600
    },
    dangerButton: {
        flex: 1,
        padding: '12px 20px',
        fontSize: 14,
        background: '#dc2626',
        color: '#fff',
        border: '2px solid #1a1a2e',
        borderRadius: 10,
        cursor: 'pointer',
        fontWeight: 600
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

    // ========== Navigation ==========
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
    backLink: {
        display: 'flex',
        alignItems: 'center',
        color: '#6b7280',
        textDecoration: 'none',
        marginRight: 16,
        fontSize: 14,
        fontWeight: 500
    },

    // ========== Grid (統一) ==========
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 24
    },
    rolesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
        gap: 24
    },

    // ========== Cards (統一) ==========
    card: {
        background: '#fff',
        borderRadius: 16,
        border: '2px solid #e5e7eb',
        padding: 24,
        transition: 'border-color 0.2s, box-shadow 0.2s'
    },
    roleCard: {
        background: '#fff',
        borderRadius: 16,
        border: '2px solid #e5e7eb',
        padding: 24,
        transition: 'border-color 0.2s, box-shadow 0.2s'
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 600,
        color: '#1a1a2e',
        margin: 0
    },
    roleName: {
        fontSize: 18,
        fontWeight: 600,
        color: '#1a1a2e',
        margin: 0
    },
    cardDesc: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
        lineHeight: 1.5
    },
    roleDesc: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
        lineHeight: 1.5
    },
    cardMeta: {
        display: 'flex',
        gap: 16,
        fontSize: 13,
        color: '#9ca3af',
        marginBottom: 16
    },
    cardActions: {
        display: 'flex',
        gap: 12,
        borderTop: '1px solid #f3f4f6',
        paddingTop: 16
    },
    addCard: {
        background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
        borderRadius: 16,
        border: '3px dashed #4361ee',
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
        minHeight: 280
    },
    addCardTitle: {
        fontSize: 18,
        fontWeight: 700,
        color: '#4361ee',
        margin: 0,
        marginBottom: 8,
        textAlign: 'center'
    },
    addCardHint: {
        fontSize: 14,
        color: '#6b7280',
        margin: 0,
        textAlign: 'center'
    },

    // ========== Badges ==========
    defaultBadge: {
        display: 'flex',
        alignItems: 'center',
        padding: '4px 10px',
        fontSize: 12,
        background: '#fef3c7',
        color: '#92400e',
        borderRadius: 6,
        fontWeight: 500
    },
    projectBadge: {
        display: 'inline-block',
        padding: '4px 12px',
        background: '#e0e7ff',
        color: '#4338ca',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: 'nowrap'
    },

    // ========== Modal (統一) ==========
    modalOverlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
    },
    modalLarge: {
        background: '#fff',
        borderRadius: 16,
        padding: 32,
        width: '100%',
        maxWidth: 600,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 700,
        color: '#1a1a2e',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center'
    },
    modalActions: {
        display: 'flex',
        gap: 12,
        marginTop: 24
    },

    // ========== Forms (統一) ==========
    formGroup: {
        marginBottom: 20
    },
    formLabel: {
        display: 'block',
        fontSize: 14,
        fontWeight: 600,
        color: '#374151',
        marginBottom: 8
    },
    input: {
        width: '100%',
        padding: '12px 14px',
        fontSize: 15,
        border: '2px solid #e5e7eb',
        borderRadius: 10,
        outline: 'none',
        boxSizing: 'border-box'
    },
    textarea: {
        width: '100%',
        padding: '12px 14px',
        fontSize: 15,
        border: '2px solid #e5e7eb',
        borderRadius: 10,
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
        fontFamily: 'inherit'
    },
    select: {
        padding: '10px 14px',
        fontSize: 14,
        border: '2px solid #e5e7eb',
        borderRadius: 8,
        background: '#fff',
        cursor: 'pointer',
        minWidth: 180
    },

    // ========== Filters (統一) ==========
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
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    dateInput: {
        padding: '10px 14px',
        fontSize: 14,
        border: '2px solid #e5e7eb',
        borderRadius: 8,
        background: '#fff'
    },

    // ========== Table (統一) ==========
    tableContainer: {
        overflowX: 'auto',
        background: '#fff',
        borderRadius: 16,
        border: '2px solid #e5e7eb'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse'
    },
    tableHeaderRow: {
        background: '#f9fafb'
    },
    th: {
        padding: '14px 20px',
        textAlign: 'left',
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
        borderBottom: '2px solid #e5e7eb',
        whiteSpace: 'nowrap'
    },
    tableRow: {
        borderBottom: '1px solid #f3f4f6'
    },
    td: {
        padding: '16px 20px',
        fontSize: 14,
        color: '#374151'
    },

    // ========== Info Box ==========
    infoBox: {
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 20,
        fontSize: 14,
        color: '#0369a1'
    },

    // ========== Delete Confirm ==========
    deleteWarning: {
        fontSize: 15,
        color: '#374151',
        marginBottom: 12
    },
    deleteNote: {
        fontSize: 13,
        color: '#6b7280',
        background: '#fef2f2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16
    },

    // ========== Prompt Preview (roles page) ==========
    promptPreview: {
        background: '#f9fafb',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16
    },
    promptLabel: {
        fontSize: 12,
        fontWeight: 600,
        color: '#6b7280',
        marginBottom: 6,
        display: 'block'
    },
    promptContent: {
        fontSize: 13,
        color: '#374151',
        whiteSpace: 'pre-wrap',
        margin: 0,
        fontFamily: 'inherit',
        maxHeight: 100,
        overflow: 'auto'
    }
}

export default adminStyles

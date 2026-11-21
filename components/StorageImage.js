import { useEffect, useState } from 'react'
import { getSignedUrl, isExternalUrl } from '../lib/storageClient'

// 顯示圖片：value 是完整網址就直接用；是私人 bucket 的物件路徑就先換成 signed URL。
export default function StorageImage({ value, alt = '', style }) {
    const [src, setSrc] = useState(isExternalUrl(value) ? value : null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        setFailed(false)
        if (!value) { setSrc(null); return }
        if (isExternalUrl(value)) { setSrc(value); return }
        let cancelled = false
        getSignedUrl(value)
            .then(url => { if (!cancelled) setSrc(url) })
            .catch(() => { if (!cancelled) setFailed(true) })
        return () => { cancelled = true }
    }, [value])

    if (failed) return <div style={{ ...style, padding: 12, color: '#b91c1c' }}>圖片無法載入</div>
    if (!src) return <div style={{ ...style, padding: 12, color: '#6b7280' }}>載入中…</div>
    return <img src={src} alt={alt} style={style} />
}

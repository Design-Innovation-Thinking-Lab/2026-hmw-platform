// 前端上傳／讀取私人 bucket 的檔案。
// 上傳：先向 /api/storage/upload-url 要 signed upload URL（伺服器檢查權限），
//       再由瀏覽器直接傳到 Supabase Storage（不經過 Vercel API，沒有 4.5 MB 限制）。
// 讀取：向 /api/storage/signed-url 要短時間有效的網址。
import { supabase } from './supabaseClient'
import { apiFetch } from './apiFetch'

/**
 * @param {object} opts { purpose, file, projectId?, stepId?, roomId? }
 * @returns {Promise<string>} Storage 物件路徑
 */
export async function uploadFile({ purpose, file, projectId, stepId, roomId }) {
  const res = await apiFetch('/api/storage/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose, projectId, stepId, roomId, fileName: file.name, size: file.size }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '無法取得上傳網址')

  const { error } = await supabase.storage
    .from(data.bucket)
    .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type || undefined })
  if (error) throw new Error('上傳失敗：' + error.message)

  return data.path
}

export async function getSignedUrl(path) {
  const res = await apiFetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '無法讀取檔案')
  return data.url
}

/** 存的是完整網址（手動輸入的外部圖片、舊資料）還是 Storage 路徑 */
export function isExternalUrl(value) {
  return /^https?:\/\//i.test(value || '')
}

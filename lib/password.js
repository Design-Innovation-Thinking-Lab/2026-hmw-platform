// 密碼規則。前端和伺服器端都會用，這裡不能放任何密鑰。
// 密碼本身由 Supabase Auth 保管，這個專案不儲存、也不比對密碼。

// Supabase 文件（Password security）：「Anything less than 8 characters is not recommended.」
export const MIN_PASSWORD_LENGTH = 8

// 伺服器端專用：管理員重設密碼時產生的臨時密碼。
import { randomInt } from 'crypto'

// 避開容易看錯的字元（0/O、1/l/I）
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateTempPassword(length = 12) {
    let out = ''
    for (let i = 0; i < length; i++) {
        out += TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)]
    }
    return out
}

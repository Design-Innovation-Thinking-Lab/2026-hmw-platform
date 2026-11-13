/**
 * 密碼雜湊工具（只在伺服器端使用：pages/api/、lib/、server/）
 *
 * 資料庫的 users.verification_password 只存 bcrypt 雜湊，不存明文。
 * 既有的明文密碼由 migrations/025_hash_passwords.sql 一次轉成雜湊。
 */
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'

// bcrypt 的運算成本。10 ≈ 每次約 0.1 秒：登入感覺不到，但大量猜密碼會很慢。
const BCRYPT_COST = 10

// 使用者不存在時也做一次比對，讓「帳號不存在」和「密碼錯誤」花的時間差不多，
// 避免攻擊者從回應時間猜出哪些學號／Email 有註冊。
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST)

/** bcrypt 雜湊的格式：$2a$ / $2b$ / $2y$ 開頭，總長 60 字元 */
export function isBcryptHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$\d{2}\$.{53}$/.test(value)
}

/** 把明文密碼轉成 bcrypt 雜湊，存進資料庫前呼叫 */
export async function hashPassword(plain) {
    if (typeof plain !== 'string' || plain.length === 0) {
        throw new Error('密碼不能是空的')
    }
    return bcrypt.hash(plain, BCRYPT_COST)
}

/**
 * 比對使用者輸入的密碼和資料庫存的雜湊。
 * storedHash 不是 bcrypt 格式（例如還沒轉換的明文、null）一律回傳 false，
 * 不會退回去比對明文。
 */
export async function verifyPassword(plain, storedHash) {
    if (typeof plain !== 'string' || plain.length === 0) return false
    if (!isBcryptHash(storedHash)) {
        await bcrypt.compare(plain, DUMMY_HASH)
        return false
    }
    return bcrypt.compare(plain, storedHash)
}

// 臨時密碼用的字元：拿掉容易看錯的 0/O、1/l/I
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** 產生隨機臨時密碼（管理員重設密碼用），使用加密等級的亂數 */
export function generateTempPassword(length = 10) {
    let result = ''
    for (let i = 0; i < length; i++) {
        result += TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)]
    }
    return result
}

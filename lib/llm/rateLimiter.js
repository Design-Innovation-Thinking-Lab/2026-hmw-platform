/**
 * lib/llm/rateLimiter.js - Global API Rate Limiter
 *
 * Sliding window rate limiter to prevent API 429 errors.
 * Controls requests per minute (RPM) across all concurrent analysis runs.
 */

const DEFAULT_MAX_RPM = 200

class RateLimiter {
    constructor(maxRPM) {
        this.maxRPM = maxRPM || Number(process.env.API_MAX_RPM) || Number(process.env.GEMINI_MAX_RPM) || DEFAULT_MAX_RPM
        this.timestamps = [] // Sliding window of request timestamps
        this.queue = []      // Pending resolve callbacks
        this.processing = false
        console.log(`🚦 Rate limiter initialized: ${this.maxRPM} RPM`)
    }

    /**
     * Acquire permission to make an API call.
     * Blocks (via Promise) until it's safe to proceed without exceeding RPM limit.
     */
    acquire() {
        return new Promise((resolve) => {
            this.queue.push(resolve)
            this._processQueue()
        })
    }

    _processQueue() {
        if (this.processing) return
        this.processing = true

        const process = () => {
            if (this.queue.length === 0) {
                this.processing = false
                return
            }

            // Clean up timestamps older than 60 seconds
            const now = Date.now()
            this.timestamps = this.timestamps.filter(t => now - t < 60000)

            if (this.timestamps.length < this.maxRPM) {
                // Under limit: allow request immediately
                this.timestamps.push(now)
                const resolve = this.queue.shift()
                resolve()
                // Process next in queue immediately (may also be under limit)
                setImmediate(process)
            } else {
                // Over limit: wait until the oldest timestamp expires
                const oldestTimestamp = this.timestamps[0]
                const waitMs = 60000 - (now - oldestTimestamp) + 100 // +100ms buffer
                console.log(`🚦 Rate limit reached (${this.timestamps.length}/${this.maxRPM} RPM). Waiting ${Math.round(waitMs / 1000)}s...`)
                setTimeout(process, waitMs)
            }
        }

        process()
    }
}

// Single global instance shared across all analysis runs
export const apiRateLimiter = new RateLimiter()

/**
 * Rate limit store interface: any implementation must expose
 * `incrementAndCheck(key, { limit, windowMs })` returning
 * `{ allowed, remaining, resetAt }`. Swap InMemoryStore for a Redis-backed
 * implementation (e.g. wrapping ioredis INCR/PEXPIRE) without touching
 * call sites.
 */
class InMemoryStore {
    constructor() {
        this.hits = new Map();
    }

    incrementAndCheck(key, { limit, windowMs }) {
        const now = Date.now();
        const entry = this.hits.get(key);

        if (!entry || entry.resetAt <= now) {
            this.hits.set(key, { count: 1, resetAt: now + windowMs });
            return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
        }

        entry.count += 1;
        const allowed = entry.count <= limit;

        return { allowed, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
    }
}

module.exports = { InMemoryStore };

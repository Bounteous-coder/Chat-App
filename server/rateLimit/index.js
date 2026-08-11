const { InMemoryStore } = require('./store');

const store = new InMemoryStore();

const checkLimit = (key, options) => store.incrementAndCheck(key, options);

const rateLimitMiddleware = ({ limit, windowMs, keyFn }) => (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const { allowed, resetAt } = checkLimit(key, { limit, windowMs });

    if (!allowed) {
        res.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
        return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    next();
};

module.exports = { checkLimit, rateLimitMiddleware };

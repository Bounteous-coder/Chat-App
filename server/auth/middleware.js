const { verifyAccessToken } = require('./tokens');

const requireAuth = (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = { id: payload.sub, username: payload.username };
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired access token' });
    }
};

const socketAuth = (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Missing auth token'));
    }

    try {
        const payload = verifyAccessToken(token);
        socket.user = { id: payload.sub, username: payload.username };
        next();
    } catch {
        next(new Error('Invalid or expired auth token'));
    }
};

module.exports = { requireAuth, socketAuth };

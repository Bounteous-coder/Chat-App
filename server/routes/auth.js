const express = require('express');
const router = express.Router();

const prisma = require('../prisma/client');
const { hashPassword, verifyPassword } = require('../auth/password');
const {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    REFRESH_TOKEN_TTL_MS,
} = require('../auth/tokens');
const { requireAuth } = require('../auth/middleware');

const REFRESH_COOKIE_NAME = 'refreshToken';

const isProduction = process.env.NODE_ENV === 'production';

const refreshCookieOptions = {
    httpOnly: true,
    // Cross-site because the frontend (Vercel) and backend (Railway) live on
    // different domains — SameSite=Lax would silently drop the cookie on fetch().
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: '/api/auth',
};

const issueSession = (res, user) => {
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

    return accessToken;
};

const publicUser = (user) => ({ id: user.id, username: user.username });

router.post('/register', async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'username and password are required' });
    }

    const normalizedUsername = username.trim().toLowerCase();

    if (normalizedUsername.length < 3 || normalizedUsername.length > 32) {
        return res.status(400).json({ error: 'Username must be 3-32 characters' });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { username: normalizedUsername } });

    if (existing) {
        return res.status(409).json({ error: 'Username is taken' });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
        data: { username: normalizedUsername, passwordHash },
    });

    const accessToken = issueSession(res, user);

    res.status(201).json({ accessToken, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'username and password are required' });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid username or password' });
    }

    const accessToken = issueSession(res, user);

    res.json({ accessToken, user: publicUser(user) });
});

router.post('/refresh', async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!token) {
        return res.status(401).json({ error: 'Missing refresh token' });
    }

    let payload;
    try {
        payload = verifyRefreshToken(token);
    } catch {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
        return res.status(401).json({ error: 'User no longer exists' });
    }

    const accessToken = issueSession(res, user);

    res.json({ accessToken, user: publicUser(user) });
});

router.post('/logout', (req, res) => {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: publicUser(user) });
});

module.exports = router;

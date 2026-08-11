const express = require('express');
const router = express.Router();

const prisma = require('../prisma/client');
const { requireAuth } = require('../auth/middleware');
const presence = require('../presence');

router.get('/search', requireAuth, async (req, res) => {
    const q = (req.query.q || '').toString().trim().toLowerCase();

    if (!q) {
        return res.json({ users: [] });
    }

    const users = await prisma.user.findMany({
        where: {
            username: { contains: q, mode: 'insensitive' },
            id: { not: req.user.id },
        },
        take: 20,
        orderBy: { username: 'asc' },
    });

    res.json({
        users: users.map((user) => ({
            id: user.id,
            username: user.username,
            online: presence.isOnline(user.id),
        })),
    });
});

module.exports = router;

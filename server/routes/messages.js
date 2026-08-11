const express = require('express');
const router = express.Router();

const prisma = require('../prisma/client');
const { requireAuth } = require('../auth/middleware');
const { serializeMessage } = require('../serializers');

router.get('/search', requireAuth, async (req, res) => {
    const q = (req.query.q || '').toString().trim();

    if (!q) return res.json({ messages: [] });

    const participantRows = await prisma.conversationParticipant.findMany({
        where: { userId: req.user.id },
        select: { conversationId: true },
    });
    const conversationIds = participantRows.map((p) => p.conversationId);

    if (conversationIds.length === 0) return res.json({ messages: [] });

    const rows = await prisma.$queryRaw`
        SELECT m.* FROM "Message" m
        WHERE m."conversationId" = ANY(${conversationIds}::text[])
          AND m."deletedAt" IS NULL
          AND to_tsvector('english', m."body") @@ plainto_tsquery('english', ${q})
        ORDER BY m."createdAt" DESC
        LIMIT 50
    `;

    const senderIds = [...new Set(rows.map((m) => m.senderId))];
    const senders = await prisma.user.findMany({ where: { id: { in: senderIds } } });
    const senderMap = new Map(senders.map((s) => [s.id, s]));

    res.json({
        messages: rows.map((m) =>
            serializeMessage({ ...m, sender: senderMap.get(m.senderId), attachments: [] })
        ),
    });
});

router.patch('/:id', requireAuth, async (req, res) => {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });

    if (!message || message.deletedAt) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== req.user.id) return res.status(403).json({ error: 'Not your message' });

    const body = (req.body.body || '').toString().trim();
    if (!body) return res.status(400).json({ error: 'body is required' });

    const updated = await prisma.message.update({
        where: { id: req.params.id },
        data: { body, editedAt: new Date() },
        include: { sender: true, attachments: true },
    });

    const serialized = serializeMessage(updated);
    req.app.get('io').to(`conversation:${updated.conversationId}`).emit('message:updated', serialized);

    res.json({ message: serialized });
});

router.delete('/:id', requireAuth, async (req, res) => {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });

    if (!message || message.deletedAt) return res.status(404).json({ error: 'Message not found' });
    if (message.senderId !== req.user.id) return res.status(403).json({ error: 'Not your message' });

    await prisma.message.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });

    req.app
        .get('io')
        .to(`conversation:${message.conversationId}`)
        .emit('message:deleted', { id: message.id, conversationId: message.conversationId });

    res.status(204).end();
});

module.exports = router;

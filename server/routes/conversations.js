const express = require('express');
const router = express.Router();

const prisma = require('../prisma/client');
const { requireAuth } = require('../auth/middleware');
const { upload } = require('../upload');
const { checkLimit } = require('../rateLimit');
const presence = require('../presence');
const { serializeMessage } = require('../serializers');

const assertParticipant = (conversationId, userId) =>
    prisma.conversationParticipant.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
    });

const serializeConversation = async (conversationId, requestingUserId) => {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            participants: { include: { user: true } },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { sender: true, attachments: true },
            },
        },
    });

    if (!conversation) return null;

    const myParticipant = conversation.participants.find((p) => p.userId === requestingUserId);
    const otherParticipants = conversation.participants.filter((p) => p.userId !== requestingUserId);
    const displayName =
        conversation.type === 'GROUP' ? conversation.name : otherParticipants[0]?.user.username;

    const unreadCount = await prisma.message.count({
        where: {
            conversationId,
            senderId: { not: requestingUserId },
            deletedAt: null,
            ...(myParticipant?.lastReadAt ? { createdAt: { gt: myParticipant.lastReadAt } } : {}),
        },
    });

    return {
        id: conversation.id,
        type: conversation.type,
        name: displayName,
        participants: conversation.participants.map((p) => ({
            id: p.user.id,
            username: p.user.username,
            online: presence.isOnline(p.user.id),
            lastReadAt: p.lastReadAt,
        })),
        lastMessage: conversation.messages[0] ? serializeMessage(conversation.messages[0]) : null,
        unreadCount,
    };
};

const notifyNewConversation = async (io, conversationId, participantIds) => {
    await Promise.all(
        participantIds.map(async (userId) => {
            presence.getSocketIds(userId).forEach((socketId) => {
                io.sockets.sockets.get(socketId)?.join(`conversation:${conversationId}`);
            });
            const summary = await serializeConversation(conversationId, userId);
            io.to(`user:${userId}`).emit('conversation:new', summary);
        })
    );
};

router.get('/', requireAuth, async (req, res) => {
    const participantRows = await prisma.conversationParticipant.findMany({
        where: { userId: req.user.id },
        select: { conversationId: true },
    });

    const conversations = await Promise.all(
        participantRows.map((p) => serializeConversation(p.conversationId, req.user.id))
    );

    conversations.sort((a, b) => {
        const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bt - at;
    });

    res.json({ conversations });
});

router.post('/', requireAuth, async (req, res) => {
    const { type, participantId, participantIds, name } = req.body || {};

    if (type === 'DIRECT') {
        if (!participantId || participantId === req.user.id) {
            return res.status(400).json({ error: 'participantId is required' });
        }

        const otherUser = await prisma.user.findUnique({ where: { id: participantId } });
        if (!otherUser) return res.status(404).json({ error: 'User not found' });

        const existing = await prisma.conversation.findFirst({
            where: {
                type: 'DIRECT',
                AND: [
                    { participants: { some: { userId: req.user.id } } },
                    { participants: { some: { userId: participantId } } },
                ],
            },
        });

        if (existing) {
            return res.json({ conversation: await serializeConversation(existing.id, req.user.id) });
        }

        const conversation = await prisma.conversation.create({
            data: {
                type: 'DIRECT',
                participants: { create: [{ userId: req.user.id }, { userId: participantId }] },
            },
        });

        await notifyNewConversation(req.app.get('io'), conversation.id, [req.user.id, participantId]);
        return res.status(201).json({ conversation: await serializeConversation(conversation.id, req.user.id) });
    }

    if (type === 'GROUP') {
        if (!name || !name.trim() || !Array.isArray(participantIds) || participantIds.length < 1) {
            return res.status(400).json({ error: 'name and at least one participantId are required' });
        }

        const uniqueIds = Array.from(new Set([...participantIds, req.user.id]));

        const conversation = await prisma.conversation.create({
            data: {
                type: 'GROUP',
                name: name.trim(),
                participants: { create: uniqueIds.map((userId) => ({ userId })) },
            },
        });

        await notifyNewConversation(req.app.get('io'), conversation.id, uniqueIds);
        return res.status(201).json({ conversation: await serializeConversation(conversation.id, req.user.id) });
    }

    res.status(400).json({ error: 'type must be DIRECT or GROUP' });
});

router.get('/:id', requireAuth, async (req, res) => {
    const participant = await assertParticipant(req.params.id, req.user.id);
    if (!participant) return res.status(403).json({ error: 'Not a participant of this conversation' });

    res.json({ conversation: await serializeConversation(req.params.id, req.user.id) });
});

router.get('/:id/messages', requireAuth, async (req, res) => {
    const participant = await assertParticipant(req.params.id, req.user.id);
    if (!participant) return res.status(403).json({ error: 'Not a participant of this conversation' });

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const before = req.query.before ? new Date(req.query.before) : undefined;

    const messages = await prisma.message.findMany({
        where: {
            conversationId: req.params.id,
            ...(before ? { createdAt: { lt: before } } : {}),
        },
        include: { sender: true, attachments: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });

    res.json({ messages: messages.reverse().map(serializeMessage) });
});

router.post('/:id/messages', requireAuth, upload.single('file'), async (req, res) => {
    const participant = await assertParticipant(req.params.id, req.user.id);
    if (!participant) return res.status(403).json({ error: 'Not a participant of this conversation' });

    const body = (req.body.body || '').toString().trim();
    if (!body && !req.file) {
        return res.status(400).json({ error: 'Message must have text or a file' });
    }

    const { allowed } = checkLimit(`message:${req.user.id}`, { limit: 20, windowMs: 10_000 });
    if (!allowed) return res.status(429).json({ error: 'Sending too fast, slow down' });

    const message = await prisma.message.create({
        data: {
            conversationId: req.params.id,
            senderId: req.user.id,
            body,
            attachments: req.file
                ? {
                      create: [
                          {
                              filename: req.file.filename,
                              originalName: req.file.originalname,
                              mimeType: req.file.mimetype,
                              size: req.file.size,
                          },
                      ],
                  }
                : undefined,
        },
        include: { sender: true, attachments: true },
    });

    const serialized = serializeMessage(message);
    req.app.get('io').to(`conversation:${req.params.id}`).emit('message:new', serialized);

    res.status(201).json({ message: serialized });
});

module.exports = router;

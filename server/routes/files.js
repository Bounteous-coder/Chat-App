const express = require('express');
const path = require('path');
const router = express.Router();

const prisma = require('../prisma/client');
const { requireAuth } = require('../auth/middleware');
const { UPLOAD_DIR } = require('../upload');

router.get('/:attachmentId', requireAuth, async (req, res) => {
    const attachment = await prisma.attachment.findUnique({
        where: { id: req.params.attachmentId },
        include: { message: true },
    });

    if (!attachment) return res.status(404).json({ error: 'File not found' });

    const participant = await prisma.conversationParticipant.findUnique({
        where: {
            userId_conversationId: {
                userId: req.user.id,
                conversationId: attachment.message.conversationId,
            },
        },
    });

    if (!participant) return res.status(403).json({ error: 'Not a participant of this conversation' });

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.sendFile(path.join(UPLOAD_DIR, attachment.filename));
});

module.exports = router;

const serializeMessage = (message) => ({
    id: message.id,
    conversationId: message.conversationId,
    body: message.deletedAt ? null : message.body,
    deleted: Boolean(message.deletedAt),
    editedAt: message.editedAt,
    createdAt: message.createdAt,
    sender: message.sender
        ? { id: message.sender.id, username: message.sender.username }
        : { id: message.senderId },
    attachments: (message.attachments || []).map((attachment) => ({
        id: attachment.id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        url: `/api/files/${attachment.id}`,
    })),
});

module.exports = { serializeMessage };

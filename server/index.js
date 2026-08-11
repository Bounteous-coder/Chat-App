require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const socketIo = require('socket.io');
const http = require('http');

const prisma = require('./prisma/client');
const { socketAuth } = require('./auth/middleware');
const { checkLimit } = require('./rateLimit');
const presence = require('./presence');
const { serializeMessage } = require('./serializers');

const router = require('./router');
const authRouter = require('./routes/auth');
const conversationsRouter = require('./routes/conversations');
const messagesRouter = require('./routes/messages');
const usersRouter = require('./routes/users');
const filesRouter = require('./routes/files');

const PORT = Number(process.env.PORT) || 5006;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: CLIENT_ORIGIN,
		methods: ['GET', 'POST'],
		credentials: true,
	},
});

app.set('io', io);

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/', router);
app.use('/api/auth', authRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/files', filesRouter);

io.use(socketAuth);

const PRESENCE_OFFLINE_GRACE_MS = 3000;

io.on('connection', async (socket) => {
	const { id: userId, username } = socket.user;

	console.log(`Socket connected: ${socket.id} (${username})`);

	socket.join(`user:${userId}`);

	const participantRows = await prisma.conversationParticipant.findMany({
		where: { userId },
		select: { conversationId: true },
	});
	const conversationIds = participantRows.map((p) => p.conversationId);
	conversationIds.forEach((id) => socket.join(`conversation:${id}`));

	const justCameOnline = presence.addSocket(userId, socket.id);
	if (justCameOnline) {
		conversationIds.forEach((id) =>
			socket.to(`conversation:${id}`).emit('presence:update', { userId, online: true })
		);
	}

	const inConversation = (conversationId) => socket.rooms.has(`conversation:${conversationId}`);

	socket.on('message:send', async ({ conversationId, body }, callback) => {
		const ack = typeof callback === 'function' ? callback : () => {};

		if (!inConversation(conversationId)) {
			return ack({ error: 'Not a participant of this conversation' });
		}

		const text = (body || '').toString().trim();
		if (!text) return ack({ error: 'Message body is required' });

		const { allowed } = checkLimit(`message:${userId}`, { limit: 20, windowMs: 10_000 });
		if (!allowed) return ack({ error: 'Sending too fast, slow down' });

		const message = await prisma.message.create({
			data: { conversationId, senderId: userId, body: text },
			include: { sender: true, attachments: true },
		});

		const serialized = serializeMessage(message);
		io.to(`conversation:${conversationId}`).emit('message:new', serialized);
		ack({ message: serialized });
	});

	socket.on('typing:start', ({ conversationId }) => {
		if (!inConversation(conversationId)) return;
		socket.to(`conversation:${conversationId}`).emit('typing:update', {
			conversationId,
			userId,
			username,
			typing: true,
		});
	});

	socket.on('typing:stop', ({ conversationId }) => {
		if (!inConversation(conversationId)) return;
		socket.to(`conversation:${conversationId}`).emit('typing:update', {
			conversationId,
			userId,
			username,
			typing: false,
		});
	});

	socket.on('conversation:markRead', async ({ conversationId }) => {
		if (!inConversation(conversationId)) return;

		const updated = await prisma.conversationParticipant.updateMany({
			where: { userId, conversationId },
			data: { lastReadAt: new Date() },
		});

		if (updated.count === 0) return;

		io.to(`conversation:${conversationId}`).emit('conversation:read', {
			conversationId,
			userId,
			lastReadAt: new Date().toISOString(),
		});
	});

	socket.on('disconnect', () => {
		console.log(`Socket disconnected: ${socket.id} (${username})`);

		const justWentOffline = presence.removeSocket(userId, socket.id);
		if (!justWentOffline) return;

		setTimeout(() => {
			if (presence.isOnline(userId)) return;
			conversationIds.forEach((id) =>
				io.to(`conversation:${id}`).emit('presence:update', { userId, online: false })
			);
		}, PRESENCE_OFFLINE_GRACE_MS);
	});
});

let shuttingDown = false;

const shutdown = (signal) => {
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;
	console.log(`Received ${signal}, closing server...`);

	io.close(() => {
		server.close(() => {
			prisma.$disconnect().finally(() => process.exit(0));
		});
	});
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGUSR2', () => shutdown('SIGUSR2'));

server.listen(PORT, () => {
	console.log(`Server has started on port ${PORT}`);
});

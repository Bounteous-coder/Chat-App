const express = require('express');
const socketIo = require('socket.io');
const http = require("http");
const router = require('./router');

const PORT = Number(process.env.PORT) || 5006;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use('/', router);

io.on('connection', (socket) => {
	console.log(`New connection made: ${socket.id}`);

	socket.on('disconnect', () => {
		console.log(`User left: ${socket.id}`);
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
			process.exit(0);
		});
	});
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGUSR2', () => shutdown('SIGUSR2'));

server.listen(PORT, () => {
	console.log(`Server has started on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const socketIo = require('socket.io');
const http = require("http");

const {addUser, removeUser, getUser, getUsersInRoom} = require('./users.js');

const router = require('./router');

const PORT = Number(process.env.PORT) || 5006;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
	cors: {
		origin: CLIENT_ORIGIN,
		methods: ['GET', 'POST'],
	},
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use('/', router);

io.on('connection', (socket) => {
	console.log(`New connection made: ${socket.id}`);

	socket.on('join', ({ name, room }, callback) => {
		const { error, user} = addUser({id: socket.id, name, room});

		if(error) return callback(error);
		socket.emit('message', {user: 'admin', text: `${user.name}, welcome to the room ${user.room}`})
		socket.broadcast.to(user.room).emit('message', {user: 'admin', text: `${user.name}, has joined!`});

		socket.join(user.room);

		callback();
	});

	socket.on('sendMessage', (message, callback) => {
		const user = getUser(socket.id);

		if (!user) return callback('You must join a room before sending messages');

		io.to(user.room).emit('message', {user: user.name, text: message});

		callback();
	})

	socket.on('disconnect', () => {
		const user = removeUser(socket.id);

		if (user) {
			io.to(user.room).emit('message', {user: 'admin', text: `${user.name} has left.`});
		}

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

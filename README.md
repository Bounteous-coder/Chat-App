# Real-Time Chat Application

A realtime group chat app built with React and Socket.IO. Users pick a
display name and a room, then exchange messages live with everyone else
in that room.

## Features

- Join a named chat room by display name + room name
- Realtime messaging over WebSockets (Socket.IO)
- Join/leave system messages broadcast to the room
- Duplicate name-in-room protection
- Responsive, styled UI (no component library)

## Tech Stack

Frontend:
- React 19 (Vite)
- react-router-dom

Backend:
- Node.js
- Express
- Socket.IO

## Project Structure

```
client/   React + Vite frontend
server/   Express + Socket.IO backend
```

## Running locally

Server (defaults to port 5006):

```
cd server
npm install
npm start
```

Client (defaults to port 5173):

```
cd client
npm install
npm run dev
```

Set `CLIENT_ORIGIN` in the server environment if the client isn't running
on the default Vite port, so CORS allows the connection.

## How It Works

### Joining a room

The Join screen collects a name and room, then navigates to `/chat` with
both as query params. On mount, `Chat` opens a Socket.IO connection and
emits a `join` event; the server adds the user to an in-memory room
registry and acknowledges. If the name is already taken in that room, the
server returns an error and the client is redirected back to Join.

### Realtime Messaging

Messages are emitted over the socket connection and broadcast server-side
to everyone in the same room via Socket.IO rooms. There's no message
history — messages exist only for the duration of the connection.

## Known Limitations

- No message persistence (in-memory only, resets on server restart)
- No authentication — anyone can join with any name
- No typing indicators, read receipts, or file sharing

## Future Improvements

- Persist users/messages to a database
- Authentication
- Typing indicators
- Room presence list

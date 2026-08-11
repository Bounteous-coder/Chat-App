# Real-Time Chat Application

A full-stack realtime chat app: JWT authentication, persisted direct
and group conversations, live messaging, presence, typing indicators,
read receipts, message editing/deletion, full-text search, and file
sharing.

## Features

- JWT-based authentication (access token + httpOnly refresh cookie)
- Direct messages and named group conversations
- Realtime messaging over WebSockets (Socket.IO), scoped per conversation
- Online/offline presence
- Typing indicators
- Read receipts ("Seen" / "Seen by N")
- Message editing and soft deletion, synced live
- Full-text message search (Postgres `tsvector`)
- File/image sharing with inline image previews
- Rate limiting on auth and message-send endpoints
- Responsive UI down to mobile widths (no component library)

## Tech Stack

Frontend:
- React 19 (Vite)
- react-router-dom
- socket.io-client

Backend:
- Node.js, Express
- Socket.IO
- PostgreSQL + Prisma
- JWT (`jsonwebtoken`) + `bcrypt`
- `multer` for uploads

## Project Structure

```
client/           React + Vite frontend
server/           Express + Socket.IO backend
  prisma/         schema + migrations
  auth/           JWT + bcrypt helpers, Express/Socket.IO auth middleware
  routes/         auth, conversations, messages, users, files
  rateLimit/      pluggable rate-limit store (in-memory today, Redis-ready)
  uploads/        uploaded files (gitignored)
docker-compose.yml  Postgres for local dev
```

## Running locally

Start Postgres:

```
docker compose up -d postgres
```

Server (defaults to port 5006):

```
cd server
npm install
cp .env.example .env   # adjust JWT secrets / DATABASE_URL if needed
npx prisma migrate dev
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

### Authentication

Register/login issue a short-lived JWT access token (returned to the
client and kept in memory, not localStorage) plus a longer-lived refresh
token in an httpOnly cookie. The client silently refreshes the access
token on 401s and on a timer. The same access token authenticates both
REST requests (`Authorization: Bearer`) and the Socket.IO connection
(verified in the handshake before any events are accepted).

### Conversations & messaging

Conversations are either `DIRECT` (deduped 1:1) or `GROUP`, backed by a
`ConversationParticipant` join table. A socket only joins the
`conversation:<id>` rooms it's actually a participant of. Message
history loads via REST with pagination; new messages, edits, and
deletions broadcast live over the socket to everyone in the room.

### Presence, typing, and read receipts

Presence is tracked in memory per connected socket and broadcast to
users who share a conversation. Typing indicators are ephemeral socket
events scoped to a conversation. Read receipts track a per-participant
"read up to" timestamp, updated on view and broadcast so senders see a
live "Seen" indicator.

### File sharing

Uploads go through a multipart REST endpoint (`multer`) and are stored
under `server/uploads`. Downloads are served through an authenticated
route that checks the requester is a participant in the file's
conversation — plain static file serving can't do that per-request
check, which is why files aren't served via `express.static`.

## Known Limitations

- Presence, typing, and rate limiting are in-memory and single-instance
  only (documented as the swap point for Redis — see `rateLimit/store.js`)
- No password reset flow (no email service configured)
- Read receipts are conversation-level ("read up to"), not per-message

## Testing

- `server/smoke-test.js` — end-to-end backend smoke test (auth,
  conversations, messaging, presence, typing, edit/delete, read
  receipts, file upload/download, search, rate limiting) against a
  running server + Postgres. Run with `npm test` from `server/`.

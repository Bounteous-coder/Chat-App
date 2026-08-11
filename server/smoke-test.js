const { io } = require('socket.io-client');

const BASE = 'http://localhost:5006';
let failures = 0;

const assert = (cond, msg) => {
    if (cond) {
        console.log(`PASS: ${msg}`);
    } else {
        console.log(`FAIL: ${msg}`);
        failures += 1;
    }
};

const api = async (path, options = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    let body = null;
    try {
        body = await res.json();
    } catch {
        /* no body */
    }
    return { status: res.status, body };
};

const rand = () => Math.random().toString(36).slice(2, 10);

async function run() {
    const aliceName = `alice_${rand()}`;
    const bobName = `bob_${rand()}`;

    // --- Auth ---
    const badAuth = await api('/api/auth/me', { headers: { Authorization: 'Bearer garbage' } });
    assert(badAuth.status === 401, 'rejects invalid access token on REST');

    const shortPw = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: aliceName, password: 'short' }),
    });
    assert(shortPw.status === 400, 'rejects password under 8 chars');

    const aliceReg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: aliceName, password: 'password123' }),
    });
    assert(aliceReg.status === 201 && aliceReg.body.accessToken, 'registers alice and returns access token');
    const aliceToken = aliceReg.body.accessToken;
    const aliceId = aliceReg.body.user.id;

    const dupeReg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: aliceName, password: 'password123' }),
    });
    assert(dupeReg.status === 409, 'rejects duplicate username');

    const bobReg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: bobName, password: 'password123' }),
    });
    assert(bobReg.status === 201, 'registers bob');
    const bobToken = bobReg.body.accessToken;
    const bobId = bobReg.body.user.id;

    const badLogin = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: aliceName, password: 'wrongpassword' }),
    });
    assert(badLogin.status === 401, 'rejects wrong password on login');

    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    // --- User search ---
    const search = await api(`/api/users/search?q=${bobName.slice(0, 4)}`, { headers: auth(aliceToken) });
    assert(
        search.status === 200 && search.body.users.some((u) => u.username === bobName),
        'user search finds bob'
    );

    // --- Conversations ---
    const createDm = await api('/api/conversations', {
        method: 'POST',
        headers: auth(aliceToken),
        body: JSON.stringify({ type: 'DIRECT', participantId: bobId }),
    });
    assert(createDm.status === 201, 'alice creates a DM with bob');
    const dmId = createDm.body.conversation.id;

    const dedupeDm = await api('/api/conversations', {
        method: 'POST',
        headers: auth(aliceToken),
        body: JSON.stringify({ type: 'DIRECT', participantId: bobId }),
    });
    assert(dedupeDm.body.conversation.id === dmId, 'creating the same DM again returns the existing conversation');

    const carolReg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: `carol_${rand()}`, password: 'password123' }),
    });
    const carolToken = carolReg.body.accessToken;
    const carolId = carolReg.body.user.id;

    const createGroup = await api('/api/conversations', {
        method: 'POST',
        headers: auth(aliceToken),
        body: JSON.stringify({ type: 'GROUP', name: 'Test Group', participantIds: [bobId, carolId] }),
    });
    assert(createGroup.status === 201, 'alice creates a group with bob and carol');
    const groupId = createGroup.body.conversation.id;

    const daveReg = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: `dave_${rand()}`, password: 'password123' }),
    });
    const daveToken = daveReg.body.accessToken;

    const forbiddenGet = await api(`/api/conversations/${dmId}`, { headers: auth(daveToken) });
    assert(forbiddenGet.status === 403, 'non-participant cannot fetch conversation detail');

    // --- Sockets: connect alice, bob, dave ---
    const connect = (token) =>
        new Promise((resolve, reject) => {
            const socket = io(BASE, { auth: { token } });
            socket.on('connect', () => resolve(socket));
            socket.on('connect_error', reject);
        });

    const aliceSocket = await connect(aliceToken);
    const bobSocket = await connect(bobToken);
    const daveSocket = await connect(daveToken);
    assert(true, 'alice, bob, and dave sockets connected');

    const noAuthConnect = await new Promise((resolve) => {
        const socket = io(BASE, { auth: {} });
        socket.on('connect_error', (err) => resolve(err.message));
        socket.on('connect', () => resolve('CONNECTED'));
    });
    assert(noAuthConnect !== 'CONNECTED', 'socket without a token is rejected');

    await new Promise((r) => setTimeout(r, 300));

    // --- Presence ---
    const bobPresence = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 2000);
        bobSocket.on('presence:update', (payload) => {
            if (payload.userId !== carolId) return;
            clearTimeout(timeout);
            resolve(payload);
        });
        api('/api/conversations', {
            method: 'POST',
            headers: auth(carolToken),
            body: JSON.stringify({ type: 'DIRECT', participantId: bobId }),
        }).then(() => connect(carolToken));
    });
    assert(bobPresence && bobPresence.online === true, 'bob is notified when carol comes online in a shared conversation');

    // --- Typing ---
    const typingPromise = new Promise((resolve) => {
        bobSocket.once('typing:update', resolve);
    });
    aliceSocket.emit('typing:start', { conversationId: dmId });
    const typingEvent = await Promise.race([typingPromise, new Promise((r) => setTimeout(() => r(null), 2000))]);
    assert(typingEvent && typingEvent.userId === aliceId && typingEvent.typing === true, 'bob receives typing indicator from alice');

    // --- Messaging over socket ---
    const messagePromise = new Promise((resolve) => bobSocket.once('message:new', resolve));
    const sendAck = await new Promise((resolve) => {
        aliceSocket.emit('message:send', { conversationId: dmId, body: 'Hello Bob!' }, resolve);
    });
    assert(sendAck.message && sendAck.message.body === 'Hello Bob!', 'alice sends a message over socket, gets ack');
    const received = await messagePromise;
    assert(received.body === 'Hello Bob!', 'bob receives message:new in realtime');

    const daveBlocked = await new Promise((resolve) => {
        daveSocket.emit('message:send', { conversationId: dmId, body: 'sneaky' }, resolve);
    });
    assert(daveBlocked.error, 'dave (non-participant) cannot send into the DM');

    // --- History via REST ---
    const history = await api(`/api/conversations/${dmId}/messages`, { headers: auth(bobToken) });
    assert(
        history.status === 200 && history.body.messages.some((m) => m.body === 'Hello Bob!'),
        'message history via REST includes the sent message'
    );

    // --- Edit / delete ---
    const messageId = sendAck.message.id;
    const editRes = await api(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: auth(aliceToken),
        body: JSON.stringify({ body: 'Hello Bob! (edited)' }),
    });
    assert(editRes.status === 200 && editRes.body.message.editedAt, 'alice edits her own message');

    const editByBob = await api(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: auth(bobToken),
        body: JSON.stringify({ body: 'hijacked' }),
    });
    assert(editByBob.status === 403, "bob cannot edit alice's message");

    const deleteRes = await api(`/api/messages/${messageId}`, { method: 'DELETE', headers: auth(aliceToken) });
    assert(deleteRes.status === 204, 'alice deletes her own message');

    const afterDelete = await api(`/api/conversations/${dmId}/messages`, { headers: auth(bobToken) });
    const deletedMsg = afterDelete.body.messages.find((m) => m.id === messageId);
    assert(deletedMsg && deletedMsg.deleted === true && deletedMsg.body === null, 'deleted message shows as deleted with no body');

    // --- Read receipts ---
    const readPromise = new Promise((resolve) => aliceSocket.once('conversation:read', resolve));
    bobSocket.emit('conversation:markRead', { conversationId: dmId });
    const readEvent = await Promise.race([readPromise, new Promise((r) => setTimeout(() => r(null), 2000))]);
    assert(readEvent && readEvent.userId === bobId, 'alice sees read receipt when bob marks the DM read');

    // --- File/image sharing ---
    const form = new FormData();
    form.append('body', 'here is a file');
    form.append('file', new Blob(['hello world'], { type: 'text/plain' }), 'note.txt');

    const uploadRes = await fetch(`${BASE}/api/conversations/${dmId}/messages`, {
        method: 'POST',
        headers: auth(aliceToken),
        body: form,
    });
    const uploadBody = await uploadRes.json();
    assert(
        uploadRes.status === 201 && uploadBody.message.attachments.length === 1,
        'uploads a message with a file attachment'
    );
    const attachmentUrl = uploadBody.message.attachments[0].url;

    const fileAsParticipant = await fetch(`${BASE}${attachmentUrl}`, { headers: auth(bobToken) });
    const fileText = await fileAsParticipant.text();
    assert(fileAsParticipant.status === 200 && fileText === 'hello world', 'participant can download the attachment');

    const fileAsOutsider = await fetch(`${BASE}${attachmentUrl}`, { headers: auth(daveToken) });
    assert(fileAsOutsider.status === 403, 'non-participant cannot download the attachment');

    // --- Search ---
    await new Promise((resolve) => {
        aliceSocket.emit('message:send', { conversationId: dmId, body: 'searchable pineapple message' }, resolve);
    });
    await new Promise((r) => setTimeout(r, 300));
    const searchRes = await api('/api/messages/search?q=pineapple', { headers: auth(aliceToken) });
    assert(
        searchRes.status === 200 && searchRes.body.messages.some((m) => m.body.includes('pineapple')),
        'full-text search finds the message'
    );

    // --- Rate limiting ---
    let rateLimited = false;
    for (let i = 0; i < 25; i += 1) {
        const r = await api(`/api/conversations/${dmId}/messages`, {
            method: 'POST',
            headers: auth(aliceToken),
            body: JSON.stringify({ body: `spam ${i}` }),
        });
        if (r.status === 429) {
            rateLimited = true;
            break;
        }
    }
    assert(rateLimited, 'message rate limiter kicks in under burst sending');

    aliceSocket.close();
    bobSocket.close();
    daveSocket.close();

    console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`}`);
    process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => {
    console.error('Smoke test crashed:', err);
    process.exit(1);
});

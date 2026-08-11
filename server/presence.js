const onlineSockets = new Map();

const addSocket = (userId, socketId) => {
    const wasOffline = !onlineSockets.has(userId) || onlineSockets.get(userId).size === 0;

    if (!onlineSockets.has(userId)) {
        onlineSockets.set(userId, new Set());
    }
    onlineSockets.get(userId).add(socketId);

    return wasOffline;
};

const removeSocket = (userId, socketId) => {
    const sockets = onlineSockets.get(userId);

    if (!sockets) return false;

    sockets.delete(socketId);

    if (sockets.size === 0) {
        onlineSockets.delete(userId);
        return true;
    }

    return false;
};

const isOnline = (userId) => onlineSockets.has(userId);

const getSocketIds = (userId) => Array.from(onlineSockets.get(userId) || []);

module.exports = { addSocket, removeSocket, isOnline, getSocketIds };

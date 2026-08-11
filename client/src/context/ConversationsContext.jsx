import { useEffect, useState, useCallback, useRef } from 'react';

import { api } from '../api/client';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import { ConversationsContext } from './conversations-context-value';

export const ConversationsProvider = ({ children }) => {
    const { user } = useAuth();
    const socket = useSocket();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const activeIdRef = useRef(null);

    const refreshConversations = useCallback(async () => {
        if (!user) return;
        const data = await api.get('/api/conversations');
        setConversations(data.conversations);
        setLoading(false);
    }, [user]);

    useEffect(() => {
        if (!user) return undefined;

        let cancelled = false;
        api.get('/api/conversations').then((data) => {
            if (cancelled) return;
            setConversations(data.conversations);
            setLoading(false);
        });

        return () => {
            cancelled = true;
            setConversations([]);
        };
    }, [user]);

    const setActiveConversationId = useCallback((id) => {
        activeIdRef.current = id;
    }, []);

    useEffect(() => {
        if (!socket) return undefined;

        const moveToTop = (list, id) => {
            const idx = list.findIndex((c) => c.id === id);
            if (idx <= 0) return list;
            const next = [...list];
            const [conv] = next.splice(idx, 1);
            return [conv, ...next];
        };

        const onNewConversation = (conv) => {
            setConversations((prev) => {
                if (prev.some((c) => c.id === conv.id)) return prev;
                return [conv, ...prev];
            });
        };

        const onMessageNew = (message) => {
            setConversations((prev) => {
                const idx = prev.findIndex((c) => c.id === message.conversationId);
                if (idx === -1) return prev;
                const isActive = activeIdRef.current === message.conversationId;
                const next = [...prev];
                next[idx] = {
                    ...next[idx],
                    lastMessage: message,
                    unreadCount: isActive ? next[idx].unreadCount : (next[idx].unreadCount || 0) + 1,
                };
                return moveToTop(next, message.conversationId);
            });
        };

        const onMessageUpdated = (message) => {
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === message.conversationId && c.lastMessage?.id === message.id
                        ? { ...c, lastMessage: message }
                        : c
                )
            );
        };

        const onMessageDeleted = ({ id, conversationId }) => {
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === conversationId && c.lastMessage?.id === id
                        ? { ...c, lastMessage: { ...c.lastMessage, deleted: true, body: null } }
                        : c
                )
            );
        };

        const onPresenceUpdate = ({ userId, online }) => {
            setConversations((prev) =>
                prev.map((c) => ({
                    ...c,
                    participants: c.participants.map((p) => (p.id === userId ? { ...p, online } : p)),
                }))
            );
        };

        const onRead = ({ conversationId, userId, lastReadAt }) => {
            setConversations((prev) =>
                prev.map((c) => {
                    if (c.id !== conversationId) return c;
                    return {
                        ...c,
                        participants: c.participants.map((p) =>
                            p.id === userId ? { ...p, lastReadAt } : p
                        ),
                    };
                })
            );
        };

        socket.on('conversation:new', onNewConversation);
        socket.on('message:new', onMessageNew);
        socket.on('message:updated', onMessageUpdated);
        socket.on('message:deleted', onMessageDeleted);
        socket.on('presence:update', onPresenceUpdate);
        socket.on('conversation:read', onRead);

        return () => {
            socket.off('conversation:new', onNewConversation);
            socket.off('message:new', onMessageNew);
            socket.off('message:updated', onMessageUpdated);
            socket.off('message:deleted', onMessageDeleted);
            socket.off('presence:update', onPresenceUpdate);
            socket.off('conversation:read', onRead);
        };
    }, [socket]);

    const markActiveConversationRead = useCallback((id) => {
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    }, []);

    return (
        <ConversationsContext.Provider
            value={{
                conversations,
                loading,
                refreshConversations,
                setActiveConversationId,
                markActiveConversationRead,
            }}
        >
            {children}
        </ConversationsContext.Provider>
    );
};

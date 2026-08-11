import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { api } from '../../api/client';
import { useAuth } from '../../context/useAuth';
import { useSocket } from '../../context/useSocket';
import { useConversations } from '../../context/useConversations';
import Attachment from './Attachment';
import './Chat.css';

const TYPING_STOP_DELAY_MS = 2000;

const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Chat = () => {
    const { conversationId } = useParams();
    const { user } = useAuth();
    const socket = useSocket();
    const { setActiveConversationId, markActiveConversationRead } = useConversations();

    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [messageText, setMessageText] = useState('');
    const [file, setFile] = useState(null);
    const [typingUsers, setTypingUsers] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const [openMenuId, setOpenMenuId] = useState(null);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        setActiveConversationId(conversationId);

        (async () => {
            try {
                const [convData, historyData] = await Promise.all([
                    api.get(`/api/conversations/${conversationId}`),
                    api.get(`/api/conversations/${conversationId}/messages`),
                ]);
                if (cancelled) return;
                setConversation(convData.conversation);
                setMessages(historyData.messages);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                setError(err.message);
                setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            setActiveConversationId(null);
        };
    }, [conversationId, setActiveConversationId]);

    useEffect(() => {
        if (!socket || !conversationId || messages.length === 0) return;
        socket.emit('conversation:markRead', { conversationId });
        markActiveConversationRead(conversationId);
    }, [socket, conversationId, messages.length, markActiveConversationRead]);

    useEffect(() => {
        if (!socket) return undefined;

        const onMessageNew = (message) => {
            if (message.conversationId !== conversationId) return;
            setMessages((prev) => [...prev, message]);
        };

        const onMessageUpdated = (message) => {
            if (message.conversationId !== conversationId) return;
            setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
        };

        const onMessageDeleted = ({ id, conversationId: cid }) => {
            if (cid !== conversationId) return;
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted: true, body: null } : m)));
        };

        const onTypingUpdate = (payload) => {
            if (payload.conversationId !== conversationId || payload.userId === user.id) return;
            setTypingUsers((prev) => {
                const next = { ...prev };
                if (payload.typing) next[payload.userId] = payload.username;
                else delete next[payload.userId];
                return next;
            });
        };

        const onPresenceUpdate = ({ userId, online }) => {
            setConversation((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    participants: prev.participants.map((p) => (p.id === userId ? { ...p, online } : p)),
                };
            });
        };

        const onConversationRead = (payload) => {
            if (payload.conversationId !== conversationId) return;
            setConversation((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    participants: prev.participants.map((p) =>
                        p.id === payload.userId ? { ...p, lastReadAt: payload.lastReadAt } : p
                    ),
                };
            });
        };

        socket.on('message:new', onMessageNew);
        socket.on('message:updated', onMessageUpdated);
        socket.on('message:deleted', onMessageDeleted);
        socket.on('typing:update', onTypingUpdate);
        socket.on('presence:update', onPresenceUpdate);
        socket.on('conversation:read', onConversationRead);

        return () => {
            socket.off('message:new', onMessageNew);
            socket.off('message:updated', onMessageUpdated);
            socket.off('message:deleted', onMessageDeleted);
            socket.off('typing:update', onTypingUpdate);
            socket.off('presence:update', onPresenceUpdate);
            socket.off('conversation:read', onConversationRead);
        };
    }, [socket, conversationId, user.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingUsers]);

    const stopTyping = useCallback(() => {
        if (!isTypingRef.current || !socket) return;
        isTypingRef.current = false;
        socket.emit('typing:stop', { conversationId });
    }, [socket, conversationId]);

    useEffect(
        () => () => {
            clearTimeout(typingTimeoutRef.current);
            stopTyping();
        },
        [conversationId, stopTyping]
    );

    const handleTextChange = (event) => {
        setMessageText(event.target.value);
        if (!socket) return;

        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit('typing:start', { conversationId });
        }

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(stopTyping, TYPING_STOP_DELAY_MS);
    };

    const handleFileChange = (event) => {
        setFile(event.target.files[0] || null);
    };

    const clearFile = () => {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const sendMessage = async (event) => {
        event.preventDefault();
        const text = messageText.trim();
        if (!text && !file) return;

        setSending(true);
        setError('');
        clearTimeout(typingTimeoutRef.current);
        stopTyping();

        try {
            if (file) {
                const form = new FormData();
                form.append('body', text);
                form.append('file', file);
                await api.postForm(`/api/conversations/${conversationId}/messages`, form);
                clearFile();
            } else {
                await new Promise((resolve, reject) => {
                    socket.emit('message:send', { conversationId, body: text }, (ack) => {
                        if (ack?.error) reject(new Error(ack.error));
                        else resolve(ack);
                    });
                });
            }
            setMessageText('');
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    const startEdit = (message) => {
        setEditingId(message.id);
        setEditText(message.body);
        setOpenMenuId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditText('');
    };

    const saveEdit = async (messageId) => {
        const body = editText.trim();
        if (!body) return;
        try {
            await api.patch(`/api/messages/${messageId}`, { body });
            cancelEdit();
        } catch (err) {
            setError(err.message);
        }
    };

    const deleteMessage = async (messageId) => {
        setOpenMenuId(null);
        try {
            await api.delete(`/api/messages/${messageId}`);
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) {
        return (
            <div className='chat-panel chat-panel-empty'>
                <p>Loading conversation…</p>
            </div>
        );
    }

    if (!conversation) {
        return (
            <div className='chat-panel chat-panel-empty'>
                <p>{error || 'Conversation not found'}</p>
            </div>
        );
    }

    const otherParticipants = conversation.participants.filter((p) => p.id !== user.id);
    const title = conversation.name || otherParticipants[0]?.username || 'Conversation';
    const isOnline =
        conversation.type === 'DIRECT'
            ? Boolean(otherParticipants[0]?.online)
            : otherParticipants.some((p) => p.online);
    const typingNames = Object.values(typingUsers);

    const seenLabel = (message) => {
        const readers = otherParticipants.filter(
            (p) => p.lastReadAt && new Date(p.lastReadAt) >= new Date(message.createdAt)
        );
        if (readers.length === 0) return null;
        return conversation.type === 'DIRECT' ? 'Seen' : `Seen by ${readers.length}`;
    };

    return (
        <div className='chat-panel'>
            <header className='chat-panel-header'>
                <div>
                    <p className='chat-panel-label'>{conversation.type === 'GROUP' ? 'Group' : 'Direct message'}</p>
                    <h2 className='chat-panel-title'>{title}</h2>
                </div>
                <span className={`chat-live-pill ${isOnline ? 'chat-live-pill-online' : ''}`}>
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            </header>

            {error && <p className='chat-error'>{error}</p>}

            <div className='chat-messages'>
                {messages.map((message) => {
                    const isOwn = message.sender.id === user.id;
                    const seen = isOwn && !message.deleted ? seenLabel(message) : null;

                    return (
                        <article key={message.id} className={`message ${isOwn ? 'message-outgoing' : 'message-incoming'}`}>
                            <span className='message-author'>{message.sender.username}</span>

                            {editingId === message.id ? (
                                <div className='message-edit-form'>
                                    <input
                                        className='message-edit-input'
                                        value={editText}
                                        onChange={(event) => setEditText(event.target.value)}
                                        autoFocus
                                    />
                                    <div className='message-edit-actions'>
                                        <button type='button' onClick={() => saveEdit(message.id)}>
                                            Save
                                        </button>
                                        <button type='button' onClick={cancelEdit}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : message.deleted ? (
                                <p className='message-deleted'>This message was deleted</p>
                            ) : (
                                <>
                                    {message.body && <p>{message.body}</p>}
                                    {message.attachments.map((attachment) => (
                                        <Attachment key={attachment.id} attachment={attachment} />
                                    ))}
                                </>
                            )}

                            <span className='message-meta'>
                                {formatTime(message.createdAt)}
                                {message.editedAt && !message.deleted && ' · edited'}
                                {seen && ` · ${seen}`}
                            </span>

                            {isOwn && !message.deleted && editingId !== message.id && (
                                <div className='message-actions'>
                                    <button
                                        type='button'
                                        className='message-menu-button'
                                        onClick={() => setOpenMenuId(openMenuId === message.id ? null : message.id)}
                                    >
                                        ⋮
                                    </button>
                                    {openMenuId === message.id && (
                                        <div className='message-menu'>
                                            <button type='button' onClick={() => startEdit(message)}>
                                                Edit
                                            </button>
                                            <button type='button' onClick={() => deleteMessage(message.id)}>
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </article>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {typingNames.length > 0 && (
                <p className='chat-typing-indicator'>
                    {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
                </p>
            )}

            <form className='chat-composer' onSubmit={sendMessage}>
                {file && (
                    <div className='chat-file-chip'>
                        📎 {file.name}
                        <button type='button' onClick={clearFile}>
                            ×
                        </button>
                    </div>
                )}
                <div className='chat-composer-row'>
                    <button
                        type='button'
                        className='chat-attach-button'
                        onClick={() => fileInputRef.current?.click()}
                        title='Attach a file'
                    >
                        📎
                    </button>
                    <input
                        ref={fileInputRef}
                        type='file'
                        className='chat-file-input'
                        onChange={handleFileChange}
                    />
                    <input
                        className='chat-input'
                        type='text'
                        placeholder='Type a message...'
                        value={messageText}
                        onChange={handleTextChange}
                    />
                    <button
                        className='chat-send-button'
                        type='submit'
                        disabled={sending || (!messageText.trim() && !file)}
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat;

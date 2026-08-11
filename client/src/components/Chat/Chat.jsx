import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import io from 'socket.io-client';

import './Chat.css';

const ENDPOINT = 'http://localhost:5006';

const Chat = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const name = params.get('name') || 'Guest';
    const room = params.get('room') || 'General';
    const [isConnected, setIsConnected] = useState(false);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const socket = io(ENDPOINT);
        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('join', { name, room }, (error) => {
                if (error) {
                    socket.disconnect();
                    navigate('/', { state: { joinError: error } });
                }
            });
            console.log(`Connected to server as ${name} in ${room}`);
        });

        socket.on('message', (incomingMessage) => {
            setMessages((currentMessages) => [...currentMessages, incomingMessage]);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from server');
        });

        socket.on('connect_error', (error) => {
            setIsConnected(false);
            console.error('Socket connection error:', error.message);
        });

        return () => {
            socketRef.current = null;
            socket.disconnect();
        };
    }, [name, room, navigate]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = (event) => {
        event.preventDefault();

        if (!message.trim() || !socketRef.current) {
            return;
        }

        socketRef.current.emit('sendMessage', message, () => {
            setMessage('');
        });
    };

    return (
        <main className='chat-page'>
            <section className='chat-shell'>
                <aside className='chat-sidebar'>
                    <p className='chat-kicker'>Active room</p>
                    <h1 className='chat-room-title'>{room}</h1>
                    <p className='chat-room-copy'>You're chatting as {name}. The layout is ready for messages, members, and typing indicators.</p>
                    <p className='chat-room-copy'>Connection status: {isConnected ? 'Connected to server' : 'Waiting to connect'}</p>

                    <div className='chat-member-card'>
                        <span className='chat-avatar'>{name.slice(0, 1).toUpperCase()}</span>
                        <div>
                            <div className='chat-member-name'>{name}</div>
                            <div className='chat-member-status'>Online now</div>
                        </div>
                    </div>

                    <Link className='chat-back-link' to='/'>Change room</Link>
                </aside>

                <section className='chat-panel'>
                    <header className='chat-panel-header'>
                        <div>
                            <p className='chat-panel-label'>Conversation</p>
                            <h2 className='chat-panel-title'>Live messages</h2>
                        </div>
                        <span className='chat-live-pill'>Ready</span>
                    </header>

                    <div className='chat-messages'>
                        {messages.map((item, index) => (
                            <article
                                className={`message ${item.user === name ? 'message-outgoing' : 'message-incoming'}`}
                                key={`${item.user}-${index}-${item.text}`}
                            >
                                <span className='message-author'>{item.user}</span>
                                <p>{item.text}</p>
                            </article>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className='chat-composer' onSubmit={sendMessage}>
                        <input
                            className='chat-input'
                            type='text'
                            placeholder='Type a message...'
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                        />
                        <button className='chat-send-button' type='submit'>Send</button>
                    </form>
                </section>
            </section>
        </main>
    )
}

export default Chat;
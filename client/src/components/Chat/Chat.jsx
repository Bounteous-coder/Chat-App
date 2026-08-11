import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import io from 'socket.io-client';

import './Chat.css';

const ENDPOINT = 'http://localhost:5006';

const Chat = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const name = params.get('name') || 'Guest';
    const room = params.get('room') || 'General';
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const socket = io(ENDPOINT, { transports: ['websocket'] });

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('join', { name, room });
            console.log(`Connected to server as ${name} in ${room}`);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
            console.log('Disconnected from server');
        });

        return () => {
            socket.disconnect();
        };
    }, [name, room]);

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
                        <article className='message message-incoming'>
                            <span className='message-author'>System</span>
                            <p>Welcome to {room}. This area is styled for live chat content.</p>
                        </article>
                        <article className='message message-outgoing'>
                            <span className='message-author'>{name}</span>
                            <p>Looks much better already.</p>
                        </article>
                    </div>

                    <form className='chat-composer'>
                        <input className='chat-input' type='text' placeholder='Type a message...' />
                        <button className='chat-send-button' type='button'>Send</button>
                    </form>
                </section>
            </section>
        </main>
    )
}

export default Chat;
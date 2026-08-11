import React, {useState} from 'react';
import { Link, useLocation } from 'react-router-dom';

import './Join.css';

const Join = () => {
    const location = useLocation();
    const joinError = location.state?.joinError;
    const [name, setName] = useState('');
    const [room, setRoom] = useState('');

    const canJoin = Boolean(name.trim() && room.trim());
    const chatLink = `/chat?name=${encodeURIComponent(name.trim())}&room=${encodeURIComponent(room.trim())}`;

    return (
        <main className='join-page'>
            <section className='join-card'>
                <div className='join-copy'>
                    <p className='join-kicker'>Realtime chat</p>
                    <h1 className='join-title'>Join your room</h1>
                    <p className='join-description'>Pick a display name and a room to jump into the conversation.</p>
                    {joinError && <p className='join-error'>{joinError}</p>}
                </div>

                <div className='join-form'>
                    <input
                        placeholder='Your name'
                        className='join-input'
                        type='text'
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                    <input
                        placeholder='Room name'
                        className='join-input join-input-spaced'
                        type='text'
                        value={room}
                        onChange={(event) => setRoom(event.target.value)}
                    />
                    <Link
                        className={`join-button ${!canJoin ? 'join-button-disabled' : ''}`}
                        onClick={event => !canJoin ? event.preventDefault() : null}
                        to={chatLink}
                    >
                        Sign In
                    </Link>
                </div>
            </section>
        </main>
    )
}

export default Join;
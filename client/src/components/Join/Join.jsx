import React, {useState} from 'react';
import { Link } from 'react-router-dom';

import './Join.css';

const Join = () => {
    const [name, setName] = useState('');
    const [room, setRoom] = useState('');

    return (
        <main className='join-page'>
            <section className='join-card'>
                <div className='join-copy'>
                    <p className='join-kicker'>Realtime chat</p>
                    <h1 className='join-title'>Join your room</h1>
                    <p className='join-description'>Pick a display name and a room to jump into the conversation.</p>
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
                        className={`join-button ${(!name || !room) ? 'join-button-disabled' : ''}`}
                        onClick={event => (!name || !room) ? event.preventDefault() : null}
                        to={`/chat?name=${name}&room=${room}`}
                    >
                        Sign In
                    </Link>
                </div>
            </section>
        </main>
    )
}

export default Join;
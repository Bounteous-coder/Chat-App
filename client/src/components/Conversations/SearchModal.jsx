import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../api/client';
import './Conversations.css';

const SearchModal = ({ onClose }) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) return undefined;

        let cancelled = false;
        const timeout = setTimeout(async () => {
            const data = await api.get(`/api/messages/search?q=${encodeURIComponent(trimmed)}`);
            if (!cancelled) setResults(data.messages);
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query]);

    const goToMessage = (message) => {
        navigate(`/c/${message.conversationId}`);
        onClose();
    };

    return (
        <div className='modal-backdrop' onClick={onClose}>
            <div className='modal' onClick={(event) => event.stopPropagation()}>
                <div className='modal-header'>
                    <h2>Search messages</h2>
                    <button className='modal-close' onClick={onClose} type='button'>
                        ×
                    </button>
                </div>

                <input
                    className='modal-input'
                    placeholder='Search your messages'
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoFocus
                />

                <ul className='modal-results'>
                    {(query.trim() ? results : []).map((m) => (
                        <li key={m.id}>
                            <button type='button' className='modal-search-result' onClick={() => goToMessage(m)}>
                                <span className='modal-search-sender'>{m.sender.username}</span>
                                <span className='modal-search-body'>{m.body}</span>
                            </button>
                        </li>
                    ))}
                    {query.trim() && results.length === 0 && <li className='modal-empty'>No messages found</li>}
                </ul>
            </div>
        </div>
    );
};

export default SearchModal;

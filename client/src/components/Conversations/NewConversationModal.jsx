import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../../api/client';
import { useConversations } from '../../context/useConversations';
import './Conversations.css';

const NewConversationModal = ({ onClose }) => {
    const { refreshConversations } = useConversations();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isGroup, setIsGroup] = useState(false);
    const [selected, setSelected] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed) return undefined;

        let cancelled = false;
        const timeout = setTimeout(async () => {
            const data = await api.get(`/api/users/search?q=${encodeURIComponent(trimmed)}`);
            if (!cancelled) setResults(data.users);
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query]);

    const toggleSelected = (u) => {
        setSelected((prev) =>
            prev.some((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]
        );
    };

    const startDirect = async (u) => {
        setCreating(true);
        setError('');
        try {
            const data = await api.post('/api/conversations', { type: 'DIRECT', participantId: u.id });
            await refreshConversations();
            navigate(`/c/${data.conversation.id}`);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const createGroup = async () => {
        if (!groupName.trim() || selected.length === 0) {
            setError('Pick a name and at least one person');
            return;
        }
        setCreating(true);
        setError('');
        try {
            const data = await api.post('/api/conversations', {
                type: 'GROUP',
                name: groupName.trim(),
                participantIds: selected.map((u) => u.id),
            });
            await refreshConversations();
            navigate(`/c/${data.conversation.id}`);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className='modal-backdrop' onClick={onClose}>
            <div className='modal' onClick={(event) => event.stopPropagation()}>
                <div className='modal-header'>
                    <h2>{isGroup ? 'New group' : 'New chat'}</h2>
                    <button className='modal-close' onClick={onClose} type='button'>
                        ×
                    </button>
                </div>

                <div className='modal-tabs'>
                    <button
                        type='button'
                        className={`modal-tab ${!isGroup ? 'modal-tab-active' : ''}`}
                        onClick={() => setIsGroup(false)}
                    >
                        Direct message
                    </button>
                    <button
                        type='button'
                        className={`modal-tab ${isGroup ? 'modal-tab-active' : ''}`}
                        onClick={() => setIsGroup(true)}
                    >
                        Group
                    </button>
                </div>

                {isGroup && (
                    <input
                        className='modal-input'
                        placeholder='Group name'
                        value={groupName}
                        onChange={(event) => setGroupName(event.target.value)}
                    />
                )}

                <input
                    className='modal-input'
                    placeholder='Search by username'
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoFocus
                />

                {error && <p className='modal-error'>{error}</p>}

                {isGroup && selected.length > 0 && (
                    <div className='modal-chips'>
                        {selected.map((u) => (
                            <button
                                key={u.id}
                                type='button'
                                className='modal-chip'
                                onClick={() => toggleSelected(u)}
                            >
                                {u.username} ×
                            </button>
                        ))}
                    </div>
                )}

                <ul className='modal-results'>
                    {(query.trim() ? results : []).map((u) => (
                        <li key={u.id}>
                            <button
                                type='button'
                                className='modal-result'
                                disabled={creating}
                                onClick={() => (isGroup ? toggleSelected(u) : startDirect(u))}
                            >
                                <span className={`conversation-avatar ${u.online ? 'conversation-avatar-online' : ''}`}>
                                    {u.username.slice(0, 1).toUpperCase()}
                                </span>
                                {u.username}
                                {isGroup && selected.some((p) => p.id === u.id) && (
                                    <span className='modal-checkmark'>✓</span>
                                )}
                            </button>
                        </li>
                    ))}
                    {query.trim() && results.length === 0 && <li className='modal-empty'>No users found</li>}
                </ul>

                {isGroup && (
                    <button type='button' className='modal-button' disabled={creating} onClick={createGroup}>
                        Create group
                    </button>
                )}
            </div>
        </div>
    );
};

export default NewConversationModal;

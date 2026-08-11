import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/useAuth';
import ConversationList from '../Conversations/ConversationList';
import NewConversationModal from '../Conversations/NewConversationModal';
import SearchModal from '../Conversations/SearchModal';
import './Shell.css';

const Shell = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showNewConversation, setShowNewConversation] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className='shell'>
            <button
                className='shell-mobile-toggle'
                type='button'
                onClick={() => setSidebarOpen((v) => !v)}
                aria-label='Toggle conversation list'
            >
                ☰
            </button>

            {sidebarOpen && <div className='shell-backdrop' onClick={() => setSidebarOpen(false)} />}

            <aside className={`shell-sidebar ${sidebarOpen ? 'shell-sidebar-open' : ''}`}>
                <div className='shell-sidebar-header'>
                    <div className='shell-user'>
                        <span className='shell-user-avatar'>{user.username.slice(0, 1).toUpperCase()}</span>
                        <span className='shell-user-name'>{user.username}</span>
                    </div>
                    <button className='shell-icon-button' type='button' onClick={handleLogout} title='Log out'>
                        Log out
                    </button>
                </div>

                <div className='shell-sidebar-actions'>
                    <button className='shell-action-button' type='button' onClick={() => setShowNewConversation(true)}>
                        + New chat
                    </button>
                    <button
                        className='shell-action-button shell-action-secondary'
                        type='button'
                        onClick={() => setShowSearch(true)}
                    >
                        Search
                    </button>
                </div>

                <ConversationList onNavigate={() => setSidebarOpen(false)} />
            </aside>

            <section className='shell-main'>
                <Outlet />
            </section>

            {showNewConversation && <NewConversationModal onClose={() => setShowNewConversation(false)} />}
            {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
        </div>
    );
};

export default Shell;

import { NavLink } from 'react-router-dom';

import { useConversations } from '../../context/useConversations';
import { useAuth } from '../../context/useAuth';
import './Conversations.css';

const formatPreview = (lastMessage) => {
    if (!lastMessage) return 'No messages yet';
    if (lastMessage.deleted) return 'Message deleted';
    if (!lastMessage.body && lastMessage.attachments?.length) {
        return `📎 ${lastMessage.attachments[0].originalName}`;
    }
    return lastMessage.body;
};

const ConversationList = ({ onNavigate }) => {
    const { conversations, loading } = useConversations();
    const { user } = useAuth();

    if (loading) return <p className='conversation-list-empty'>Loading conversations…</p>;
    if (conversations.length === 0) {
        return <p className='conversation-list-empty'>No conversations yet. Start one!</p>;
    }

    return (
        <nav className='conversation-list'>
            {conversations.map((conv) => {
                const otherParticipants = conv.participants.filter((p) => p.id !== user.id);
                const anyOnline =
                    conv.type === 'DIRECT'
                        ? Boolean(otherParticipants[0]?.online)
                        : otherParticipants.some((p) => p.online);

                return (
                    <NavLink
                        key={conv.id}
                        to={`/c/${conv.id}`}
                        className={({ isActive }) =>
                            `conversation-item ${isActive ? 'conversation-item-active' : ''}`
                        }
                        onClick={onNavigate}
                    >
                        <span className={`conversation-avatar ${anyOnline ? 'conversation-avatar-online' : ''}`}>
                            {(conv.name || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <span className='conversation-info'>
                            <span className='conversation-name'>{conv.name || 'Unnamed'}</span>
                            <span className='conversation-preview'>{formatPreview(conv.lastMessage)}</span>
                        </span>
                        {conv.unreadCount > 0 && <span className='conversation-unread'>{conv.unreadCount}</span>}
                    </NavLink>
                );
            })}
        </nav>
    );
};

export default ConversationList;

import { useContext } from 'react';

import { ConversationsContext } from './conversations-context-value';

export const useConversations = () => useContext(ConversationsContext);

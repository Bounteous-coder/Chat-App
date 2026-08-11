import { useContext } from 'react';

import { SocketContext } from './socket-context-value';

export const useSocket = () => useContext(SocketContext);

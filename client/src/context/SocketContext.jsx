import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

import { BASE, getAccessToken } from '../api/client';
import { useAuth } from './useAuth';
import { SocketContext } from './socket-context-value';

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (!user) return undefined;

        const instance = io(BASE, {
            auth: (cb) => cb({ token: getAccessToken() }),
        });

        // Storing the connection so consumers re-render/re-subscribe when it's ready —
        // the same "connect to an external system" pattern as React's own docs.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(instance);

        return () => {
            instance.disconnect();
            setSocket(null);
        };
    }, [user]);

    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

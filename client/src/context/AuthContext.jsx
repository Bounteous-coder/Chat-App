import { useEffect, useState, useCallback, useRef } from 'react';
import { api, setAccessToken, refresh } from '../api/client';
import { AuthContext } from './auth-context-value';

const SILENT_REFRESH_INTERVAL_MS = 50 * 60 * 1000; // access tokens live 1h

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);
    const refreshTimerRef = useRef(null);

    const scheduleSilentRefresh = useCallback(() => {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = setInterval(() => {
            refresh().catch(() => {
                setUser(null);
            });
        }, SILENT_REFRESH_INTERVAL_MS);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const data = await refresh();
                setUser(data.user);
                scheduleSilentRefresh();
            } catch {
                setUser(null);
            } finally {
                setInitializing(false);
            }
        })();

        return () => clearInterval(refreshTimerRef.current);
    }, [scheduleSilentRefresh]);

    const login = useCallback(
        async (username, password) => {
            const data = await api.post('/api/auth/login', { username, password });
            setAccessToken(data.accessToken);
            setUser(data.user);
            scheduleSilentRefresh();
        },
        [scheduleSilentRefresh]
    );

    const register = useCallback(
        async (username, password) => {
            const data = await api.post('/api/auth/register', { username, password });
            setAccessToken(data.accessToken);
            setUser(data.user);
            scheduleSilentRefresh();
        },
        [scheduleSilentRefresh]
    );

    const logout = useCallback(async () => {
        clearInterval(refreshTimerRef.current);
        await api.post('/api/auth/logout').catch(() => {});
        setAccessToken(null);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, initializing, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

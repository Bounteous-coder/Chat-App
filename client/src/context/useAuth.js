import { useContext } from 'react';

import { AuthContext } from './auth-context-value';

export const useAuth = () => useContext(AuthContext);

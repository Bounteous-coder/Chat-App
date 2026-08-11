import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/useAuth';

const ProtectedRoute = ({ children }) => {
    const { user, initializing } = useAuth();
    const location = useLocation();

    if (initializing) {
        return <div className='app-loading'>Loading…</div>;
    }

    if (!user) {
        return <Navigate to='/login' replace state={{ from: location.pathname }} />;
    }

    return children;
};

export default ProtectedRoute;

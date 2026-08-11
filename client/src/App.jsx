import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ConversationsProvider } from './context/ConversationsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Shell from './components/Shell/Shell';
import EmptyState from './components/Chat/EmptyState';
import Chat from './components/Chat/Chat';

// Keying by conversationId forces a full remount on conversation switch, so
// Chat's local state (messages, typing, etc.) starts fresh without manual resets.
const ChatRoute = () => {
    const { conversationId } = useParams();
    return <Chat key={conversationId} />;
};

const App = () => (
  <Router>
    <AuthProvider>
      <SocketProvider>
        <ConversationsProvider>
          <Routes>
            <Route path='/login' element={<Login />} />
            <Route path='/register' element={<Register />} />
            <Route
              path='/'
              element={
                <ProtectedRoute>
                  <Shell />
                </ProtectedRoute>
              }
            >
              <Route index element={<EmptyState />} />
              <Route path='c/:conversationId' element={<ChatRoute />} />
            </Route>
            <Route path='*' element={<Navigate to='/' replace />} />
          </Routes>
        </ConversationsProvider>
      </SocketProvider>
    </AuthProvider>
  </Router>
);

export default App;

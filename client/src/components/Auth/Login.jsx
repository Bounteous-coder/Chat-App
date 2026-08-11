import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/useAuth';
import './Auth.css';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!username.trim() || !password) return;

        setSubmitting(true);
        try {
            await login(username.trim(), password);
            navigate(location.state?.from || '/', { replace: true });
        } catch (err) {
            setError(err.message || 'Unable to log in');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className='auth-page'>
            <section className='auth-card'>
                <div className='auth-copy'>
                    <p className='auth-kicker'>Realtime chat</p>
                    <h1 className='auth-title'>Welcome back</h1>
                    <p className='auth-description'>Log in to reach your conversations and pick up where you left off.</p>
                    {error && <p className='auth-error'>{error}</p>}
                    <p className='auth-switch'>
                        New here? <Link to='/register'>Create an account</Link>
                    </p>
                </div>

                <form className='auth-form' onSubmit={handleSubmit}>
                    <input
                        className='auth-input'
                        type='text'
                        placeholder='Username'
                        autoComplete='username'
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                    />
                    <input
                        className='auth-input'
                        type='password'
                        placeholder='Password'
                        autoComplete='current-password'
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                    <button className='auth-button' type='submit' disabled={submitting}>
                        {submitting ? 'Logging in…' : 'Log in'}
                    </button>
                </form>
            </section>
        </main>
    );
};

export default Login;

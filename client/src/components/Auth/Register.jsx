import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/useAuth';
import './Auth.css';

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (username.trim().length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setSubmitting(true);
        try {
            await register(username.trim(), password);
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message || 'Unable to create account');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className='auth-page'>
            <section className='auth-card'>
                <div className='auth-copy'>
                    <p className='auth-kicker'>Realtime chat</p>
                    <h1 className='auth-title'>Create your account</h1>
                    <p className='auth-description'>Pick a username and password to start chatting in realtime.</p>
                    {error && <p className='auth-error'>{error}</p>}
                    <p className='auth-switch'>
                        Already have an account? <Link to='/login'>Log in</Link>
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
                        placeholder='Password (min. 8 characters)'
                        autoComplete='new-password'
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                    <button className='auth-button' type='submit' disabled={submitting}>
                        {submitting ? 'Creating account…' : 'Sign up'}
                    </button>
                </form>
            </section>
        </main>
    );
};

export default Register;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { hasAdminPassword, checkStatus } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isSetup = !hasAdminPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isSetup) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSetup) {
        await admin.setup({ username, password });
      } else {
        await admin.login({ username, password });
      }
      await checkStatus();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-logo">🎬</div>
      <h1 className="setup-title">WatchWithMe</h1>
      <p className="setup-subtitle" style={{ marginBottom: '2rem' }}>
        {isSetup ? 'Create your admin account to get started.' : 'Sign in to manage your sessions.'}
      </p>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          className="form-input"
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          className="form-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={isSetup ? 'new-password' : 'current-password'}
          required
        />
        {isSetup && (
          <input
            className="form-input"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        )}

        {error && (
          <div style={{ color: 'var(--pass)', fontSize: '0.875rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
          {loading ? '...' : isSetup ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

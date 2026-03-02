import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessions } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';

export function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  const upperCode = code?.toUpperCase();

  useEffect(() => {
    if (!upperCode) return;

    // Check if we already have a token for this session
    const existingToken = localStorage.getItem(`session_token_${upperCode}`);
    if (existingToken) {
      navigate(`/session/${upperCode}`);
      return;
    }

    sessions.get(upperCode)
      .then(data => setSession(data))
      .catch(() => setError('Session not found or has ended.'));
  }, [upperCode]);

  const handleJoin = async () => {
    if (!name.trim()) {
      showToast('Please enter your name');
      return;
    }
    setJoining(true);
    try {
      const data = await sessions.join(upperCode, name.trim());
      localStorage.setItem(`session_token_${upperCode}`, data.userToken);
      localStorage.setItem(`session_user_${upperCode}`, name.trim());
      navigate(`/session/${upperCode}`);
    } catch (err) {
      showToast(err.message || 'Failed to join session');
      setJoining(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleJoin();
  };

  if (error) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-icon">😕</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Session Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error}</p>
          <button className="btn btn-secondary btn-full" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-icon">🎬</div>
        <h2 style={{ marginBottom: '0.25rem' }}>Join Session</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {session ? `${session.users?.length || 0} people in this session` : 'Loading...'}
        </p>

        <div className="join-code-display">
          <div className="session-code">
            {upperCode?.split('').map((char, i) => (
              <div key={i} className="session-code-char">{char}</div>
            ))}
          </div>
        </div>

        {session?.totalMovies && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
            {session.totalMovies} movies to swipe through
          </p>
        )}

        <div className="form-group">
          <input
            className="form-input"
            placeholder="Enter your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={30}
            autoFocus
          />
        </div>

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleJoin}
          disabled={joining || !name.trim()}
        >
          {joining ? 'Joining...' : 'Join Session →'}
        </button>
      </div>
    </div>
  );
}

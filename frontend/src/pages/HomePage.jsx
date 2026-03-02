import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessions, movies } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';
import { Navbar } from '../components/Navbar.jsx';
import { imageUrl } from '../utils/movie.js';

function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function HomePage() {
  const navigate = useNavigate();
  const { serverName, showToast } = useApp();
  const [history, setHistory] = useState([]);
  const [movieCount, setMovieCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    sessions.list().then(d => setHistory(d.sessions || [])).catch(() => {});
    movies.count().then(d => setMovieCount(d.count || 0)).catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await movies.sync();
      showToast('Library sync started');
      setTimeout(async () => {
        const d = await movies.count();
        setMovieCount(d.count || 0);
        setSyncing(false);
      }, 5000);
    } catch {
      showToast('Sync failed');
      setSyncing(false);
    }
  };

  return (
    <div className="home-page">
      <Navbar
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleSync}
            disabled={syncing}
            title="Re-sync Plex library"
          >
            {syncing ? '⟳' : '↻'}
          </button>
        }
      />

      <div className="home-content">
        <div className="home-welcome">
          <h2>What are we watching?</h2>
          <p>
            {movieCount > 0
              ? `${movieCount.toLocaleString()} movies in your library`
              : 'No movies synced yet'}
          </p>
        </div>

        {movieCount === 0 && (
          <div className="sync-banner">
            ⚠️ No movies found. Try syncing your library.
          </div>
        )}

        <button
          className="big-action-card"
          onClick={() => navigate('/create')}
          disabled={movieCount === 0}
        >
          <span className="big-action-card-icon">🎲</span>
          <div className="big-action-card-text">
            <h3>New Session</h3>
            <p>Create a session and invite friends</p>
          </div>
        </button>

        <div>
          <div className="home-section-title">Recent Sessions</div>
          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p>No sessions yet. Create one to get started!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {history.map(session => (
                <div
                  key={session.id}
                  className="session-history-card"
                  onClick={() => navigate(`/session/${session.code}`)}
                >
                  {session.matchedMovie?.thumb ? (
                    <img
                      src={imageUrl(session.matchedMovie.thumb, 88, 132)}
                      alt=""
                      className="session-thumb"
                    />
                  ) : (
                    <div className="session-thumb-placeholder">🎬</div>
                  )}

                  <div className="session-history-info">
                    <div className="session-history-title">
                      {session.matchedMovie?.title || `Session ${session.code}`}
                    </div>
                    <div className="session-history-meta">
                      {session.code} · {session.users?.map(u => u.name).join(', ')} · {timeAgo(session.created_at)}
                    </div>
                  </div>

                  <span className={`status-badge ${session.status}`}>
                    {session.status === 'matched' ? '✓ Match' : session.status === 'active' ? '● Live' : 'Ended'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

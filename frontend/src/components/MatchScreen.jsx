import { useEffect } from 'react';
import { imageUrl } from '../utils/movie.js';

export function MatchScreen({ movie, onPlayAgain, isAdmin, users = [] }) {
  useEffect(() => {
    // Subtle vibration on mobile
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }, []);

  return (
    <div className="match-screen">
      <div className="match-header">
        <span className="match-emoji">🎉</span>
        <h1 className="match-title">It's a Match!</h1>
        <p className="match-subtitle">Everyone wants to watch this</p>
      </div>

      {movie && (
        <>
          <div className="match-poster-wrap">
            {movie.thumb ? (
              <img src={imageUrl(movie.thumb, 300, 450)} alt={movie.title} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-elevated)', fontSize: '3rem',
              }}>
                🎬
              </div>
            )}
          </div>

          <div className="match-movie-info">
            <h2 className="match-movie-title">{movie.title}</h2>
            <p className="match-movie-meta">
              {[movie.year, movie.rating ? `★ ${movie.rating.toFixed(1)}` : null]
                .filter(Boolean).join(' · ')}
            </p>
            {movie.genres?.length > 0 && (
              <p className="match-movie-meta" style={{ marginTop: '0.25rem' }}>
                {movie.genres.slice(0, 3).join(' · ')}
              </p>
            )}
            {movie.tagline && (
              <p className="match-movie-meta" style={{ fontStyle: 'italic', marginTop: '0.35rem', color: 'var(--accent-light)' }}>
                "{movie.tagline}"
              </p>
            )}
          </div>
        </>
      )}

      {users.length > 0 && (
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Matched by {users.map(u => u.name).join(', ')}
          </p>
        </div>
      )}

      <div className="match-actions">
        {isAdmin && (
          <button className="btn btn-primary btn-lg btn-full" onClick={onPlayAgain}>
            🔄 Start New Session
          </button>
        )}
        {!isAdmin && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Waiting for the host to start a new session...
          </p>
        )}
      </div>
    </div>
  );
}

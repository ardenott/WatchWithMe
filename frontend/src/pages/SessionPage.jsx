import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { sessions } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { MovieCard, StackCard, SwipeActions } from '../components/SwipeCard.jsx';
import { MatchScreen } from '../components/MatchScreen.jsx';

const PRELOAD_AHEAD = 15;

function SessionCodeBadge({ code, shareUrl, showToast }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = shareUrl || `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      showToast('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="users-pill" onClick={copy}>
      <span style={{ fontWeight: 800, letterSpacing: '0.1em', color: 'var(--accent-light)' }}>
        {code}
      </span>
      <span style={{ fontSize: '0.8rem' }}>{copied ? '✓' : '⎘'}</span>
    </button>
  );
}

export function SessionPage() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const upperCode = code?.toUpperCase();
  const userToken = localStorage.getItem(`session_token_${upperCode}`);
  const userName = localStorage.getItem(`session_user_${upperCode}`);

  const [movieQueue, setMovieQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [matchedMovie, setMatchedMovie] = useState(null);
  const [showUsers, setShowUsers] = useState(false);
  const [totalMovies, setTotalMovies] = useState(0);
  const [fetchedUpTo, setFetchedUpTo] = useState(0);
  const [allFetched, setAllFetched] = useState(false);
  // swiping prevents duplicate API calls during animation
  const [swiping, setSwiping] = useState(false);

  const cardRef = useRef(null);
  const fetchingRef = useRef(false);
  const isAdmin = localStorage.getItem(`session_admin_${upperCode}`) === '1';
  const shareUrl = location.state?.shareUrl;

  // Redirect if no token
  useEffect(() => {
    if (!userToken) navigate(`/join/${upperCode}`);
  }, [userToken, upperCode]);

  // Load session on mount
  useEffect(() => {
    if (!userToken) return;
    sessions.get(upperCode).then(data => {
      setUsers(data.users || []);
      setTotalMovies(data.totalMovies || 0);
      if (data.matchedMovie) {
        setMatchedMovie(data.matchedMovie);
        setLoading(false);
      } else {
        loadMovies(0);
      }
    }).catch(() => {
      showToast('Failed to load session');
      navigate('/');
    });
  }, [upperCode, userToken]);

  const loadMovies = useCallback(async (start) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await sessions.getMovies(upperCode, start, PRELOAD_AHEAD, userToken);
      setMovieQueue(prev => {
        const next = [...prev];
        data.movies.forEach((m, i) => { next[start + i] = m; });
        return next;
      });
      setFetchedUpTo(start + data.movies.length);
      if (!data.hasMore) setAllFetched(true);
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [upperCode, userToken]);

  // Preload more as user progresses
  useEffect(() => {
    if (currentIndex + 6 >= fetchedUpTo && !allFetched) {
      loadMovies(fetchedUpTo);
    }
  }, [currentIndex, fetchedUpTo, allFetched, loadMovies]);

  /**
   * Called AFTER the card's swipe animation completes (via onLike/onPass props).
   * Makes the API call then advances the index so React remounts a fresh card.
   */
  const handleSwipe = useCallback(async (liked) => {
    const movie = movieQueue[currentIndex];
    if (!movie || swiping) return;

    setSwiping(true);
    try {
      const result = await sessions.swipe(upperCode, {
        userToken,
        movieKey: movie.plex_rating_key,
        liked,
      });

      if (result.match) {
        setMatchedMovie(result.match);
      } else {
        // Advancing currentIndex causes MovieCard to remount via key={currentIndex}
        setCurrentIndex(i => i + 1);
      }
    } catch {
      showToast('Connection issue — swipe not recorded');
    } finally {
      setSwiping(false);
    }
  }, [movieQueue, currentIndex, upperCode, userToken, swiping]);

  /**
   * Action buttons only trigger the card animation.
   * The onLike/onPass callbacks handle the API call after the animation finishes.
   */
  const handleLike = useCallback(() => {
    cardRef.current?.triggerSwipe('right');
  }, []);

  const handlePass = useCallback(() => {
    cardRef.current?.triggerSwipe('left');
  }, []);

  // Socket for real-time events
  useSocket({
    sessionCode: upperCode,
    userToken,
    onUsers: setUsers,
    onMatch: (movie) => setMatchedMovie(movie),
    onEnded: () => { showToast('Session ended by host'); navigate('/'); },
  });

  const currentMovie = movieQueue[currentIndex];
  // Pass next 2 movies so they show as background stack cards
  const nextMovies = movieQueue.slice(currentIndex + 1, currentIndex + 3).filter(Boolean);
  const progress = totalMovies > 0 ? currentIndex / totalMovies : 0;
  const isDone = !matchedMovie && totalMovies > 0 && currentIndex >= totalMovies;

  if (!userToken) return null;

  if (matchedMovie) {
    return (
      <MatchScreen
        movie={matchedMovie}
        users={users}
        isAdmin={isAdmin}
        onPlayAgain={() => navigate('/create')}
      />
    );
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading movies…</span>
      </div>
    );
  }

  return (
    <div className="swipe-page">
      {/* Top bar */}
      <div className="swipe-header">
        {isAdmin && (
          <button className="users-pill" onClick={() => navigate('/')} aria-label="Home">
            ← Home
          </button>
        )}

        <SessionCodeBadge code={upperCode} shareUrl={shareUrl} showToast={showToast} />

        <div className="swipe-progress" style={{ flex: 1, margin: '0 0.75rem' }}>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span style={{ flexShrink: 0, fontSize: '0.75rem' }}>
            {currentIndex}/{totalMovies}
          </span>
        </div>

        <button className="users-pill" onClick={() => setShowUsers(v => !v)}>
          👥 {users.length}
        </button>
      </div>

      {/* Participants panel */}
      {showUsers && (
        <div style={{
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
          <div className="participants-list">
            {users.map(user => (
              <div key={user.id} className="participant-item">
                <div className="participant-avatar">{user.name[0]?.toUpperCase()}</div>
                <span className="participant-name">{user.name}</span>
                {user.isAdmin && <span className="participant-badge">Host</span>}
                {user.name === userName && <span className="participant-badge">You</span>}
              </div>
            ))}
          </div>
          {isAdmin && shareUrl && (
            <div style={{ marginTop: '0.75rem' }}>
              <div className="share-box">
                <span className="share-box-url">{shareUrl}</span>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => { navigator.clipboard.writeText(shareUrl); showToast('Link copied!'); }}
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card deck */}
      <div className="swipe-deck-area">
        {isDone ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎬</div>
            <p>You've seen all the movies!</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Waiting for others to finish swiping…
            </p>
          </div>
        ) : !currentMovie ? (
          <div className="loading" style={{ height: 'auto' }}>
            <div className="spinner" />
          </div>
        ) : (
          /*
           * StackCards live here (outside MovieCard) so they persist across swipes
           * and their CSS transform transitions play when depth changes.
           * key={currentIndex} remounts MovieCard on each swipe for a clean useSwipe
           * state; active-card-scene provides the entrance animation.
           */
          <div className="swipe-deck">
            {nextMovies[1] && (
              <StackCard key={nextMovies[1].plex_rating_key} movie={nextMovies[1]} depth={1} />
            )}
            {nextMovies[0] && (
              <StackCard key={nextMovies[0].plex_rating_key} movie={nextMovies[0]} depth={0} />
            )}
            <MovieCard
              key={currentIndex}
              ref={cardRef}
              movie={currentMovie}
              onLike={() => handleSwipe(true)}
              onPass={() => handleSwipe(false)}
              disabled={swiping}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isDone && currentMovie && (
        <SwipeActions
          onLike={handleLike}
          onPass={handlePass}
          onInfo={() => cardRef.current?.triggerFlip?.()}
          disabled={swiping}
        />
      )}

      <div className="safe-bottom" style={{ flexShrink: 0 }} />
    </div>
  );
}

import { forwardRef, memo, useImperativeHandle, useState, useCallback } from 'react';
import { useSwipe } from '../hooks/useSwipe.js';
import { imageUrl, formatDuration } from '../utils/movie.js';

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Derive a deterministic rotation from the movie's plex key so each card in
 * the deck looks like it landed at a slightly different angle.
 */
function keyRotation(key, multiplier = 1) {
  if (!key) return 0;
  const sum = String(key)
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  // Map to –6 … +6 degrees, scaled by multiplier
  return ((sum % 13) - 6) * multiplier;
}

// ─── PosterFront ─────────────────────────────────────────────────────────────

function PosterFront({ movie, likeOpacity, passOpacity, onFlip, isFlipped }) {
  const src = imageUrl(movie?.thumb);
  return (
    <div className="flip-face flip-front">
      {src ? (
        <img src={src} alt={movie?.title} className="movie-card-poster" draggable={false} />
      ) : (
        <div className="movie-card-poster-placeholder">
          <span>🎬</span>
          <span style={{ fontSize: '0.9rem', padding: '0 1rem', textAlign: 'center' }}>
            {movie?.title}
          </span>
        </div>
      )}

      {/* LIKE / PASS stamps */}
      <div className="swipe-stamp stamp-like" style={{ opacity: likeOpacity }}>LIKE</div>
      <div className="swipe-stamp stamp-pass" style={{ opacity: passOpacity }}>PASS</div>

      {/* Info button — flips card; hidden while already on the back face */}
      {!isFlipped && (
        <button
          className="card-info-btn"
          onClick={(e) => { e.stopPropagation(); onFlip(); }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          aria-label="View details"
        >
          i
        </button>
      )}

      <div className="movie-card-gradient" />
      <div className="movie-card-info">
        <div className="movie-card-title">{movie?.title}</div>
        <div className="movie-card-meta">
          {movie?.year && <span className="movie-card-year">{movie.year}</span>}
          {movie?.rating && (
            <span className="movie-card-rating">★ {movie.rating.toFixed(1)}</span>
          )}
          {movie?.duration && <span className="movie-card-year">{formatDuration(movie.duration)}</span>}
        </div>
        {movie?.genres?.length > 0 && (
          <div className="movie-card-genres">
            {movie.genres.slice(0, 3).map((g) => (
              <span key={g} className="genre-pill">{g}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MetadataBack ────────────────────────────────────────────────────────────

function MetadataBack({ movie, onFlip }) {
  const thumbSrc = imageUrl(movie?.thumb, 120, 180);

  return (
    <div className="flip-face flip-back">
      {/* Back-face close button */}
      <button className="flip-back-close" onClick={(e) => { e.stopPropagation(); onFlip(); }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        ← Poster
      </button>

      <div className="flip-back-scroll">
        <div className="flip-back-header">
          {thumbSrc && (
            <img src={thumbSrc} alt="" className="flip-back-thumb" />
          )}
          <div className="flip-back-title-block">
            <h3 className="flip-back-title">{movie?.title}</h3>
            <div className="movie-detail-meta" style={{ marginBottom: 0 }}>
              {movie?.year && <span>{movie.year}</span>}
              {movie?.content_rating && (
                <span className="meta-badge">{movie.content_rating}</span>
              )}
              {movie?.rating && (
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                  ★ {movie.rating.toFixed(1)}
                </span>
              )}
              {movie?.duration && <span>{formatDuration(movie.duration)}</span>}
            </div>
          </div>
        </div>

        {movie?.genres?.length > 0 && (
          <div className="movie-detail-genres" style={{ marginBottom: '0.75rem' }}>
            {movie.genres.map((g) => (
              <span key={g} className="genre-pill" style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)',
                padding: '0.25rem 0.65rem',
              }}>
                {g}
              </span>
            ))}
          </div>
        )}

        {movie?.tagline && (
          <p style={{ fontStyle: 'italic', color: 'var(--accent-light)', fontSize: '0.88rem', marginBottom: '0.65rem' }}>
            "{movie.tagline}"
          </p>
        )}

        {movie?.summary && (
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.9rem' }}>
            {movie.summary}
          </p>
        )}

        {movie?.directors?.length > 0 && (
          <div style={{ marginBottom: '0.6rem' }}>
            <div className="detail-section-label">Directed by</div>
            <div className="detail-section-value">{movie.directors.join(', ')}</div>
          </div>
        )}

        {movie?.actors?.length > 0 && (
          <div>
            <div className="detail-section-label">Cast</div>
            <div className="actor-list">
              {movie.actors.slice(0, 5).map((a, i) => {
                const isString = typeof a === 'string';
                const name = isString ? a : a.name;
                const role = isString ? null : a.role;
                return (
                  <div key={i} className="actor-item">
                    {name}
                    {role && <span className="role"> as {role}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Extra padding so content clears the action buttons below */}
        <div style={{ height: '1rem' }} />
      </div>
    </div>
  );
}

// ─── StackCard (background depth cards) ──────────────────────────────────────

export const StackCard = memo(function StackCard({ movie, depth }) {
  // depth 0 = immediately behind top card, depth 1 = furthest back
  const scale = depth === 0 ? 0.96 : 0.91;
  const translateY = depth === 0 ? 10 : 22;
  const rot = keyRotation(movie?.plex_rating_key, depth === 0 ? 0.9 : 1.4);
  const src = imageUrl(movie?.thumb);

  return (
    <div
      className="swipe-card-wrapper stack-card"
      style={{
        zIndex: 10 - depth,
        transform: `scale(${scale}) translateY(${translateY}px) rotate(${rot}deg)`,
        transformOrigin: 'center bottom',
        transition: 'transform 0.3s ease',
      }}
    >
      <div className="movie-card" style={{ pointerEvents: 'none', cursor: 'default' }}>
        {src ? (
          <img src={src} alt="" className="movie-card-poster" draggable={false} />
        ) : (
          <div className="movie-card-poster-placeholder"><span>🎬</span></div>
        )}
      </div>
    </div>
  );
});

// ─── MovieCard (exported, top interactive card) ───────────────────────────────

export const MovieCard = forwardRef(function MovieCard(
  { movie, onLike, onPass, disabled },
  ref
) {
  const [isFlipped, setIsFlipped] = useState(false);

  const { cardStyle, likeOpacity, passOpacity, triggerSwipe, handlers } = useSwipe({
    onSwipeRight: onLike,
    onSwipeLeft: onPass,
    disabled,
  });

  const triggerFlip = useCallback(() => setIsFlipped(v => !v), []);

  // Expose triggerSwipe and triggerFlip to parent via ref
  useImperativeHandle(ref, () => ({ triggerSwipe, triggerFlip }), [triggerSwipe, triggerFlip]);

  return (
    // Drag transform lives here; active-card-scene handles the entrance animation
    // so the two transforms don't conflict.
    <div
      className="swipe-card-wrapper active-card"
      style={{ zIndex: 20, ...cardStyle }}
      {...handlers}
    >
      <div className="active-card-scene">
        <div className={`flip-card-inner${isFlipped ? ' flipped' : ''}`}>
          <PosterFront
            movie={movie}
            likeOpacity={likeOpacity}
            passOpacity={passOpacity}
            onFlip={triggerFlip}
            isFlipped={isFlipped}
          />
          <MetadataBack movie={movie} onFlip={triggerFlip} />
        </div>
      </div>
    </div>
  );
});

// ─── SwipeActions (rendered outside the deck by the parent) ──────────────────

export function SwipeActions({ onLike, onPass, onInfo, disabled }) {
  return (
    <div className="swipe-actions">
      <button
        className="action-btn action-btn-pass"
        onClick={onPass}
        disabled={disabled}
        aria-label="Pass"
      >
        ✕
      </button>
      <button
        className="action-btn action-btn-info"
        onClick={onInfo}
        aria-label="More info"
      >
        i
      </button>
      <button
        className="action-btn action-btn-like"
        onClick={onLike}
        disabled={disabled}
        aria-label="Like"
      >
        ♥
      </button>
    </div>
  );
}

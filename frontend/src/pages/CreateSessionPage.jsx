import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { movies, sessions } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';
import { Navbar } from '../components/Navbar.jsx';

const DECADES = [
  { label: '2020s', value: '2020' },
  { label: '2010s', value: '2010' },
  { label: '2000s', value: '2000' },
  { label: '1990s', value: '1990' },
  { label: '1980s', value: '1980' },
  { label: '1970s', value: '1970' },
  { label: '1960s', value: '1960' },
  { label: '1950s', value: '1950' },
  { label: '1940s & older', value: '1940' },
];

export function CreateSessionPage() {
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [genres, setGenres] = useState([]);
  const [contentRatings, setContentRatings] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedDecades, setSelectedDecades] = useState([]);
  const [minRating, setMinRating] = useState(0);
  const [selectedContentRatings, setSelectedContentRatings] = useState([]);
  const [matchPercentage, setMatchPercentage] = useState(100);
  const [excludeWatched, setExcludeWatched] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [creating, setCreating] = useState(false);
  const [previewCount, setPreviewCount] = useState(null);

  useEffect(() => {
    movies.genres().then(d => setGenres(d.genres || [])).catch(() => {});
    movies.contentRatings().then(d => setContentRatings(d.ratings || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const filters = buildFilters();
    movies.getAll(filters).then(d => setPreviewCount(d.total)).catch(() => {});
  }, [selectedGenres, selectedDecades, minRating, selectedContentRatings, excludeWatched]);

  const buildFilters = () => ({
    genres: selectedGenres.length > 0 ? selectedGenres : null,
    decades: selectedDecades.length > 0 ? selectedDecades : null,
    minRating: minRating > 0 ? minRating : null,
    contentRatings: selectedContentRatings.length > 0 ? selectedContentRatings : null,
    excludeWatched: excludeWatched || null,
  });

  const toggleGenre = (g) => {
    setSelectedGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const toggleDecade = (d) => {
    setSelectedDecades(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  const toggleContentRating = (r) => {
    setSelectedContentRatings(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );
  };

  const handleCreate = async () => {
    if (!adminName.trim()) {
      showToast('Please enter your name');
      return;
    }
    if (previewCount === 0) {
      showToast('No movies match your filters');
      return;
    }

    setCreating(true);
    try {
      const data = await sessions.create({
        filterConfig: buildFilters(),
        matchPercentage: matchPercentage / 100,
        adminName: adminName.trim(),
      });

      // Store user token for this session
      localStorage.setItem(`session_token_${data.code}`, data.userToken);
      localStorage.setItem(`session_user_${data.code}`, adminName.trim());
      localStorage.setItem(`session_admin_${data.code}`, '1');

      navigate(`/session/${data.code}`, {
        state: {
          isNew: true,
          shareUrl: data.shareUrl,
          userToken: data.userToken,
          adminName: adminName.trim(),
        }
      });
    } catch (err) {
      showToast(err.message || 'Failed to create session');
      setCreating(false);
    }
  };

  return (
    <div className="create-page">
      <Navbar title="New Session" backTo="/" />

      <div className="create-content">
        <div className="filter-section">
          <div className="filter-section-title">👤 Your name</div>
          <input
            className="form-input"
            placeholder="Enter your name"
            value={adminName}
            onChange={e => setAdminName(e.target.value)}
            maxLength={30}
          />
        </div>

        {genres.length > 0 && (
          <div className="filter-section">
            <div className="filter-section-title">🎭 Genres</div>
            <div className="chip-group">
              {genres.map(g => (
                <div
                  key={g}
                  className={`chip ${selectedGenres.includes(g) ? 'active' : ''}`}
                  onClick={() => toggleGenre(g)}
                >
                  {g}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="filter-section">
          <div className="filter-section-title">📅 Decade</div>
          <div className="chip-group">
            {DECADES.map(d => (
              <div
                key={d.value}
                className={`chip ${selectedDecades.includes(d.value) ? 'active' : ''}`}
                onClick={() => toggleDecade(d.value)}
              >
                {d.label}
              </div>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-section-title">⭐ Minimum Rating</div>
          <div className="range-group">
            <div className="range-header">
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {minRating === 0 ? 'Any rating' : `${minRating}+ stars`}
              </span>
              <span className="range-value">{minRating > 0 ? minRating.toFixed(1) : 'Off'}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={minRating}
              onChange={e => setMinRating(parseFloat(e.target.value))}
            />
          </div>
        </div>

        {contentRatings.length > 0 && (
          <div className="filter-section">
            <div className="filter-section-title">🔞 Content Rating</div>
            <div className="chip-group">
              {contentRatings.map(r => (
                <div
                  key={r}
                  className={`chip ${selectedContentRatings.includes(r) ? 'active' : ''}`}
                  onClick={() => toggleContentRating(r)}
                >
                  {r}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="filter-section">
          <div className="filter-section-title">👁 Watched</div>
          <div className="chip-group">
            <div
              className={`chip ${excludeWatched ? 'active' : ''}`}
              onClick={() => setExcludeWatched(v => !v)}
            >
              Hide watched
            </div>
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-section-title">🎯 Match Threshold</div>
          <div className="range-group">
            <div className="range-header">
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {matchPercentage === 100 ? 'Everyone must agree' : `${matchPercentage}% of users`}
              </span>
              <span className="range-value">{matchPercentage}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="10"
              value={matchPercentage}
              onChange={e => setMatchPercentage(parseInt(e.target.value))}
            />
          </div>
        </div>

        {previewCount !== null && (
          <div style={{
            textAlign: 'center',
            padding: '0.75rem',
            background: previewCount > 0 ? 'var(--bg-elevated)' : 'var(--pass-bg)',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            color: previewCount > 0 ? 'var(--text-secondary)' : 'var(--pass)',
            marginBottom: '1rem',
          }}>
            {previewCount > 0
              ? `${previewCount} movies match your filters`
              : 'No movies match these filters — adjust them to continue'}
          </div>
        )}

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleCreate}
          disabled={creating || previewCount === 0}
        >
          {creating ? 'Creating...' : '🎲 Create Session'}
        </button>
      </div>
    </div>
  );
}

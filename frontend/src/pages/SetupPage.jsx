import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, movies } from '../api/index.js';
import { useApp } from '../context/AppContext.jsx';

const POLL_INTERVAL = 2000;

export function SetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkStatus, showToast } = useApp();

  const [step, setStep] = useState('welcome'); // welcome | polling | servers | library | syncing | done
  const [pinId, setPinId] = useState(null);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [error, setError] = useState(null);
  const [movieCount, setMovieCount] = useState(null);
  const pollRef = useRef(null);

  // Handle callback from Plex OAuth
  useEffect(() => {
    const isCallback = searchParams.get('plexCallback');
    const storedPinId = sessionStorage.getItem('plexPinId');
    if (isCallback && storedPinId) {
      setPinId(storedPinId);
      setStep('polling');
      startPolling(storedPinId);
    }
  }, []);

  const startPlexAuth = async () => {
    setError(null);
    try {
      const forwardUrl = `${window.location.origin}/setup?plexCallback=1`;
      const { pinId: id, authUrl } = await auth.requestPin(forwardUrl);
      sessionStorage.setItem('plexPinId', id);
      setPinId(id);
      setStep('polling');

      // Open Plex auth in same window
      window.location.href = authUrl;
    } catch (err) {
      setError(err.message);
    }
  };

  const startPolling = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await auth.pollPin(id);
        if (data.authenticated) {
          clearInterval(pollRef.current);
          sessionStorage.removeItem('plexPinId');
          if (data.servers?.length === 1) {
            handleServerSelect(data.servers[0]);
          } else {
            setServers(data.servers || []);
            setStep('servers');
          }
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setError('Authentication failed. Please try again.');
        setStep('welcome');
      }
    }, POLL_INTERVAL);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleServerSelect = async (server) => {
    setSelectedServer(server);
    setError(null);
    try {
      const data = await auth.saveServer({
        machineIdentifier: server.machineIdentifier,
        connections: server.connections,
        serverName: server.name,
      });
      setLibraries(data.libraries || []);
      if (data.libraries?.length === 1) {
        handleLibrarySelect(data.libraries[0]);
      } else {
        setStep('library');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to server');
    }
  };

  const handleLibrarySelect = async (library) => {
    setError(null);
    setStep('syncing');
    try {
      await auth.saveLibrary(library.key || library.id);
      // Wait a moment then check movie count
      setTimeout(async () => {
        const count = await movies.count();
        setMovieCount(count.count);
        await checkStatus();
        setStep('done');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to set library');
      setStep('library');
    }
  };

  const handleDone = () => navigate('/');

  return (
    <div className="setup-page">
      {step === 'welcome' && (
        <>
          <div className="setup-logo">🎬</div>
          <h1 className="setup-title">WatchWithMe</h1>
          <p className="setup-subtitle">
            Connect your Plex library and find the perfect movie to watch together.
          </p>

          <div className="setup-steps">
            <div className="setup-step">
              <div className="setup-step-icon">🔐</div>
              <div className="setup-step-text">
                <h4>Connect to Plex</h4>
                <p>Authenticate with your Plex account</p>
              </div>
            </div>
            <div className="setup-step">
              <div className="setup-step-icon">🗃️</div>
              <div className="setup-step-text">
                <h4>Select your library</h4>
                <p>Choose which movie library to use</p>
              </div>
            </div>
            <div className="setup-step">
              <div className="setup-step-icon">🃏</div>
              <div className="setup-step-text">
                <h4>Start swiping</h4>
                <p>Create sessions and find your match</p>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--pass)', fontSize: '0.875rem', marginBottom: '1rem', maxWidth: '300px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary btn-lg" onClick={startPlexAuth}>
            Connect to Plex
          </button>
        </>
      )}

      {step === 'polling' && (
        <>
          <div className="spinner" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Waiting for Plex</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '280px' }}>
            Complete authentication in the Plex window, then come back here.
          </p>
          <button
            className="btn btn-ghost mt-3"
            onClick={() => { clearInterval(pollRef.current); setStep('welcome'); }}
          >
            Cancel
          </button>
        </>
      )}

      {step === 'servers' && (
        <>
          <h2 style={{ marginBottom: '0.5rem' }}>Choose a Server</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Select the Plex server to use
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '380px' }}>
            {servers.map(server => (
              <button
                key={server.machineIdentifier}
                className="card"
                style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border)' }}
                onClick={() => handleServerSelect(server)}
              >
                <div style={{ fontWeight: 700 }}>🖥 {server.name}</div>
              </button>
            ))}
          </div>
          {error && <div style={{ color: 'var(--pass)', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        </>
      )}

      {step === 'library' && (
        <>
          <h2 style={{ marginBottom: '0.5rem' }}>Choose a Library</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Select your movie library
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '380px' }}>
            {libraries.map(lib => (
              <button
                key={lib.key}
                className="card"
                style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border)' }}
                onClick={() => handleLibrarySelect(lib)}
              >
                <div style={{ fontWeight: 700 }}>🎬 {lib.title}</div>
                {lib.count && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {lib.count} movies
                </div>}
              </button>
            ))}
          </div>
          {error && <div style={{ color: 'var(--pass)', marginTop: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        </>
      )}

      {step === 'syncing' && (
        <>
          <div className="spinner" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Syncing Library</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '280px' }}>
            Fetching your movies from Plex. This may take a moment for large libraries.
          </p>
        </>
      )}

      {step === 'done' && (
        <>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ marginBottom: '0.5rem' }}>All Set!</h2>
          {movieCount !== null && (
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', textAlign: 'center' }}>
              Synced {movieCount.toLocaleString()} movies from your Plex library
            </p>
          )}
          <button className="btn btn-primary btn-lg" onClick={handleDone}>
            Start Watching 🎬
          </button>
        </>
      )}
    </div>
  );
}

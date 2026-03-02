import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export function Navbar({ title, backTo, actions }) {
  const navigate = useNavigate();
  const { plexConfigured, serverName, adminLoggedIn, handleAdminLogout } = useApp();

  const onLogout = async () => {
    await handleAdminLogout();
    navigate('/admin/login');
  };

  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {backTo ? (
          <button
            className="btn btn-ghost"
            style={{ padding: '0.35rem 0.5rem' }}
            onClick={() => navigate(backTo)}
          >
            ←
          </button>
        ) : null}
        {title ? (
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</span>
        ) : (
          <Link to="/" className="navbar-brand">
            <span className="brand-icon">🎬</span>
            WatchWithMe
          </Link>
        )}
      </div>

      <div className="navbar-actions">
        {actions}
        {plexConfigured && serverName && !title && (
          <Link to="/setup" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            {serverName}
          </Link>
        )}
        {adminLoggedIn && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            onClick={onLogout}
          >
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}

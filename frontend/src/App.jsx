import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from './context/AppContext.jsx';
import { AdminLoginPage } from './pages/AdminLoginPage.jsx';
import { SetupPage } from './pages/SetupPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { CreateSessionPage } from './pages/CreateSessionPage.jsx';
import { JoinPage } from './pages/JoinPage.jsx';
import { SessionPage } from './pages/SessionPage.jsx';

function RequireAdmin({ children }) {
  const { adminLoggedIn, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !adminLoggedIn) {
      navigate('/admin/login');
    }
  }, [adminLoggedIn, loading]);

  if (loading || !adminLoggedIn) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return children;
}

function RequireSetup({ children }) {
  const { plexConfigured, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !plexConfigured) {
      navigate('/setup');
    }
  }, [plexConfigured, loading]);

  if (loading || !plexConfigured) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/setup"
        element={
          <RequireAdmin>
            <SetupPage />
          </RequireAdmin>
        }
      />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route
        path="/"
        element={
          <RequireAdmin>
            <RequireSetup>
              <HomePage />
            </RequireSetup>
          </RequireAdmin>
        }
      />
      <Route
        path="/create"
        element={
          <RequireAdmin>
            <RequireSetup>
              <CreateSessionPage />
            </RequireSetup>
          </RequireAdmin>
        }
      />
      <Route path="/session/:code" element={<SessionPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

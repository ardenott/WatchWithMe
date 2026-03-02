import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, admin } from '../api/index.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [plexConfigured, setPlexConfigured] = useState(false);
  const [serverName, setServerName] = useState(null);
  const [movieCount, setMovieCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [hasAdminPassword, setHasAdminPassword] = useState(false);
  const [toasts, setToasts] = useState([]);

  const checkStatus = useCallback(async () => {
    try {
      const [plexData, adminData] = await Promise.all([auth.status(), admin.status()]);
      setPlexConfigured(plexData.configured);
      setServerName(plexData.serverName);
      setAdminLoggedIn(adminData.loggedIn);
      setHasAdminPassword(adminData.hasPassword);
    } catch {
      setPlexConfigured(false);
      setAdminLoggedIn(false);
      setHasAdminPassword(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const handleAdminLogout = useCallback(async () => {
    await admin.logout();
    setAdminLoggedIn(false);
  }, []);

  const showToast = useCallback((message) => {
    const id = Date.now();
    setToasts(t => [...t, { id, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  return (
    <AppContext.Provider value={{
      plexConfigured,
      serverName,
      movieCount,
      setMovieCount,
      loading,
      adminLoggedIn,
      hasAdminPassword,
      checkStatus,
      handleAdminLogout,
      showToast,
      toasts,
    }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">{t.message}</div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

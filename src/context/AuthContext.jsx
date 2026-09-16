import { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../lib/authService';
import { isDemo } from '../lib/firebase';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getUser());
  const [initializing, setInitializing] = useState(!isDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => authService.subscribe((profile, failure, pending = false) => {
    setUser(profile);
    setInitializing(pending);
    if (failure) setError(failure.message);
    else if (profile) setError('');
  }), []);
  const wrap = fn => async (...args) => {
    setBusy(true); setError('');
    try { const profile = await fn(...args); setUser(profile || null); return profile; }
    catch (failure) { setError(failure.message); throw failure; }
    finally { setBusy(false); }
  };
  return <AuthContext.Provider value={{ user, initializing, loading: initializing || busy, error,
    login: wrap(authService.login), register: wrap(authService.register), google: wrap(authService.google), logout: wrap(authService.logout),
  }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

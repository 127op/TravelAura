import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authService } from '../lib/authService';
import { errorMessage } from '../lib/feedback';
import { isDemo } from '../lib/firebase';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getUser());
  const [initializing, setInitializing] = useState(!isDemo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(null);
  useEffect(() => authService.subscribe((profile, failure, pending = false) => {
    setUser(profile);
    setInitializing(pending);
    if (failure) setError(errorMessage(failure));
    else if (profile) setError('');
  }), []);
  const wrap = fn => (...args) => {
    if (pending.current) return pending.current;
    setBusy(true); setError('');
    pending.current = Promise.resolve().then(() => fn(...args))
      .then(profile => { setUser(profile || null); return profile; })
      .catch(failure => { setError(errorMessage(failure)); throw failure; })
      .finally(() => { pending.current = null; setBusy(false); });
    return pending.current;
  };
  return <AuthContext.Provider value={{ user, initializing, loading: initializing || busy, error,
    login: wrap(authService.login), register: wrap(authService.register), google: wrap(authService.google), logout: wrap(authService.logout),
  }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

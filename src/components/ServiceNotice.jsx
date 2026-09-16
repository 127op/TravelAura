import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPartialFirebaseConfig } from '../lib/firebase';
export default function ServiceNotice() {
  const [message, setMessage] = useState('');
  const { error } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => {
    const show = event => setMessage(event.detail);
    window.addEventListener('travelaura-error', show);
    return () => window.removeEventListener('travelaura-error', show);
  }, []);
  useEffect(() => setMessage(''), [pathname]);
  const text = message || error || (hasPartialFirebaseConfig ? 'Demo mode is active because the Firebase configuration is incomplete.' : '');
  return text ? <p className="form-error" role="alert">{text}</p> : null;
}

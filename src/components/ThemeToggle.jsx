import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const storageKey = 'travelaura_theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(storageKey) === 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem(storageKey, dark ? 'dark' : 'light');
  }, [dark]);

  return <button className="theme-toggle" type="button" onClick={() => setDark(value => !value)} aria-label={dark ? 'Use light mode' : 'Use dark mode'} title={dark ? 'Use light mode' : 'Use dark mode'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
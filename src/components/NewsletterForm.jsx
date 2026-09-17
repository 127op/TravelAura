import { useRef, useState } from 'react';
import { db } from '../lib/dataService';
import { errorMessage } from '../lib/feedback';

export default function NewsletterForm() {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const submitting = useRef(false);
  const submit = async event => {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const email = new FormData(form).get('email');
    submitting.current = true; setBusy(true); setMessage('');
    try {
      await db.saveContact({ name: 'Travel updates request', email, phone: '', message: 'Please send me monthly travel ideas.' });
      form.reset(); setMessage('Your request has been saved.');
    } catch (error) { setMessage(errorMessage(error)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <><form className="subscribe" onSubmit={submit} aria-label="Request travel updates">
    <input required type="email" maxLength={254} name="email" placeholder="Your email" aria-label="Email for travel updates" />
    <button type="submit" disabled={busy} aria-label="Request travel updates">→</button>
  </form>{message && <p role="status">{message}</p>}</>;
}

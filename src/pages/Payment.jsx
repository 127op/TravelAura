import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { db } from '../lib/dataService';

export default function Payment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    Promise.resolve(db.getBooking(bookingId))
      .then(setBooking)
      .catch(failure => setError(failure.message));
  }, [bookingId]);

  const submit = async event => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    setBusy(true);
    try {
      await db.submitPayment(bookingId);
      setDone(true);
    } catch (failure) {
      setError(failure.code === 'permission-denied'
        ? 'Your payment confirmation could not be saved. Please contact support.'
        : failure.message || 'Unable to submit payment confirmation.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  if (!booking) {
    return <section className="section"><div className="empty">{error || 'Loading booking or booking unavailable.'}</div></section>;
  }

  if (!['pending', 'payment_failed'].includes(booking.bookingStatus)) {
    return <section className="section"><div className="empty">This booking cannot accept payment confirmation.</div></section>;
  }

  if (done) {
    return <section className="confirmation">
      <CheckCircle2 size={52} />
      <span className="eyebrow">PAYMENT CONFIRMATION SUBMITTED</span>
      <h1>Verification pending</h1>
      <p>Your payment confirmation was received. An admin will verify your payment.</p>
      <button className="button" onClick={() => navigate('/my-bookings')}>View my bookings</button>
    </section>;
  }

  return <section className="section payment-page">
    <div className="payment-card">
      <span className="eyebrow">DEMO UPI PAYMENT</span>
      <h1>Complete your payment</h1>
      <div className="amount-box">Amount <strong>₹{Number(booking.totalAmount).toLocaleString('en-IN')}</strong></div>
      <img className="qr-image" src="/payment-qr.svg" alt="TravelAura demo UPI QR" />
      <p><strong>UPI ID:</strong> travelaura@upi</p>
      <ol>
        <li>This assessment uses a demo QR; do not send real money.</li>
        <li>Submit the confirmation below to simulate a payment.</li>
        <li>An admin reviews the confirmation and updates your booking.</li>
      </ol>
      <form onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button full" disabled={busy}>
          {busy ? 'Submitting...' : 'Submit payment confirmation'}
        </button>
      </form>
      <p className="safe">Demo only. No money is collected. Payment approval is simulated by the admin.</p>
    </div>
  </section>;
}

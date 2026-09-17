import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { withFeedback, reportError } from '../lib/feedback';
import { db } from '../lib/dataService';
import { useAuth } from '../context/AuthContext';

export default function BookingDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [review, setReview] = useState({ rating: 5, title: '', comment: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [submittedReview, setSubmittedReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const submitting = useRef(false);

  useEffect(() => {
    setReviewLoading(true);
    Promise.all([Promise.resolve(db.getBooking(id)), Promise.resolve(db.getMyReview(id))])
      .then(([item, savedReview]) => { setBooking(item); setSubmittedReview(savedReview); })
      .catch(reportError).finally(() => setReviewLoading(false));
  }, [id, user.id, user.role]);

  const submitReview = withFeedback(async event => {
    event.preventDefault();
    if (submitting.current || submittedReview) return;
    submitting.current = true;
    setBusy(true);
    try {
      const saved = await db.saveReview({ ...review, packageId: booking.packageId, bookingId: booking.id });
      setSubmittedReview(saved);
      setMessage('Review submitted for admin approval.');
      setReview({ rating: 5, title: '', comment: '' });
    } finally { submitting.current = false; setBusy(false); }
  });

  const printBooking = () => {
    window.print();
  };

  if (!booking) return <section className="section"><div className="empty">Booking not found or unavailable.</div></section>;

  return <section className="section booking-detail-page">
    <div className="booking-detail-actions no-print">
      <Link to="/my-bookings" className="back">← My bookings</Link>
      <button className="button secondary" type="button" onClick={printBooking}><Printer size={16} /> Print payment receipt</button>
    </div>
    <div className="detail-panel printable-booking">
      <span className="eyebrow">BOOKING {booking.id}</span>
      <h1>{booking.packageName}</h1>
      <div className="booking-detail-grid">
        <div><h3>Trip</h3><p>{booking.destination}</p><p>{booking.travelDate} → {booking.returnDate}</p><p>{booking.adults} adults · {booking.children} children · {booking.rooms} room(s)</p></div>
        <div><h3>Customer</h3><p>{booking.customerName}</p><p>{booking.email}</p><p>{booking.phone}</p></div>
        <div><h3>Status</h3><p>Payment: <b>{booking.paymentStatus}</b></p><p>Booking: <b>{booking.bookingStatus}</b></p></div>
        <div><h3>Total</h3><p className="big-price">₹{Number(booking.totalAmount).toLocaleString('en-IN')}</p></div>
      </div>
      {booking.paymentSubmittedAt && <p>Payment confirmation submitted: {new Date(booking.paymentSubmittedAt).toLocaleString()}</p>}
      {booking.transactionId && <p>Transaction/reference ID: {booking.transactionId}</p>}
      {booking.paymentScreenshot && <div><h3>Payment proof</h3><img className="payment-preview large" src={booking.paymentScreenshot} alt="payment proof" /></div>}
    </div>
    {submittedReview && <section className="detail-panel no-print" aria-label="Your review">
      <h2>Your review</h2><p className="success-text" role="status">{message || `Review status: ${submittedReview.status}`}</p>
      <p>{submittedReview.rating}/5 · {submittedReview.userName}</p><h3>{submittedReview.title}</h3><p>{submittedReview.comment}</p>
    </section>}
    {booking.bookingStatus === 'completed' && booking.userId === user.id && !reviewLoading && !submittedReview && <form className="form-card review-form no-print" onSubmit={submitReview}>
      <h2>Review your trip</h2>
      <label>Rating<select value={review.rating} onChange={event => setReview({ ...review, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} stars</option>)}</select></label>
      <label>Title<input required maxLength={200} value={review.title} onChange={event => setReview({ ...review, title: event.target.value })} /></label>
      <label>Comment<textarea required maxLength={5000} value={review.comment} onChange={event => setReview({ ...review, comment: event.target.value })} /></label>
      <button className="button" disabled={busy}>Submit review</button>
      {message && <p className="success-text">{message}</p>}
    </form>}
  </section>;
}

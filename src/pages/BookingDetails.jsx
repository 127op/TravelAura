import { useEffect, useState } from 'react';
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

  useEffect(() => {
    Promise.resolve(db.getBooking(id)).then(setBooking).catch(reportError);
  }, [id, user.id, user.role]);

  const submitReview = withFeedback(async event => {
    event.preventDefault();
    setBusy(true);
    try {
      await db.saveReview({ ...review, userId: user.id, userName: user.name, packageId: booking.packageId, bookingId: booking.id, status: 'pending', featured: false });
      setMessage('Review submitted for admin approval.');
      setReview({ rating: 5, title: '', comment: '' });
    } finally { setBusy(false); }
  });

  const printBooking = () => {
    const printable = document.querySelector('.printable-booking');
    if (!printable) return;
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>TravelAura booking ${booking.id}</title><style>
      *{box-sizing:border-box}body{margin:0;padding:36px;font:16px Arial,sans-serif;color:#173b39}h1{font:600 34px Georgia,serif;margin:14px 0 28px}.eyebrow{color:#d88731;font-size:12px;font-weight:700;letter-spacing:2px}.booking-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.booking-detail-grid>div{background:#f7faf8;border-radius:10px;padding:18px;min-height:170px}.booking-detail-grid h3{margin:0 0 20px}.booking-detail-grid p{line-height:1.55;margin:10px 0}.big-price{font-size:30px;font-weight:700}img{max-width:300px;height:auto}@media print{body{padding:0}}
    </style></head><body>${printable.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.addEventListener('load', () => { printWindow.print(); printWindow.close(); });
  };

  if (!booking) return <section className="section"><div className="empty">Booking not found or unavailable.</div></section>;

  return <section className="section booking-detail-page">
    <div className="booking-detail-actions no-print">
      <Link to="/my-bookings" className="back">← My bookings</Link>
      <button className="button secondary" type="button" onClick={printBooking}><Printer size={16} /> Print booking</button>
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
      {booking.paymentScreenshot && <div><h3>Payment proof</h3><img className="payment-preview large" src={booking.paymentScreenshot} alt="payment proof" /></div>}
    </div>
    {booking.bookingStatus === 'completed' && <form className="form-card review-form no-print" onSubmit={submitReview}>
      <h2>Review your trip</h2>
      <label>Rating<select value={review.rating} onChange={event => setReview({ ...review, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} stars</option>)}</select></label>
      <label>Title<input required value={review.title} onChange={event => setReview({ ...review, title: event.target.value })} /></label>
      <label>Comment<textarea required value={review.comment} onChange={event => setReview({ ...review, comment: event.target.value })} /></label>
      <button className="button" disabled={busy}>Submit review</button>
      {message && <p className="success-text">{message}</p>}
    </form>}
  </section>;
}

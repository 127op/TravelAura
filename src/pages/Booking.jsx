import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, TicketPercent } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/dataService';
import { useAuth } from '../context/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);

export default function Booking() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pack, setPack] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(null);
  const [form, setForm] = useState({ travelDate: '', returnDate: '', adults: 2, children: 0, rooms: 1, name: user?.name || '', email: user?.email || '', phone: user?.phone || '', country: 'India', specialRequirements: '', coupon: '' });

  useEffect(() => {
    Promise.resolve(db.getPackages()).then(packages => setPack(packages.find(item => item.id === packageId))).catch(failure => setError(failure.message));
  }, [packageId]);

  const update = event => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
    if (['adults', 'children', 'coupon'].includes(name)) setApplied(null);
  };

  const subtotal = useMemo(() => pack ? Number(pack.pricePerAdult) * Number(form.adults) + Number(pack.pricePerChild) * Number(form.children) : 0, [pack, form.adults, form.children]);
  const discount = applied ? Math.min(subtotal, applied.type === 'fixed' ? Number(applied.value) : Math.round(subtotal * Number(applied.value) / 100)) : 0;
  const total = Math.max(0, subtotal - discount);

  const applyCoupon = async () => {
    setError('');
    setApplied(null);
    setBusy(true);
    try { setApplied(await db.validateCoupon(form.coupon, subtotal)); } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    if (!pack) return;
    if (!form.travelDate || !form.returnDate) return setError('Choose travel and return dates.');
    if (form.returnDate <= form.travelDate) return setError('Return date must be after travel date.');
    if (Number(form.adults) < 1 || Number(form.adults) > Number(pack.maxAdults) || Number(form.children) > Number(pack.maxChildren)) return setError('Traveler count exceeds this package capacity.');
    if (Number(form.rooms) < 1 || Number(form.rooms) > Number(pack.maxRooms)) return setError('Invalid room count.');
    setBusy(true);
    try {
      const booking = await db.createBooking({ ...form, customerName: form.name, userId: user.id, packageId: pack.id, destinationId: pack.destinationId, packageName: pack.name, destination: pack.destination, adults: Number(form.adults), children: Number(form.children), rooms: Number(form.rooms), couponCode: applied?.code || '', subtotal, discount, totalAmount: total, priceBreakdown: { adultTotal: Number(pack.pricePerAdult) * Number(form.adults), childTotal: Number(pack.pricePerChild) * Number(form.children), subtotal, discount, total }, paymentStatus: 'pending', bookingStatus: 'pending' });
      navigate(`/payment/${booking.id}`);
    } catch (failure) { setError(failure.message || 'Unable to create booking.'); } finally { setBusy(false); }
  };

  if (!pack) return <section className="section"><div className="empty">{error || 'Loading package or package unavailable.'}</div></section>;

  return <section className="booking section">
    <button className="back" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>
    <div className="booking-layout">
      <form className="form-card" onSubmit={submit}>
        <span className="eyebrow">RESERVE YOUR JOURNEY</span>
        <h1>Book {pack.name}</h1>
        <label>Travel date<input required type="date" min={today()} name="travelDate" value={form.travelDate} onChange={update} /></label>
        <label>Return date<input required type="date" min={form.travelDate || today()} name="returnDate" value={form.returnDate} onChange={update} /></label>
        <div className="form-row"><label>Adults<select name="adults" value={form.adults} onChange={update}>{Array.from({ length: pack.maxAdults }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}</select></label><label>Children<select name="children" value={form.children} onChange={update}>{Array.from({ length: pack.maxChildren + 1 }, (_, index) => index).map(value => <option key={value}>{value}</option>)}</select></label></div>
        <label>Rooms<select name="rooms" value={form.rooms} onChange={update}>{Array.from({ length: pack.maxRooms }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Full name<input required name="name" value={form.name} onChange={update} /></label>
        <label>Email<input required type="email" name="email" value={form.email} onChange={update} /></label>
        <label>Phone<input required pattern="[0-9+ -]{8,15}" name="phone" value={form.phone} onChange={update} /></label>
        <label>Country<input required name="country" value={form.country} onChange={update} /></label>
        <label>Special requirements<textarea name="specialRequirements" value={form.specialRequirements} onChange={update} placeholder="Dietary needs, room preference, etc." /></label>
        <div className="coupon-row"><input name="coupon" value={form.coupon} onChange={update} placeholder="Coupon code" /><button type="button" disabled={busy} onClick={applyCoupon}><TicketPercent size={16} /> Apply</button></div>
        {applied && <p className="success-text">Coupon {applied.code} applied.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button full" disabled={busy}>{busy ? 'Creating booking...' : 'Continue to payment'}</button>
      </form>
      <aside className="summary"><img src={pack.images?.[0]} alt={pack.name} /><h3>{pack.name}</h3><p>{pack.destination} · {pack.duration} days</p><div className="price-lines"><span>Adults ({form.adults}) <b>₹{(pack.pricePerAdult * Number(form.adults)).toLocaleString('en-IN')}</b></span><span>Children ({form.children}) <b>₹{(pack.pricePerChild * Number(form.children)).toLocaleString('en-IN')}</b></span><span>Subtotal <b>₹{subtotal.toLocaleString('en-IN')}</b></span>{discount > 0 && <span>Discount <b>-₹{discount.toLocaleString('en-IN')}</b></span>}<span className="total-line">Total <b>₹{total.toLocaleString('en-IN')}</b></span></div></aside>
    </div>
  </section>;
}

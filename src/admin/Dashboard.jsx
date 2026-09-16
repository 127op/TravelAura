import { useEffect, useMemo, useState } from 'react';
import { reportError } from '../lib/feedback';
import { db } from '../lib/dataService';

const emptyData = { bookings: [], users: [], packages: [], destinations: [] };

export default function Dashboard() {
  const [data, setData] = useState(emptyData);

  const load = () => Promise.all([
    Promise.resolve(db.getBookings({ admin: true })),
    Promise.resolve(db.getUsers()),
    Promise.resolve(db.getPackages({ admin: true })),
    Promise.resolve(db.getDestinations({ admin: true })),
  ]).then(([bookings, users, packages, destinations]) => {
    setData({ bookings, users, packages, destinations });
  }).catch(reportError);

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener('travelaura-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('travelaura-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const revenue = useMemo(() => data.bookings
    .filter(booking => String(booking.paymentStatus).toLowerCase() === 'paid')
    .reduce((sum, booking) => sum + Number(booking.totalAmount ?? booking.total ?? 0), 0), [data.bookings]);
  const pending = data.bookings.filter(booking => booking.paymentStatus === 'pending').length;
  const stats = [
    ['Total bookings', data.bookings.length],
    ['Customers', data.users.filter(user => user.role !== 'admin').length],
    ['Packages', data.packages.length],
    ['Destinations', data.destinations.length],
    ['Revenue', `₹${revenue.toLocaleString('en-IN')}`],
    ['Pending payments', pending],
    ['Confirmed', data.bookings.filter(booking => booking.bookingStatus === 'confirmed').length],
  ];

  return <>
    <div className="admin-title"><div><span className="eyebrow">CONTROL CENTER</span><h1>Dashboard</h1></div></div>
    <div className="stats">{stats.map(([label, value]) => <div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="admin-grid-two">
      <section className="admin-panel"><h2>Booking status</h2><div className="simple-chart">{[
        ['Pending', data.bookings.filter(booking => booking.bookingStatus === 'pending').length],
        ['Confirmed', data.bookings.filter(booking => booking.bookingStatus === 'confirmed').length],
        ['Completed', data.bookings.filter(booking => booking.bookingStatus === 'completed').length],
        ['Cancelled', data.bookings.filter(booking => booking.bookingStatus === 'cancelled').length],
      ].map(([label, value]) => <div key={label}><span>{label} <b>{value}</b></span><i style={{ width: `${data.bookings.length ? Math.max(5, value / data.bookings.length * 100) : 0}%` }} /></div>)}</div></section>
      <section className="admin-panel"><h2>Revenue snapshot</h2><div className="revenue-big">₹{revenue.toLocaleString('en-IN')}</div><p className="muted">Revenue counts only bookings whose payment status is paid.</p></section>
    </div>
    <div className="admin-grid-two">
      <section className="admin-panel"><h2>Recent bookings</h2>{data.bookings.slice(0, 6).map(booking => <div className="mini-row" key={booking.id}><div><strong>{booking.customerName}</strong><small>{booking.packageName}</small></div><span>{booking.bookingStatus}</span></div>)}{!data.bookings.length && <p className="muted">No bookings yet.</p>}</section>
      <section className="admin-panel"><h2>Pending verification</h2>{data.bookings.filter(booking => booking.paymentStatus === 'pending' && (booking.paymentSubmittedAt || booking.transactionId || booking.paymentScreenshot)).slice(0, 6).map(booking => <div className="mini-row" key={booking.id}><div><strong>{booking.customerName}</strong><small>₹{Number(booking.totalAmount).toLocaleString('en-IN')}</small></div><span>{booking.transactionId || 'Confirmation submitted'}</span></div>)}{!data.bookings.some(booking => booking.paymentStatus === 'pending' && (booking.paymentSubmittedAt || booking.transactionId || booking.paymentScreenshot)) && <p className="muted">Nothing waiting.</p>}</section>
    </div>
  </>;
}

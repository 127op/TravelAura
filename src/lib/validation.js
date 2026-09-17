export function requiredText(value, label, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max) throw new Error(`${label} must contain 1–${max} characters.`);
  return text;
}

export function emailAddress(value) {
  const email = requiredText(value, 'Email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}

export function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function reviewData(input, booking, user) {
  if (!booking || booking.userId !== user.id || booking.bookingStatus !== 'completed') {
    throw new Error('You can review only your own completed trip.');
  }
  if (input.packageId !== booking.packageId) throw new Error('This review does not match the booked package.');
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5.');
  return { userId: user.id, userName: user.name, bookingId: booking.id, packageId: booking.packageId,
    rating, title: requiredText(input.title, 'Review title', 200), comment: requiredText(input.comment, 'Review', 5000),
    status: 'pending', featured: false };
}

export function contactData(input) {
  const phone = String(input.phone || '').trim();
  if (phone && !/^[0-9+ ()-]{8,30}$/.test(phone)) throw new Error('Enter a valid phone number or leave it blank.');
  return { name: requiredText(input.name, 'Name', 150), email: emailAddress(input.email), phone,
    message: requiredText(input.message, 'Message', 5000) };
}

export function catalogData(item, kind) {
  const result = { ...item, name: requiredText(item.name, 'Name', 150), active: item.active !== false };
  const number = (key, minimum, integer = false, maximum = Infinity) => {
    const value = Number(item[key]);
    if (!Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      throw new Error(`Check ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}.`);
    }
    result[key] = value;
  };
  if (kind === 'destination') number('budget', 0);
  else {
    result.destinationId = requiredText(item.destinationId, 'Destination', 150);
    number('duration', 1, true, 365); number('pricePerAdult', 0); number('pricePerChild', 0);
    number('maxAdults', 1, true, 100); number('maxChildren', 0, true, 100); number('maxRooms', 1, true, 100);
    number('rating', 0, false, 5);
    if ((item.availableDates || []).some(date => !calendarDate(date))) throw new Error('Use valid available dates in YYYY-MM-DD format.');
    result.availableDates = [...new Set(item.availableDates || [])].sort();
  }
  return result;
}

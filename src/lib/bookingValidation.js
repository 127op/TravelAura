export function couponDiscount(coupon, subtotal, now = new Date()) {
  if (!coupon || !coupon.active) throw new Error('Coupon is invalid or inactive.');
  if (coupon.expiryDate && new Date(`${coupon.expiryDate}T23:59:59.999Z`) < now) {
    throw new Error('Coupon has expired.');
  }
  if (Number(coupon.minimumAmount || 0) > subtotal) {
    throw new Error(`Minimum booking amount is ₹${Number(coupon.minimumAmount).toLocaleString('en-IN')}.`);
  }
  if (Number(coupon.usageLimit) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) {
    throw new Error('Coupon usage limit reached.');
  }
  if (!['fixed', 'percentage'].includes(coupon.type) || !Number.isFinite(Number(coupon.value)) || Number(coupon.value) < 0) {
    throw new Error('Coupon has an invalid discount.');
  }
  return Math.min(subtotal, coupon.type === 'fixed' ? Number(coupon.value) : Math.round(subtotal * Number(coupon.value) / 100));
}

export function bookingData(input, pack, coupon, userId) {
  if (!pack || pack.active === false) throw new Error('This package is unavailable.');
  const adults = Number(input.adults), children = Number(input.children), rooms = Number(input.rooms);
  if (!Number.isInteger(adults) || adults < 1 || adults > pack.maxAdults ||
      !Number.isInteger(children) || children < 0 || children > pack.maxChildren ||
      !Number.isInteger(rooms) || rooms < 1 || rooms > pack.maxRooms) {
    throw new Error('Traveler or room count exceeds this package capacity.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.travelDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.returnDate) ||
      input.travelDate < new Date().toISOString().slice(0, 10) || input.returnDate <= input.travelDate) {
    throw new Error('Choose valid available travel and return dates.');
  }
  for (const field of ['customerName', 'email', 'phone']) {
    if (!input[field]?.trim()) throw new Error('Name, email and phone are required.');
  }
  const adultTotal = Number(pack.pricePerAdult) * adults, childTotal = Number(pack.pricePerChild) * children;
  const subtotal = adultTotal + childTotal;
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error('Invalid package pricing.');
  const discount = input.couponCode ? couponDiscount(coupon, subtotal) : 0;
  return {
    userId, packageId: pack.id, destinationId: pack.destinationId,
    packageName: pack.name, destination: pack.destination || '',
    customerName: input.customerName.trim(), email: input.email.trim(), phone: input.phone.trim(),
    country: input.country || '', travelDate: input.travelDate, returnDate: input.returnDate,
    adults, children, rooms, specialRequirements: input.specialRequirements || '',
    subtotal, couponCode: coupon?.code || '', discount, totalAmount: subtotal - discount,
    priceBreakdown: { adultTotal, childTotal, subtotal, discount, total: subtotal - discount },
    transactionId: '', paymentScreenshot: '', paymentStatus: 'pending', bookingStatus: 'pending',
  };
}

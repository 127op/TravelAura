import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
  serverTimestamp, runTransaction, Timestamp,
} from 'firebase/firestore';
import { auth, db as firestore, isDemo } from './firebase.js';
import { demoAuth, demoDb } from './demoService.js';
import { uploadFile } from './storageService.js';
import { bookingData, couponDiscount } from './bookingValidation.js';
import { calendarDate, catalogData, contactData, reviewData } from './validation.js';

const normalize = value => {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  return value;
};
const record = snapshot => snapshot.exists() ? { ...normalize(snapshot.data()), id: snapshot.id } : null;
const newest = rows => rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
const couponCode = code => String(code || '').trim().toUpperCase();
function couponData(item) {
  const code = couponCode(item.code);
  if (!/^[A-Z0-9_-]{1,40}$/.test(code)) throw new Error('Use letters, numbers, underscores or hyphens for coupon codes.');
  const value = Number(item.value), minimumAmount = Number(item.minimumAmount || 0), usageLimit = Number(item.usageLimit || 0);
  if (!['fixed', 'percentage'].includes(item.type) || !Number.isFinite(value) || value < 0 ||
      (item.type === 'percentage' && value > 100) || !Number.isFinite(minimumAmount) || minimumAmount < 0 ||
      !Number.isInteger(usageLimit) || usageLimit < 0 ||
      (item.expiryDate && !calendarDate(item.expiryDate))) throw new Error('Check the coupon value, minimum, expiry and usage limit.');
  return { ...item, id: code, code, value, minimumAmount, usageLimit, usedCount: Number(item.usedCount || 0) };
}

export function createFirestoreService(firebaseAuth, database, imageUpload = uploadFile) {
  const requireUser = () => {
    if (!firebaseAuth.currentUser) throw new Error('Please sign in to continue.');
    return firebaseAuth.currentUser.uid;
  };
  const list = async (name, constraints = []) => {
    const snapshot = await getDocs(query(collection(database, name), ...constraints));
    return snapshot.docs.map(record);
  };
  const get = async (name, id) => record(await getDoc(doc(database, name, id)));
  const save = async (name, item) => {
    const { id, ...values } = item;
    const ref = id ? doc(database, name, id) : doc(collection(database, name));
    await setDoc(ref, values, { merge: true });
    return { ...values, id: ref.id };
  };
  const update = async (name, id, patch) => { await updateDoc(doc(database, name, id), patch); return { ...patch, id }; };
  const remove = (name, id) => deleteDoc(doc(database, name, id));
  const service = {
    getDestinations: ({ admin = false } = {}) => list('destinations', admin ? [] : [where('active', '==', true)]),
    getPackages: ({ admin = false } = {}) => list('packages', admin ? [] : [where('active', '==', true)]),
    getReviews: ({ admin = false } = {}) => list('reviews', admin ? [] : [where('status', '==', 'approved')]),
    getMyReview: async bookingId => (await list('reviews', [where('userId', '==', requireUser())])).find(review => review.bookingId === bookingId) || null,
    getBookings: async ({ admin = false } = {}) => newest(await list('bookings', admin ? [] : [where('userId', '==', requireUser())])),
    getBooking: id => get('bookings', id),
    getUsers: () => list('users'),
    getContacts: () => list('contacts'),
    getCoupons: () => list('coupons'),
    validateCoupon: async (code, subtotal) => {
      const coupon = await get('coupons', couponCode(code));
      couponDiscount(coupon, subtotal);
      return coupon;
    },
    saveDestination: item => save('destinations', catalogData(item, 'destination')),
    deleteDestination: id => remove('destinations', id),
    savePackage: item => save('packages', catalogData(item, 'package')),
    deletePackage: id => remove('packages', id),
    async createBooking(input) {
      const uid = requireUser();
      const bookingRef = doc(collection(database, 'bookings'));
      return runTransaction(database, async transaction => {
        const pack = record(await transaction.get(doc(database, 'packages', input.packageId)));
        const code = couponCode(input.couponCode);
        const couponRef = code ? doc(database, 'coupons', code) : null;
        const coupon = couponRef ? record(await transaction.get(couponRef)) : null;
        const data = bookingData({ ...input, couponCode: code }, pack, coupon, uid);
        transaction.set(bookingRef, { ...data, createdAt: serverTimestamp() });
        if (couponRef) transaction.update(couponRef, { usedCount: Number(coupon.usedCount || 0) + 1, lastBookingId: bookingRef.id });
        return { ...data, id: bookingRef.id };
      });
    },
    updateBooking: (id, patch) => update('bookings', id, {
      ...patch,
      ...(patch.paymentSubmittedAt ? { paymentSubmittedAt: serverTimestamp() } : {}),
      ...(patch.cancellationRequestedAt ? { cancellationRequestedAt: serverTimestamp() } : {}),
    }),
    async submitPayment(id, transactionId = '', file = null) {
      const uid = requireUser();
      if (transactionId.trim() && !/^[A-Za-z0-9-]{8,30}$/.test(transactionId.trim())) throw new Error('Enter a valid 8-30 character transaction/UTR ID or leave it blank.');
      const booking = await get('bookings', id);
      if (!booking || booking.userId !== uid || !['pending', 'payment_failed'].includes(booking.bookingStatus)) throw new Error('This booking cannot accept payment proof.');
      const url = file ? await imageUpload(file, `payments/${uid}/${id}/payment-proof-${Date.now()}-${crypto.randomUUID()}`) : booking.paymentScreenshot || '';
      await service.updateBooking(id, { transactionId: transactionId.trim() || booking.transactionId || '', paymentScreenshot: url, paymentStatus: 'pending', bookingStatus: 'pending', paymentSubmittedAt: true });
      return url;
    },
    async saveReview(input) {
      const userId = requireUser();
      const profile = await get('users', userId);
      const booking = await get('bookings', input.bookingId);
      const data = reviewData(input, booking, profile);
      if (await service.getMyReview(input.bookingId)) throw new Error('You have already submitted a review for this booking.');
      try {
        return await save('reviews', { ...data, id: input.bookingId, createdAt: serverTimestamp() });
      } catch (error) {
        if (error.code === 'permission-denied' && await service.getMyReview(input.bookingId)) throw new Error('You have already submitted a review for this booking.');
        throw error;
      }
    },
    updateReview: (id, patch) => update('reviews', id, patch),
    deleteReview: id => remove('reviews', id),
    async saveCoupon(item) {
      const data = couponData(item);
      if (item.id && item.id !== data.id) throw new Error('Create a new coupon to change its code.');
      return save('coupons', { ...data, expiryDate: data.expiryDate || '', expiresAt: data.expiryDate ? Timestamp.fromDate(new Date(`${data.expiryDate}T23:59:59.999Z`)) : null });
    },
    deleteCoupon: id => remove('coupons', id),
    updateUser: (id, patch) => update('users', id, patch),
    saveContact: input => save('contacts', { ...contactData(input), createdAt: serverTimestamp() }),
    uploadFile: imageUpload,
  };
  return service;
}

const localService = {
  ...demoDb,
  getDestinations: ({ admin = false } = {}) => demoDb.getDestinations().filter(x => admin || x.active !== false),
  getPackages: ({ admin = false } = {}) => demoDb.getPackages().filter(x => admin || x.active !== false),
  getReviews: ({ admin = false } = {}) => demoDb.getReviews().filter(x => admin || x.status === 'approved'),
  getMyReview: bookingId => demoDb.getReviews().find(x => x.bookingId === bookingId && x.userId === demoAuth.getUser()?.id) || null,
  getBookings: ({ admin = false } = {}) => newest(demoDb.getBookings().filter(x => admin || x.userId === demoAuth.getUser()?.id)),
  getBooking: id => demoDb.getBookings().find(x => x.id === id && (x.userId === demoAuth.getUser()?.id || demoAuth.getUser()?.role === 'admin')),
  validateCoupon(code, subtotal) {
    const coupon = demoDb.getCoupons().find(x => couponCode(x.code) === couponCode(code));
    couponDiscount(coupon, subtotal);
    return coupon;
  },
  createBooking(input) {
    const user = demoAuth.getUser();
    if (!user) throw new Error('Please sign in to continue.');
    const pack = demoDb.getPackages().find(x => x.id === input.packageId);
    const coupon = input.couponCode ? demoDb.getCoupons().find(x => couponCode(x.code) === couponCode(input.couponCode)) : null;
    const booking = demoDb.createBooking(bookingData(input, pack, coupon, user.id));
    if (coupon) demoDb.saveCoupon({ ...coupon, usedCount: Number(coupon.usedCount || 0) + 1 });
    return booking;
  },
  async submitPayment(id, transactionId = '', file = null) {
    const booking = localService.getBooking(id);
    if (!booking || booking.userId !== demoAuth.getUser()?.id || !['pending', 'payment_failed'].includes(booking.bookingStatus)) throw new Error('This booking cannot accept payment proof.');
    if (transactionId.trim() && !/^[A-Za-z0-9-]{8,30}$/.test(transactionId.trim())) throw new Error('Enter a valid transaction/UTR ID or leave it blank.');
    const url = file ? await uploadFile(file) : booking.paymentScreenshot || '';
    demoDb.updateBooking(id, { transactionId: transactionId.trim() || booking.transactionId || '', paymentScreenshot: url, paymentStatus: 'pending', bookingStatus: 'pending', paymentSubmittedAt: new Date().toISOString() });
    return url;
  },
  saveCoupon: item => demoDb.saveCoupon(couponData(item)),
  saveDestination: item => demoDb.saveDestination(catalogData(item, 'destination')),
  savePackage: item => demoDb.savePackage(catalogData(item, 'package')),
  saveContact: input => demoDb.saveContact(contactData(input)),
  saveReview(input) {
    const user = demoAuth.getUser();
    if (!user) throw new Error('Please sign in to continue.');
    const booking = localService.getBooking(input.bookingId);
    const data = reviewData(input, booking, user);
    if (localService.getMyReview(input.bookingId)) throw new Error('You have already submitted a review for this booking.');
    return demoDb.saveReview({ ...data, id: input.bookingId });
  },
  uploadFile,
};
export const db = isDemo ? localService : createFirestoreService(auth, firestore);

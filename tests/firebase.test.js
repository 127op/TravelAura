import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { createFirestoreService } from '../src/lib/dataService.js';
import { createStorageService } from '../src/lib/storageService.js';

let env, user, other, admin, guest, service, adminService, booking;
const projectId = 'demo-travelaura';
const pack = { id: 'tour', name: 'Emulator tour', destinationId: 'place', destination: 'Test place', active: true, pricePerAdult: 1000, pricePerChild: 500, maxAdults: 8, maxChildren: 4, maxRooms: 4, availableDates: ['2099-10-10'] };
const input = { packageId: 'tour', customerName: 'Alice', email: 'alice@example.test', phone: '9999999999', travelDate: '2099-10-10', returnDate: '2099-10-15', adults: 2, children: 1, rooms: 1, couponCode: '' };
before(async () => {
  env = await initializeTestEnvironment({ projectId,
    firestore: { host: '127.0.0.1', port: 8080, rules: await readFile('firestore.rules', 'utf8') },
    storage: { host: '127.0.0.1', port: 9199, rules: await readFile('storage.rules', 'utf8') },
  });
  await env.clearFirestore();
  user = env.authenticatedContext('alice', { email: input.email });
  other = env.authenticatedContext('bob', { email: 'bob@example.test' });
  admin = env.authenticatedContext('admin', { email: 'admin@example.test' });
  guest = env.unauthenticatedContext();
  await env.withSecurityRulesDisabled(async ctx => {
    for (const uid of ['alice', 'bob', 'admin']) await setDoc(doc(ctx.firestore(), 'users', uid), { uid, name: uid === 'alice' ? 'Alice' : uid, email: `${uid}@example.test`, phone: '', role: uid === 'admin' ? 'admin' : 'user', active: true, createdAt: serverTimestamp() });
    await setDoc(doc(ctx.firestore(), 'packages', 'tour'), pack);
    await setDoc(doc(ctx.firestore(), 'packages', 'hidden'), { ...pack, active: false });
    await setDoc(doc(ctx.firestore(), 'destinations', 'place'), { name: 'Test place', active: true });
  });
  service = createFirestoreService({ currentUser: { uid: 'alice' } }, user.firestore(), createStorageService(user.storage()));
  adminService = createFirestoreService({ currentUser: { uid: 'admin' } }, admin.firestore());
});
after(async () => { await env?.cleanup(); });

test('public reads active catalog, never profiles, bookings or hidden packages', async () => {
  const publicService = createFirestoreService({ currentUser: null }, guest.firestore());
  assert.equal((await publicService.getPackages()).length, 1);
  assert.equal((await publicService.getDestinations()).length, 1);
  await assertFails(getDoc(doc(guest.firestore(), 'packages', 'hidden')));
  await assertFails(getDocs(collection(guest.firestore(), 'users')));
  await assertFails(getDocs(collection(guest.firestore(), 'bookings')));
  await assertFails(getDocs(collection(user.firestore(), 'packages')));
  assert.equal((await adminService.getPackages({ admin: true })).length, 2);
});

test('profiles cannot self-promote, reactivate, change email or impersonate another user', async () => {
  await assertSucceeds(updateDoc(doc(user.firestore(), 'users', 'alice'), { phone: '1234567890' }));
  for (const patch of [{ role: 'admin' }, { active: false }, { email: 'stolen@example.test' }, { uid: 'bob' }]) await assertFails(updateDoc(doc(user.firestore(), 'users', 'alice'), patch));
  await assertFails(getDoc(doc(user.firestore(), 'users', 'bob')));
  const newcomer = env.authenticatedContext('new', { email: 'new@example.test' }).firestore();
  const profile = { uid: 'new', name: 'New', email: 'new@example.test', phone: '', role: 'user', active: true, createdAt: serverTimestamp() };
  await assertFails(setDoc(doc(newcomer, 'users', 'new'), { ...profile, role: 'admin' }));
  await assertSucceeds(setDoc(doc(newcomer, 'users', 'new'), profile));
});

test('booking service derives prices and ownership; rules reject forged amounts and approval', async () => {
  booking = await service.createBooking({ ...input, userId: 'bob', totalAmount: 1 });
  assert.equal(booking.userId, 'alice'); assert.equal(booking.totalAmount, 2500);
  assert.equal((await service.getBookings()).length, 1);
  assert.equal((await createFirestoreService({ currentUser: { uid: 'bob' } }, other.firestore()).getBookings()).length, 0);
  await assertFails(getDoc(doc(other.firestore(), 'bookings', booking.id)));
  await assertFails(getDoc(doc(guest.firestore(), 'bookings', booking.id)));
  await assertFails(getDocs(collection(user.firestore(), 'bookings')));
  for (const patch of [{ paymentStatus: 'paid' }, { bookingStatus: 'confirmed' }, { userId: 'bob' }, { totalAmount: 1 }]) await assertFails(updateDoc(doc(user.firestore(), 'bookings', booking.id), patch));
  const { id, ...data } = booking;
  await assertFails(setDoc(doc(user.firestore(), 'bookings', 'forged'), { ...data, totalAmount: 1, createdAt: serverTimestamp() }));
});

test('coupons validate expiry/minimum and consume usage atomically without granting editing rights', async () => {
  await adminService.saveCoupon({ code: 'SAVE10', type: 'percentage', value: 10, minimumAmount: 1000, expiryDate: '2099-12-31', usageLimit: 1, active: true });
  const coupon = await service.validateCoupon('save10', 2500); assert.equal(coupon.value, 10);
  await assert.rejects(service.validateCoupon('SAVE10', 100), /Minimum/);
  await assertFails(updateDoc(doc(user.firestore(), 'coupons', 'SAVE10'), { value: 99 }));
  await assertFails(updateDoc(doc(user.firestore(), 'coupons', 'SAVE10'), { usedCount: 1, lastBookingId: booking.id }));
  const results = await Promise.allSettled([service.createBooking({ ...input, couponCode: 'SAVE10' }), service.createBooking({ ...input, couponCode: 'SAVE10' })]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  const discounted = results.find(x => x.status === 'fulfilled').value;
  assert.equal(discounted.totalAmount, 2250);
  assert.equal((await getDoc(doc(user.firestore(), 'coupons', 'SAVE10'))).data().usedCount, 1);
  await assert.rejects(service.validateCoupon('SAVE10', 2500), /usage limit/);
  await adminService.saveCoupon({ code: 'FLAT', type: 'fixed', value: 500, minimumAmount: 0, expiryDate: '', usageLimit: 0, active: true });
  assert.equal((await service.createBooking({ ...input, couponCode: 'FLAT' })).totalAmount, 2000);
  await adminService.saveCoupon({ code: 'OLD', type: 'fixed', value: 500, minimumAmount: 0, expiryDate: '2000-01-01', usageLimit: 0, active: true });
  await assert.rejects(service.createBooking({ ...input, couponCode: 'OLD' }), /expired/);
});

test('optional payment details, upload privacy, file limits and manual approval', async () => {
  const noUploadService = createFirestoreService({ currentUser: { uid: 'alice' } }, user.firestore(), () => {
    throw new Error('An empty screenshot must not trigger an upload.');
  });
  await noUploadService.submitPayment(booking.id);
  const confirmation = await service.getBooking(booking.id);
  assert.equal(confirmation.transactionId, '');
  assert.equal(confirmation.paymentScreenshot, '');
  assert.equal(confirmation.paymentStatus, 'pending');
  assert.equal(confirmation.bookingStatus, 'pending');
  assert.ok(confirmation.paymentSubmittedAt);
  await assertFails(updateDoc(doc(user.firestore(), 'bookings', booking.id), { paymentStatus: 'paid' }));
  await assert.rejects(service.submitPayment(booking.id, 'bad'), /valid/);
  await noUploadService.submitPayment(booking.id, '123456789012');
  assert.equal((await service.getBooking(booking.id)).transactionId, '123456789012');
  const file = new File([new Uint8Array([137, 80, 78, 71])], 'proof.png', { type: 'image/png' });
  const imageOnlyBooking = await service.createBooking(input);
  await service.submitPayment(imageOnlyBooking.id, '', file);
  assert.equal((await service.getBooking(imageOnlyBooking.id)).transactionId, '');
  const url = await service.submitPayment(booking.id, '123456789012', file);
  assert.match(url, /payments/);
  const saved = await service.getBooking(booking.id);
  assert.equal(saved.paymentScreenshot, url); assert.equal(saved.paymentStatus, 'pending');
  const objectPath = decodeURIComponent(new URL(url).pathname.split('/o/')[1]);
  await assertSucceeds(getBytes(ref(user.storage(), objectPath)));
  await assertSucceeds(getBytes(ref(admin.storage(), objectPath)));
  await assertFails(getBytes(ref(other.storage(), objectPath)));
  await assertFails(getBytes(ref(guest.storage(), objectPath)));
  await assertFails(uploadBytes(ref(other.storage(), `payments/alice/${booking.id}/intruder`), file));
  await assertFails(uploadBytes(ref(user.storage(), `payments/alice/${booking.id}/text`), new Uint8Array([1]), { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(user.storage(), `payments/alice/${booking.id}/large`), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/png' }));
  await assertFails(uploadBytes(ref(user.storage(), 'packages/nope'), file));
  await assertSucceeds(uploadBytes(ref(admin.storage(), 'packages/admin-image'), file));
  await assertSucceeds(deleteObject(ref(admin.storage(), 'packages/admin-image')));
  await adminService.updateBooking(booking.id, { paymentStatus: 'paid', bookingStatus: 'confirmed' });
  await assert.rejects(service.submitPayment(booking.id, '123456789012', file), /cannot accept/);
  await assertFails(uploadBytes(ref(user.storage(), `payments/alice/${booking.id}/after-approval`), file));
});

test('only completed booking owners can review; public sees approved reviews only', async () => {
  const review = { bookingId: booking.id, packageId: 'tour', rating: 5, title: 'Good', comment: 'Great trip' };
  await assert.rejects(service.saveReview(review));
  await adminService.updateBooking(booking.id, { bookingStatus: 'completed' });
  await service.saveReview({ ...review, status: 'approved', userId: 'bob' });
  const publicService = createFirestoreService({ currentUser: null }, guest.firestore());
  assert.equal((await publicService.getReviews()).length, 0);
  await assertFails(updateDoc(doc(user.firestore(), 'reviews', booking.id), { status: 'approved' }));
  await adminService.updateReview(booking.id, { status: 'approved' });
  assert.equal((await publicService.getReviews()).length, 1);
  await adminService.updateReview(booking.id, { status: 'rejected' });
  assert.equal((await publicService.getReviews()).length, 0);
});

test('cancellation preserves protected fields; inactive users lose access', async () => {
  const b = await service.createBooking(input);
  await service.updateBooking(b.id, { bookingStatus: 'cancellation_requested', cancellationRequestedAt: true });
  await assertFails(updateDoc(doc(user.firestore(), 'bookings', b.id), { bookingStatus: 'cancelled' }));
  await adminService.updateUser('alice', { active: false });
  await assertFails(getDoc(doc(user.firestore(), 'bookings', b.id)));
  await assertFails(updateDoc(doc(user.firestore(), 'users', 'alice'), { active: true }));
  await adminService.updateUser('alice', { active: true });
});

test('contacts allow valid guest submissions but protect messages from public reads', async () => {
  const publicService = createFirestoreService({ currentUser: null }, guest.firestore());
  const contact = await publicService.saveContact({ name: 'Guest', email: 'guest@example.test', phone: '', message: 'Trip question' });
  await assertFails(getDoc(doc(guest.firestore(), 'contacts', contact.id)));
  assert.equal((await adminService.getContacts()).length, 1);
  await assertFails(setDoc(doc(guest.firestore(), 'contacts', 'bad'), { name: '' }));
});

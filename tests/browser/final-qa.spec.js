import { test, expect } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { destinations, packages, seedCoupons } from '../../src/data/demo.js';

let env;
const password = 'QaPassword123!';
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=', 'base64');
const travelDate = '2099-10-10';
const tour = { ...packages.find(p => p.id === 'manali-adventure'), availableDates: [travelDate] };

test.beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-travelaura', firestore: { host: '127.0.0.1', port: 8080 } });
});
test.afterAll(async () => { await env?.cleanup(); });
test.beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    for (const destination of destinations) await setDoc(doc(context.firestore(), 'destinations', destination.id), { ...destination, active: true });
    for (const pack of packages) await setDoc(doc(context.firestore(), 'packages', pack.id), pack.id === tour.id ? tour : pack);
    for (const coupon of seedCoupons) await setDoc(doc(context.firestore(), 'coupons', coupon.code), {
      ...coupon, usedCount: 0, expiresAt: coupon.expiryDate ? Timestamp.fromDate(new Date(`${coupon.expiryDate}T23:59:59.999Z`)) : null,
    });
  });
});

async function prepare(page, { noStorage = false } = {}) {
  await page.route('https://images.unsplash.com/**', route => route.fulfill({ contentType: 'image/png', body: image }));
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/src/lib/firebase.js*', async route => {
    const response = await page.request.get('http://127.0.0.1:54173/tests/fixtures/firebase.js');
    let body = await response.text();
    if (noStorage) body = body.replace('storage = getStorage(app)', 'storage = null').replace("connectStorageEmulator(storage, '127.0.0.1', 9199);", '');
    await route.fulfill({ contentType: 'text/javascript', body });
  });
}
async function createAccount(role = 'user') {
  const email = `qa-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const account = await response.json();
  expect(response.ok).toBeTruthy();
  const user = { uid: account.localId, name: `QA ${role}`, email, phone: '9876543210', role, active: true, createdAt: Timestamp.now() };
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'users', user.uid), user));
  return user;
}
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
async function records(name) {
  let rows;
  await env.withSecurityRulesDisabled(async context => { rows = (await getDocs(collection(context.firestore(), name))).docs.map(d => ({ ...d.data(), id: d.id })); });
  return rows;
}
async function doubleSubmit(page, selector) {
  await page.locator(selector).evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
}

// End-to-end assessment regression: all financial actions are simulated against local emulators.
test('new customer, booking, payment rejection/resubmission, admin approval and review moderation', async ({ page, browser }) => {
  test.setTimeout(120000);
  await prepare(page);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/booking/manali-adventure');
  await expect(page).toHaveURL(/login$/);
  await expect(page.getByRole('button', { name: /Google/ })).toHaveCount(0);
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create account' }).click();
  expect(await page.locator('.auth-card').evaluate(form => form.checkValidity())).toBe(false);
  await page.getByLabel('Name', { exact: true }).fill('Final QA Traveler');
  const email = `qa-traveler-${Date.now()}@example.test`;
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Phone', { exact: true }).fill('9876543210');
  await page.getByLabel('Password', { exact: true }).fill('123');
  await page.getByLabel('Confirm password', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.form-error')).toContainText('at least 6');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.form-error')).toContainText('do not match');
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await doubleSubmit(page, '.auth-card');
  await expect(page).toHaveURL(/packages$/);
  const userId = await page.evaluate(async () => (await import('/src/lib/firebase.js')).auth.currentUser.uid);
  expect((await records('users')).find(u => u.id === userId).role).toBe('user');
  await page.goto('/admin'); await expect(page).toHaveURL(/my-bookings$/);
  await page.reload(); await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
  await expect(page.getByText('No bookings yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/login$/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.auth-card .form-error')).toContainText('Email or password is incorrect');
  await page.goto('/register');
  await page.getByLabel('Name', { exact: true }).fill('Duplicate');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Phone', { exact: true }).fill('9876543210');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('.auth-card .form-error')).toContainText('already exists');

  await page.goto('/');
  await page.locator('[name=destination]').fill('Manali');
  await page.locator('[name=date]').fill(travelDate);
  await page.locator('[name=adults]').selectOption('3');
  await page.locator('[name=children]').selectOption('1');
  await page.locator('[name=rooms]').selectOption('2');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('link', { name: tour.name, exact: true }).click();
  await expect(page).toHaveURL(/date=2099-10-10/);
  await page.getByRole('link', { name: 'Book this package' }).click();
  await expect(page).toHaveURL(/login$/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/booking\/manali-adventure\?/);
  await expect(page.getByLabel('Travel date', { exact: true })).toHaveValue(travelDate);
  await expect(page.getByRole('combobox', { name: 'Adults', exact: true })).toHaveValue('3');
  await expect(page.getByRole('combobox', { name: 'Children', exact: true })).toHaveValue('1');
  await expect(page.getByRole('combobox', { name: 'Rooms', exact: true })).toHaveValue('2');
  await page.getByLabel('Travel date', { exact: true }).fill('2000-01-01');
  expect(await page.locator('[name=travelDate]').evaluate(e => e.validity.rangeUnderflow)).toBe(true);
  await page.getByLabel('Travel date', { exact: true }).fill('2099-10-11');
  await page.getByLabel('Return date', { exact: true }).fill('2099-10-15');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.locator('.form-error')).toContainText('not available');
  await page.getByLabel('Travel date', { exact: true }).fill(travelDate);
  await page.getByLabel('Return date', { exact: true }).fill(travelDate);
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.locator('.form-error')).toContainText('after travel date');
  await page.getByLabel('Return date', { exact: true }).fill('2099-10-15');
  await page.getByPlaceholder('Coupon code').fill('WELCOME10');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Coupon WELCOME10 applied.')).toBeVisible();
  await doubleSubmit(page, 'form.form-card');
  await expect(page).toHaveURL(/payment\//);
  const bookingId = page.url().split('/').at(-1);
  const ownBookings = (await records('bookings')).filter(b => b.userId === userId);
  expect(ownBookings).toHaveLength(1);
  const subtotal = tour.pricePerAdult * 3 + tour.pricePerChild;
  expect(ownBookings[0]).toMatchObject({ adults: 3, children: 1, rooms: 2, travelDate, subtotal, totalAmount: subtotal - Math.round(subtotal * 0.1) });
  await expect(page.getByText(/do not send real money/)).toBeVisible();
  expect(await page.locator('.qr-image').evaluate(e => e.complete && e.naturalWidth > 0)).toBe(true);
  await doubleSubmit(page, '.payment-card form');
  await expect(page.getByRole('heading', { name: 'Verification pending' })).toBeVisible();
  await page.getByRole('button', { name: 'View my bookings' }).click();
  await page.reload();
  await page.getByRole('link', { name: 'View details', exact: true }).click();
  await expect(page.getByText(/Payment confirmation submitted:/)).toBeVisible();
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.getByRole('button', { name: 'Print payment receipt' }).click();
  expect(await page.evaluate(() => window.__printed)).toBe(true);

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage(); await prepare(otherPage);
  const other = await createAccount(); await login(otherPage, other.email);
  await expect(otherPage.getByText('No bookings yet', { exact: true })).toBeVisible();
  await otherPage.goto(`/booking-details/${bookingId}`);
  await expect(otherPage.getByRole('heading', { name: tour.name, exact: true })).toHaveCount(0);
  await expect(otherPage.getByRole('alert')).toContainText('permission');
  const denied = await otherPage.evaluate(async () => { try { await (await import('/src/lib/dataService.js')).db.deletePackage('manali-adventure'); return false; } catch (e) { return e.code === 'permission-denied'; } });
  expect(denied).toBe(true); await otherContext.close();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage(); await prepare(adminPage);
  const admin = await createAccount('admin'); await login(adminPage, admin.email);
  await expect(adminPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await adminPage.goto('/admin/bookings');
  await adminPage.getByRole('button', { name: 'View', exact: true }).click();
  await expect(adminPage.locator('.modal-card')).toContainText(bookingId);
  await adminPage.locator('.modal-close').click();
  await adminPage.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(adminPage.locator('.status-rejected')).toHaveText('rejected');
  await page.goto('/my-bookings');
  await expect(page.locator('.status-payment_failed')).toContainText('payment_failed');
  await page.getByRole('link', { name: 'Resubmit payment' }).click();
  await page.getByRole('button', { name: 'Submit payment confirmation' }).click();
  await expect(page.getByRole('heading', { name: 'Verification pending' })).toBeVisible();
  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Approve payment' }).click();
  await expect(adminPage.locator('.status-paid')).toHaveText('paid');
  await page.goto('/my-bookings'); await expect(page.locator('.status-confirmed')).toContainText('confirmed');
  await adminPage.getByRole('button', { name: 'Mark completed' }).click();
  await expect(adminPage.locator('.status-completed')).toHaveText('completed');
  await adminPage.goto('/admin');
  await expect(adminPage.locator('.stat').filter({ hasText: 'Revenue' })).toContainText(ownBookings[0].totalAmount.toLocaleString('en-IN'));

  await page.goto(`/booking-details/${bookingId}`);
  await expect(page.getByRole('heading', { name: 'Review your trip' })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill(' ');
  await page.getByLabel('Comment', { exact: true }).fill(' ');
  await page.getByRole('button', { name: 'Submit review' }).click();
  await expect(page.getByRole('alert')).toContainText('Review title');
  await page.getByRole('combobox', { name: 'Rating', exact: true }).selectOption('4');
  await page.getByLabel('Title', { exact: true }).fill('Final QA trip review');
  await page.getByLabel('Comment', { exact: true }).fill('A complete booking and review regression.');
  await doubleSubmit(page, '.review-form');
  await expect(page.getByRole('region', { name: 'Your review' })).toContainText('Final QA Traveler');
  await expect(page.getByRole('button', { name: 'Submit review' })).toHaveCount(0);
  expect(await records('reviews')).toHaveLength(1);
  await page.reload(); await expect(page.getByRole('region', { name: 'Your review' })).toContainText('pending');
  await page.goto(`/packages/${tour.id}`); await expect(page.getByText('Final QA trip review', { exact: true })).toHaveCount(0);
  await adminPage.goto('/admin/reviews');
  await adminPage.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(adminPage.locator('.status-approved')).toHaveText('approved');
  await adminPage.getByRole('button', { name: 'Feature', exact: true }).click();
  await expect(adminPage.getByRole('button', { name: 'Unfeature', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('Final QA trip review', { exact: true })).toBeVisible();
  await expect(page.locator('.review-card')).toContainText('Final QA Traveler');
  await adminPage.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(adminPage.locator('.status-rejected')).toHaveText('rejected');
  await page.reload(); await expect(page.getByText('Final QA trip review', { exact: true })).toHaveCount(0);
  await adminPage.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(adminPage.locator('.status-approved')).toBeVisible();
  adminPage.on('dialog', dialog => dialog.accept());
  await adminPage.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(adminPage.locator('.admin-row')).toHaveCount(0);
  await page.goto('/my-bookings'); await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/login$/);
  await adminContext.close();
  expect(errors).toEqual([]);
});

test('admin catalog/coupon/user CRUD, uploaded-image editing, cancellation and newsletter requests', async ({ page, browser }) => {
  test.setTimeout(120000); await prepare(page, { noStorage: true });
  const admin = await createAccount('admin'); await login(page, admin.email);
  await page.goto('/admin/destinations');
  await page.getByRole('button', { name: '+ Add destination', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect(await page.locator('.admin-editor').evaluate(e => e.checkValidity())).toBe(false);
  await page.getByLabel('Name', { exact: true }).fill('QA destination');
  await page.getByLabel('Budget', { exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('budget');
  await page.getByLabel('Budget', { exact: true }).fill('12000');
  await page.locator('[name=imageFile]').setInputFiles({ name: 'destination.png', mimeType: 'image/png', buffer: image });
  await doubleSubmit(page, '.admin-editor');
  await expect(page.locator('.admin-editor')).toHaveCount(0);
  expect((await records('destinations')).filter(d => d.name === 'QA destination')).toHaveLength(1);
  await page.locator('.admin-row').filter({ hasText: 'QA destination' }).getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name', { exact: true }).fill('QA edited destination');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.admin-editor')).toHaveCount(0);
  await page.goto('/destinations'); await expect(page.getByRole('heading', { name: 'QA edited destination' })).toBeVisible();
  await page.goto('/admin/packages');
  await page.getByRole('button', { name: '+ Add package', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('QA package');
  await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption({ label: 'QA edited destination' });
  await page.getByLabel('Adult price', { exact: true }).fill('-50');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('price per adult');
  await page.getByLabel('Adult price', { exact: true }).fill('12000');
  await page.getByLabel('Available dates (YYYY-MM-DD, comma separated)', { exact: true }).fill('2099-02-30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('valid available dates');
  await page.getByLabel('Available dates (YYYY-MM-DD, comma separated)', { exact: true }).fill(travelDate);
  await page.getByLabel('Itinerary (one day title per line)', { exact: true }).fill('Arrival\nSightseeing');
  await page.locator('[name=imageFile]').setInputFiles({ name: 'package.png', mimeType: 'image/png', buffer: image });
  await doubleSubmit(page, '.admin-editor'); await expect(page.locator('.admin-editor')).toHaveCount(0);
  const saved = (await records('packages')).filter(p => p.name === 'QA package'); expect(saved).toHaveLength(1);
  expect(saved[0].images[0]).toMatch(/^data:image\/jpeg;base64,/);
  await page.locator('.admin-row').filter({ hasText: 'QA package' }).getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name', { exact: true }).fill('QA edited package');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.admin-editor')).toHaveCount(0);
  expect((await records('packages')).find(p => p.id === saved[0].id).images).toEqual(saved[0].images);
  await page.goto(`/packages/${saved[0].id}`);
  expect(await page.locator('.detail-image').evaluate(e => e.complete && e.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.timeline article')).toHaveCount(2);
  await page.goto('/packages?destination=QA&date=2099-10-11'); await expect(page.getByText('No matching packages')).toBeVisible();
  await page.goto('/packages?destination=QA&date=2099-10-10'); await expect(page.getByRole('heading', { name: 'QA edited package' })).toBeVisible();

  await page.goto('/admin/coupons'); await page.getByRole('button', { name: '+ Add coupon', exact: true }).click();
  await page.getByLabel('Code', { exact: true }).fill('QA20');
  await page.getByLabel('Value', { exact: true }).fill('20');
  await doubleSubmit(page, '.admin-editor'); await expect(page.locator('.admin-editor')).toHaveCount(0);
  await page.locator('.admin-row').filter({ hasText: 'QA20' }).getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Value', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.admin-editor')).toHaveCount(0);
  expect((await records('coupons')).find(c => c.code === 'QA20').value).toBe(25);
  page.on('dialog', dialog => dialog.accept());
  await page.locator('.admin-row').filter({ hasText: 'QA20' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.admin-row').filter({ hasText: 'QA20' })).toHaveCount(0);

  const customer = await createAccount();
  await page.goto('/admin/users');
  const userRow = page.locator('.admin-row').filter({ hasText: customer.email });
  await userRow.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('QA edited user');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.admin-editor')).toHaveCount(0);
  await expect(userRow).toContainText('QA edited user');
  await userRow.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(userRow).toContainText('Inactive');
  await userRow.getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(userRow.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible();
  await expect(page.locator('.admin-row').filter({ hasText: admin.email }).getByRole('button', { name: 'Deactivate' })).toBeDisabled();

  const context = await browser.newContext(); const userPage = await context.newPage(); await prepare(userPage); await login(userPage, customer.email);
  const booking = await userPage.evaluate(async data => (await import('/src/lib/dataService.js')).db.createBooking(data), {
    packageId: tour.id, customerName: customer.name, email: customer.email, phone: customer.phone, travelDate, returnDate: '2099-10-15', adults: 1, children: 0, rooms: 1,
  });
  await userPage.reload();
  userPage.on('dialog', dialog => dialog.accept());
  await userPage.getByRole('button', { name: 'Request cancellation' }).click();
  await expect(userPage.locator('.status-cancellation_requested')).toBeVisible();
  await page.goto('/admin/bookings'); await page.getByRole('button', { name: 'Approve cancel' }).click();
  await expect(page.locator('.status-cancelled')).toBeVisible();
  await userPage.reload(); await expect(userPage.locator('.status-cancelled')).toBeVisible();
  expect((await records('bookings')).find(b => b.id === booking.id).bookingStatus).toBe('cancelled');
  await userPage.goto('/contact');
  await userPage.getByLabel('Name', { exact: true }).fill('Contact QA');
  await userPage.getByLabel('Email', { exact: true }).fill(customer.email);
  await userPage.getByLabel('Message', { exact: true }).fill('A final QA contact message.');
  await doubleSubmit(userPage, '.contact-form');
  await expect(userPage.getByText('Thanks! Your message has been saved.')).toBeVisible();
  expect(await records('contacts')).toHaveLength(1);
  await userPage.getByPlaceholder('Your email').fill(customer.email);
  await doubleSubmit(userPage, '.subscribe');
  await expect(userPage.getByRole('status')).toContainText('Your request has been saved.');
  expect(await records('contacts')).toHaveLength(2);
  await context.close();

  await page.goto('/admin/packages');
  await page.locator('.admin-row').filter({ hasText: 'QA edited package' }).getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Active', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.admin-editor')).toHaveCount(0);
  await page.goto('/packages'); await expect(page.getByRole('heading', { name: 'QA edited package' })).toHaveCount(0);
  await page.goto('/admin/packages');
  await page.locator('.admin-row').filter({ hasText: 'QA edited package' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.admin-row').filter({ hasText: 'QA edited package' })).toHaveCount(0);
  await page.goto('/admin/destinations');
  await page.locator('.admin-row').filter({ hasText: 'QA edited destination' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.admin-row').filter({ hasText: 'QA edited destination' })).toHaveCount(0);
});

test('all main pages, admin editors/modals and navigation fit the nine required viewports', async ({ page }, testInfo) => {
  test.setTimeout(240000); await prepare(page);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const admin = await createAccount('admin'); await login(page, admin.email);
  const booking = await page.evaluate(async input => (await import('/src/lib/dataService.js')).db.createBooking(input), {
    packageId: tour.id, customerName: 'Long name '.repeat(15).trim(), email: admin.email, phone: admin.phone,
    travelDate, returnDate: '2099-10-15', adults: 2, children: 1, rooms: 2,
  });
  const routes = ['/', '/login', '/register', '/destinations', '/destinations/manali', '/packages', '/packages/manali-adventure',
    '/booking/manali-adventure', `/payment/${booking.id}`, '/my-bookings', `/booking-details/${booking.id}`,
    '/contact', '/about', '/faq', '/missing-page', '/admin', '/admin/destinations', '/admin/packages', '/admin/bookings', '/admin/users', '/admin/reviews', '/admin/coupons'];
  let checks = 0;
  async function checkLayout(label) {
    const issues = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const overflow = [...document.querySelectorAll('div,section,form,aside,p,h1,h2,h3,label,main,footer')].filter(el => {
        const style = getComputedStyle(el);
        return el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && style.display !== 'inline' && !el.matches('.admin-side, .filters, .user-pill span') && style.overflowX !== 'hidden';
      }).map(el => `${el.tagName}.${el.className}: ${el.scrollWidth} > ${el.clientWidth}`);
      if (document.documentElement.scrollWidth > vw + 1) overflow.unshift(`Page wider than ${vw}`);
      const search = document.querySelector('.searchbar'), note = document.querySelector('.hero-note');
      if (search && note && note.getBoundingClientRect().bottom > search.getBoundingClientRect().top) overflow.push('Hero note overlaps search');
      return overflow;
    });
    expect(issues, label).toEqual([]); checks++;
  }
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await page.locator('h1').first().waitFor();
      await expect(page.getByText('Restoring your session…')).toHaveCount(0);
      if (route === '/my-bookings') await expect(page.locator('.booking-row')).toHaveCount(1);
      if (route.startsWith('/booking-details/')) await expect(page.locator('.booking-detail-grid')).toBeVisible();
      await checkLayout(`${width}px ${route}`);
      if (['/admin/destinations', '/admin/packages', '/admin/coupons'].includes(route)) {
        await page.locator('.admin-title button').click();
        await checkLayout(`${width}px ${route} editor`);
      }
      if (route === '/admin/bookings') {
        await page.getByRole('button', { name: 'View', exact: true }).click();
        await checkLayout(`${width}px booking modal`);
        await page.locator('.modal-close').click();
      }
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin'); await page.getByRole('link', { name: 'Public site' }).click(); await expect(page).toHaveURL(/\/$/);
  for (const [name, path] of [['Destinations', '/destinations'], ['Packages', '/packages'], ['About', '/about'], ['Contact', '/contact'], ['Admin', '/admin']]) {
    await page.goto('/'); await page.locator('.header .nav').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
  await page.goto('/faq');
  for (const button of await page.locator('.faq-item button').all()) { await button.click(); }
  await page.locator('footer').getByRole('link', { name: 'My bookings', exact: true }).click(); await expect(page).toHaveURL(/my-bookings$/);
  await page.locator('.header .logo').click(); await expect(page).toHaveURL(/\/$/);
  const badLinks = await page.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href')).filter(href => !href || href === '#' || /^https?:\/\/(localhost|127\.0\.0\.1)/.test(href)));
  expect(badLinks).toEqual([]);
  await page.getByRole('button', { name: 'Use dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await checkLayout('375px dark home');
  await page.goto('/booking/manali-adventure'); await page.locator('form.form-card').waitFor(); await checkLayout('375px dark booking');
  await page.goto('/admin/packages'); await page.locator('.admin-title button').click(); await checkLayout('375px dark admin editor');
  await testInfo.attach('responsive-results', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ checks, widths: [320,375,390,430,768,1024,1280,1440,1920], errors })) });
  expect(errors).toEqual([]);
});

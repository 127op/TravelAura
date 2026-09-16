# TravelAura

TravelAura is a responsive Tour & Travel booking assessment built with React + Vite. It includes public destination/package discovery, booking, manual UPI QR payment confirmation, user booking management, an admin panel, Firebase Auth, Firestore and Storage persistence, and a complete demo/localStorage fallback.

## Core features

### Traveler side
- Premium responsive home page with search for destination, date, adults, children and rooms
- Destinations with category filtering and detail pages
- Tour packages with destination/price/duration/rating filters and working sorting
- Package details with itinerary, hotel, meals, transport, activities, inclusions/exclusions and approved reviews
- Booking form with date, adults, children, rooms, customer data and capacity validation
- Dynamic adult/child pricing and coupons
- Manual UPI QR payment screen (no Razorpay/Stripe/PayPal)
- Manual payment confirmation after the customer pays the displayed UPI amount
- My Bookings, booking detail view, payment/booking statuses and cancellation requests
- Review submission after a booking is marked `completed`
- Login, registration and optional Google sign-in when Firebase is configured
- About, Contact, FAQ and 404 pages

### Admin side
Routes are protected by the user's `role: "admin"`.

- `/admin` dashboard with counts, revenue and recent/pending bookings
- Destination CRUD including image URL or image upload
- Package CRUD including pricing, capacity, itinerary, inclusions/exclusions, available dates and image upload
- Booking search/filter/detail view
- Manual payment approval/rejection
- Booking confirmation, cancellation approval and completion
- User editing and activation/deactivation, with self-admin deactivation protection
- Review approval/rejection/feature/delete
- Coupon create/edit/delete with percentage/fixed discount, minimum amount, expiry, usage limit and active state

## Demo mode

If Firebase environment variables are absent, TravelAura automatically runs in local demo mode using `localStorage`.

Demo accounts:
- User: `user@travelaura.com` — any password
- Admin: `admin@travelaura.com` — any password

Demo coupons:
- `WELCOME10` — 10% off (minimum ₹5,000)
- `FLAT500` — ₹500 off (minimum ₹10,000)

Demo mode is for presentation only and is not production security.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, normally `http://localhost:5173`.

Production build:

```bash
npm run build
npm run preview
```

## Firebase setup

The Firebase SDK is already installed (`firebase@12.19.0`). Run `npm install` to restore dependencies; no second Firebase installation is needed. The existing configuration is reused at `src/lib/firebase.js` and exports the raw `auth`, `db`, `storage`, `isFirebaseConfigured` and `isDemo` values. Components use `src/lib/authService.js` and `src/lib/dataService.js`; they do not call Firestore directly. Image operations live in `src/lib/storageService.js`, booking validation in `src/lib/bookingValidation.js`, and the preserved localStorage adapter in `src/lib/demoService.js`.

1. Open [Firebase Console](https://console.firebase.google.com/) and **Create a project**.
2. Open **Project settings → General → Your apps → Web (`</>`)**. Register a web app.
3. Under the web app's **SDK setup and configuration → Config**, copy its six web config values. These are frontend identifiers, not a service account key.
4. Open **Authentication → Get started → Sign-in method → Email/Password**, enable **Email/Password**, and save. Email-link sign-in is not required. The existing Google button is optional: enable **Google** and select a support email if you want to use it.
5. Open **Firestore Database → Create database**. Use **Standard edition**, database ID **`(default)`**, choose a location and start in **Production mode**. The supplied Storage rules look up profiles in this default database.
6. Open **Storage → Get started**, create the default bucket, and choose a location. Firebase currently requires the **Blaze** plan for Cloud Storage. Copy the actual bucket name from Console; do not guess between `.firebasestorage.app` and `.appspot.com`. See [Firebase's Storage setup guide](https://firebase.google.com/docs/storage/web/start).
7. Copy the blank template: `cp .env.example .env`. `.env` and local variants are gitignored. No real or placeholder project credentials are supplied.
8. Fill all six values below, using the mapping table. No `measurementId` or private Admin SDK key is needed.
9. Deploy the supplied rules **before registration** (commands below), then restart Vite with `npm run dev`. Vite reads environment variables at startup/build time.
10. In **Authentication → Settings → Authorized domains**, add `localhost` if absent, your Netlify hostname, and any custom domain. This is especially necessary for the optional Google popup.
11. Register your first account in TravelAura's **Create account** page. Use the procedure below to promote it in Console.
12. In `/admin/destinations`, add a destination with **Active** checked. In `/admin/packages`, add a package linked to that destination with prices, capacity, available dates and **Active** checked. Uploaded images go to Storage. Public pages read these same Firestore collections. An empty Firebase project intentionally shows no demo trips or fabricated traveler stories.
13. In **Netlify → Site configuration / Project configuration → Environment variables**, add all six values for the appropriate build context. Use build command `npm run build` and publish directory `dist`. Trigger a new deployment after changing variables. `netlify.toml` already contains the SPA rewrite.

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

| `.env` key | Firebase web config property |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

### Deploy rules

From the project directory, run:

```bash
npx firebase login
npx firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,storage
```

Replace `YOUR_PROJECT_ID` with the real project ID from Console. `firebase.json` points at the canonical `firestore.rules` and `storage.rules`. The `.rules.example` files are matching compatibility copies; edit/deploy the canonical files.

If the CLI reports `EACCES` for `~/.config/configstore`, use a project-local config directory: prefix both the login and deploy commands with `XDG_CONFIG_HOME="$PWD/.firebase/cli"`. This directory is gitignored; do not commit its login credentials. The test script already uses this directory to avoid changing your global CLI configuration.

Alternatively, paste **all** of `firestore.rules` into **Firestore Database → Rules → Publish**, and **all** of `storage.rules` into **Storage → Rules → Publish**. Accept Firebase's prompt to enable the permission that lets Storage rules read Firestore profiles/bookings. [Firebase documents this cross-service permission](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_firestore).

### Make the first registered user an admin

1. Register through the app, not just Authentication Console, so the profile is created.
2. Open **Authentication → Users**, find your email, and copy its **User UID**.
3. Open **Firestore Database → Data → users → that exact UID**. Do not use your email address as the document ID.
4. Edit the **`role`** field (type **string**) from **`user`** to **`admin`**. Leave **`active`** as boolean **`true`** and save. Do not replace the document or remove its other fields.
5. The active session listens to this profile and gains the Admin link. Open `/admin`. If needed, reload or sign out and back in.

Only Console/privileged administration can bootstrap this role. Registration always creates `role: "user"`; even an email containing `admin` remains a normal user in Firebase mode. Cached demo profiles never authorize Firebase routes. Updating `active` to `false` removes app access; this does not disable/delete the Authentication record itself.

### Seed the original demo destinations and packages into Firestore

The original catalog is in `src/data/demo.js`: **8 destinations and 10 packages**. The localStorage demo adapter initializes from these same arrays. The seed command imports those arrays directly; there is no second dataset to maintain.

1. Keep your working Firebase values in `.env`. The script uses Vite's normal development-mode loading, including `.env.local` and shell overrides. If you use production-specific config, add `-- --mode production` to the command.
2. Use an account registered through TravelAura with Email/Password enabled. In Firebase Console → Firestore → `users` → your Authentication UID, ensure `role` is the string `admin` and `active` is boolean `true`. The deployed rules must allow this admin to read/write destinations/packages. The script does not promote users or change rules.
3. From the project directory, run:

   ```bash
   npm run seed:firebase
   ```

4. Check the project ID printed by the command. Enter your **Firebase admin account's email and password** when prompted. Password input is hidden and credentials are not written to disk or added to `.env`. This is your TravelAura admin account, not your Firebase Console/Google password.
5. For an empty catalog, expect `destinations: 8 created, 0 existing records skipped` and `packages: 10 created, 0 existing records skipped`. Refresh the website to load the listings.

Optional preview (authenticates and reads, with no Firestore writes):

```bash
npm run seed:firebase -- --dry-run
```

The command uses original document IDs such as `destinations/manali` and `packages/manali-adventure`. It reads all target documents before creating missing ones in a single transaction, so reruns and concurrent runs do not create duplicates or overwrite existing records. Admin edits and inactive records are skipped unchanged. If an existing record lacks `active: true`, review it in Admin before publishing it; seeding deliberately leaves it untouched. An intentionally deleted demo record will be recreated if you seed again.

All original fields are copied, including the `id` field, image URLs, location, descriptions, prices, ratings, itinerary, included/excluded items, capacities and available dates. Only a missing `active` field defaults to `true`, because the public Firestore queries require it. Original image URLs remain URLs; the script does not download or re-upload images. Original availability dates are preserved exactly; update dates through Admin when needed.

The script writes only `destinations` and `packages`. It leaves the app, demo/localStorage fallback, users and other collections unchanged and does not deploy anything. It imports the source catalog, not browser-specific edits stored in an individual browser's localStorage.

Seed implementation: `scripts/seed-firestore.js` and `scripts/lib/seedCatalog.js`. No extra dependencies or service-account keys are required. To verify full field preservation, public visibility, reruns, concurrent runs, dry-run behavior and admin access with the local Firestore emulator:

```bash
npm run test:seed
```

### Mode selection and recovery

All six nonempty environment values select Firebase Auth + Firestore + Storage. Missing/incomplete values select the original localStorage demo services; partial configuration displays a notice. Browser-local demo records are kept separately and are never automatically uploaded to Firebase. Firebase failures are shown to the user and do not silently write a supposedly real booking into localStorage.

To demonstrate offline or recover from a bad Firebase setup, clear the six values in `.env` (also check shell/Netlify values and `.env.local` overrides), then restart Vite or rebuild Netlify. To restore Firebase, put back valid values and restart/rebuild. Already configured but invalid credentials, missing rules or disabled providers must be corrected, or explicitly switch back to demo this way.

### Data behavior

- `users/{uid}` stores `uid`, `name`, `email`, `phone`, `role`, `active`, and server `createdAt`. Email/password registration/login/logout use Firebase Auth with browser-local persistence. A missing profile can be recreated at the next successful login; failed registration profile writes never grant admin rights.
- `bookings/{id}` stores the requested customer, traveler, dates, package/destination IDs, `subtotal`, coupon/discount, `totalAmount`, transaction ID, screenshot URL, pending statuses and server creation time. My Bookings queries `userId == current UID`; admin lists use a separate unrestricted query authorized by rules.
- Booking creation recalculates current package prices and revalidates the coupon. Coupon consumption and booking creation use one Firestore transaction. Rules also check prices, ownership, discount and usage. A coupon's ID equals its uppercase code. The admin form writes `usedCount` and `expiresAt` (end of `expiryDate` in UTC); `usageLimit: 0` means unlimited. Make a new coupon to change its code. Existing Console-created coupons must include these derived fields, or recreate/save them through Admin → Coupons.
- Payment confirmations record `paymentSubmittedAt` and make the booking visible for admin verification while both statuses stay pending. Only an admin changes a payment to paid/rejected.
- Reviews use the booking ID as the document ID: one review per completed booking. The service supplies the signed-in profile name and `status: "pending"`. Admin can approve/reject; the home page and package pages query only approved Firestore reviews.
- Anonymous contact submissions save `name`, `email`, `phone`, `message`, and server `createdAt`; only admins can read them. View messages in Firestore Console (the existing app has no contact inbox UI).
- Public queries require `active: true` on destinations/packages. Existing Firebase documents without that boolean must be updated. Lists load on page entry; revisit/reload to see edits from another browser. Single-field query indexes are sufficient; no custom composite index is required.

## QR payment

After updating to optional payment details, publish the updated `firestore.rules` in Firebase Console → Firestore Database → Rules, or run `npx firebase deploy --project YOUR_PROJECT_ID --only firestore:rules`. The old deployed rules require both fields. No rule deployment is performed automatically.

The project intentionally has **no payment gateway/API**.

The flow is:
1. User creates a booking.
2. User opens `/payment/:bookingId`.
3. User scans the UPI QR, pays manually, and submits payment confirmation.
4. Payment remains `pending`.
5. Admin verifies the payment in Admin → Bookings.
6. Approve → `paymentStatus: paid`, `bookingStatus: confirmed`.
7. Reject → `paymentStatus: rejected`, `bookingStatus: payment_failed`.

`public/payment-qr.svg` is a **demo placeholder, not a scannable payment QR**. Replace it with your own real UPI QR image before the assessment if you want to demonstrate a real scan. Keep the same path/name or update the `<img>` path in `src/pages/Payment.jsx`.

## Data collections

Firebase mode uses these Firestore collections:
- `users`
- `destinations`
- `packages`
- `bookings`
- `reviews`
- `coupons`
- `contacts`

## Netlify deployment

This project already includes `netlify.toml` with SPA fallback.

Netlify settings:
- Build command: `npm run build`
- Publish directory: `dist`

If using Firebase, add all six `VITE_FIREBASE_*` values in Netlify → Site configuration → Environment variables.

## Main routes

Public:
- `/`
- `/destinations`
- `/destinations/:id`
- `/packages`
- `/packages/:id`
- `/booking/:packageId`
- `/payment/:bookingId`
- `/my-bookings`
- `/booking-details/:id`
- `/login`
- `/register`
- `/about`
- `/contact`
- `/faq`

Admin:
- `/admin`
- `/admin/destinations`
- `/admin/packages`
- `/admin/bookings`
- `/admin/users`
- `/admin/reviews`
- `/admin/coupons`

## Verification

Verified during implementation: `npm run build` passed, all 8 emulator service/security tests passed, and both browser scenarios passed. Vite reports a non-blocking JavaScript bundle-size warning.

```bash
npm run build
# Node 22+ and Java 21+ are needed for the included emulator/browser test tooling.
npx playwright install chromium
npm run test:firebase
```

`test:firebase` starts local Auth, Firestore and Storage emulators for **`demo-travelaura`**, runs service/security-rule tests, then browser checks and shuts the emulators down. No deployed project, Firebase login or `.env` credentials are needed. Tests use explicit emulator-only identifiers in `tests/fixtures/firebase.js`, outside the production configuration. Browser tests force the six Vite values blank and substitute the emulator fixture only in the Firebase browser test. If Chrome is already installed, use `PLAYWRIGHT_CHANNEL=chrome npm run test:firebase` instead of installing Chromium.

To run against emulators already started with `npx firebase emulators:start --project demo-travelaura --only auth,firestore,storage`:

```bash
npm run test:rules
npm run test:browser
```

The suite tests ownership, private reads, role escalation, booking amount tampering, concurrent coupon exhaustion, approved-review filtering, cancellation, inactive users, valid/invalid/oversized uploads, manual payment approval, contact privacy, demo booking/registration, real SDK Auth restoration with Firestore role changes, and admin destination/package CRUD with Storage images visible on public pages. Permission-denied logs for negative tests are expected.

### Remaining limitations

- Local emulators exercise integration and rules; your real project/bucket/provider/domain/billing configuration still needs a smoke test after you supply `.env` and deploy rules. No cloud project was created or deployed by this change.
- Manual verification cannot prove payment authenticity or prevent a reused/fabricated UTR. Replace the demo QR and `travelaura@upi` text before accepting real money. No payment gateway was added.
- Firebase Storage download URLs contain bearer tokens: anyone who obtains a screenshot URL can use it until its token/object is revoked, even though SDK reads and the booking document are private. Keep these URLs private. Strict revocable downloads would need an authenticated serving mechanism. Image rules validate declared MIME type/size, not file bytes or malware.
- Uploads and Firestore writes are separate operations. A failed booking update, replaced proof or deleted listing can leave an unused image; admins should clean up Storage. Demo uploads use localStorage and are subject to browser quota (which can be smaller than multiple 5 MiB images).
- Contact submissions and account creation need rate limiting/App Check and anti-spam measures before a public commercial launch. Rules do not provide per-IP quotas. Storage profile lookups can incur Firestore reads.
- Prices, coupon minimum/expiry/limits and statuses are checked, but this remains an assessment app: no shared departure inventory lock, trusted payment reconciliation, UTR uniqueness, refund automation, audit trail or cancellation policy engine. Coupon uses count when bookings are created and are not automatically refunded upon cancellation.
- Client-side account deactivation uses Firestore `active`; deletion/password reset/email verification and revoking Auth sessions need additional management flows. Public catalogs/images and approved reviews remain public by design.
- Demo credentials are intentionally permissive and local to that browser. Demo authorization is for assessment only; Firebase uses its own identity and deployed rules.

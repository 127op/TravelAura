// Emulator-only fixture; never imported by production code.

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
const app = initializeApp({ projectId: 'demo-travelaura', apiKey: 'emulator-only', appId: 'emulator-only', storageBucket: 'demo-travelaura.appspot.com' });
export const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectStorageEmulator(storage, '127.0.0.1', 9199);
export const isDemo = false, isFirebaseConfigured = true, hasPartialFirebaseConfig = false;

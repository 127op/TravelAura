import {
  browserLocalPersistence, setPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile, GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db, isDemo } from './firebase.js';
import { demoAuth, seed } from './demoService.js';

// Factory keeps the production services usable against Firebase emulators.
export function createFirebaseAuthService(firebaseAuth, firestore) {
  let operationInProgress = false;
  const profileRef = uid => doc(firestore, 'users', uid);
  const profile = (user, data) => ({ ...data, id: user.uid, uid: user.uid, email: user.email });
  async function ensureProfile(user, details = {}) {
    const ref = profileRef(user.uid);
    return runTransaction(firestore, async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) {
        const data = {
          uid: user.uid, name: details.name || user.displayName || user.email.split('@')[0],
          email: user.email, phone: details.phone || '', role: 'user', active: true,
          createdAt: serverTimestamp(),
        };
        transaction.set(ref, data);
        return profile(user, data);
      }
      if (snapshot.data().active !== true) throw new Error('This account is inactive.');
      if (Object.keys(details).length) {
        transaction.update(ref, details);
      }
      // Return the committed transaction result, not a possibly stale listener cache.
      return profile(user, { ...snapshot.data(), ...details });
    });
  }
  async function authenticate(action) {
    await setPersistence(firebaseAuth, browserLocalPersistence);
    operationInProgress = true;
    try { return await action(); }
    catch (error) { await signOut(firebaseAuth).catch(() => {}); throw error; }
    finally { operationInProgress = false; }
  }
  return {
    getUser: () => null, // Never trust the demo/localStorage profile in Firebase mode.
    subscribe(callback) {
      let unsubscribeProfile = () => {};
      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, user => {
        unsubscribeProfile();
        if (!user) { callback(null); return; }
        callback(null, null, true);
        unsubscribeProfile = onSnapshot(profileRef(user.uid), snapshot => {
          if (!snapshot.exists()) {
            if (operationInProgress) callback(null, null, true);
            else callback(null, new Error('Your profile is unavailable. Sign in again to finish account setup.'));
          } else if (snapshot.data().active !== true) {
            callback(null, new Error('This account is inactive.'));
            signOut(firebaseAuth).catch(() => {});
          } else {
            callback(profile(user, snapshot.data()));
          }
        }, error => callback(null, error));
      }, error => callback(null, error));
      return () => { unsubscribeAuth(); unsubscribeProfile(); };
    },
    login: (email, password) => authenticate(async () => {
      const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      return ensureProfile(result.user);
    }),
    register: (name, email, password, phone = '') => authenticate(async () => {
      const result = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(result.user, { displayName: name.trim() });
      return ensureProfile(result.user, { name: name.trim(), phone: phone.trim() });
    }),
    google: () => authenticate(async () => {
      const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      return ensureProfile(result.user);
    }),
    logout: () => signOut(firebaseAuth),
  };
}

if (isDemo && typeof window !== 'undefined') seed();
export const authService = isDemo ? {
  ...demoAuth,
  subscribe(callback) {
    const sync = () => callback(demoAuth.getUser());
    sync();
    window.addEventListener('travelaura-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('travelaura-change', sync);
      window.removeEventListener('storage', sync);
    };
  },
} : createFirebaseAuthService(auth, db);

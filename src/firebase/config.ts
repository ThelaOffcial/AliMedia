import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: firebaseConfigData.projectId || 'aliapp-e5196',
  appId: firebaseConfigData.appId,
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain || 'aliapp-e5196.firebaseapp.com',
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  databaseURL:
    (firebaseConfigData as any).databaseURL ||
    `https://${firebaseConfigData.projectId || 'aliapp-e5196'}-default-rtdb.firebaseio.com`,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getDatabase(app);
export const auth = getAuth(app);

// Anonymous auth is only used so Realtime Database rules that require
// `auth != null` still allow public reads/writes. It is NOT a member login.
// Google Sign-In replaces this session with a real account.
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch((err) => {
      // Common if Anonymous provider is disabled — app still works for Google users
      console.warn(
        '[FIREBASE] Anonymous sign-in failed (optional). Enable Anonymous under Authentication → Sign-in method if writes need auth != null.',
        err?.code || err
      );
    });
  }
});

export default app;

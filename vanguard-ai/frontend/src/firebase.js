/**
 * Firebase initialization.
 *
 * The Firebase Web API key is NOT a secret — it identifies the project and is
 * meant to ship in client code. Access is controlled by Firebase Auth, Security
 * Rules, and the authorized-domains list, not by hiding this key. Values fall
 * back to the project config but can be overridden with VITE_FIREBASE_* env vars.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCmROzAUWY_HrciOxqi--UyVE1Q5gViAbk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'nexus-vangaurdai.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nexus-vangaurdai',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'nexus-vangaurdai.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_SENDER_ID || '225320682673',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:225320682673:web:b2069a1b2ad57b8ddb8e90',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-YNFFWWY2PQ',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;

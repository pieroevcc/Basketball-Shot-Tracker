import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}

let db: Firestore | null = null;

if (isFirebaseConfigured()) {
  const app: FirebaseApp = initializeApp(firebaseConfig);
  db = getFirestore(app);

  // Connect to Firestore Emulator when VITE_USE_EMULATOR is set
  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('[Firebase] Connected to Firestore Emulator on port 8080');
  } else {
    getAnalytics(app);
    console.log('[Firebase] Connected to project:', firebaseConfig.projectId);
  }
} else {
  console.log('[Firebase] Not configured — using localStorage only.');
}

export { db };

/**
 * Firebase Emulator test setup
 *
 * Initializes a Firebase client SDK instance pointing at the local
 * Firestore emulator. Used by integration tests in tests/emulator/.
 */
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { beforeAll, afterAll, beforeEach } from 'vitest';

const PROJECT_ID = 'basketball-test';

let app: FirebaseApp;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({
    projectId: PROJECT_ID,
    apiKey: 'fake-api-key',
    appId: 'fake-app-id',
  });
  db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
});

beforeEach(async () => {
  // Clear all Firestore data between tests
  await clearFirestoreData();
});

afterAll(async () => {
  await deleteApp(app);
});

/**
 * Clears all documents from the Firestore emulator.
 */
export async function clearFirestoreData(): Promise<void> {
  const response = await fetch(
    `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new Error(`Failed to clear Firestore: ${response.statusText}`);
  }
}

export { db, PROJECT_ID };

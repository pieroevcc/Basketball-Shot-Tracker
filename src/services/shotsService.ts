import { db, isFirebaseConfigured } from '../firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { Shot } from '../types';

const LOCAL_SHOTS_KEY = 'basketballShots';
const SESSION_ID_KEY = 'sessionId';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

/** Call when the user picks a mode — starts a fresh session and clears stored shots. */
export function startNewSession(): void {
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  localStorage.setItem(SESSION_ID_KEY, id);
  localStorage.removeItem(LOCAL_SHOTS_KEY);
}

/** Load shots. Prefers Firestore when configured; falls back to localStorage. */
export async function loadShots(): Promise<Shot[]> {
  if (!isFirebaseConfigured() || !db) {
    const saved = localStorage.getItem(LOCAL_SHOTS_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  try {
    const sessionId = getSessionId();
    const shotsRef = collection(db, 'sessions', sessionId, 'shots');
    const snapshot = await getDocs(shotsRef);
    const shots = snapshot.docs
      .map((d) => d.data() as Shot)
      .sort((a, b) => a.timestamp - b.timestamp);
    // Only overwrite localStorage cache when Firestore actually has data.
    // If Firestore returns empty (e.g. writes failed), keep the local cache.
    if (shots.length > 0) {
      localStorage.setItem(LOCAL_SHOTS_KEY, JSON.stringify(shots));
      return shots;
    }
    const cached = localStorage.getItem(LOCAL_SHOTS_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (err) {
    console.warn('Firestore unavailable, falling back to localStorage:', err);
    const saved = localStorage.getItem(LOCAL_SHOTS_KEY);
    return saved ? JSON.parse(saved) : [];
  }
}

/** Persist a single shot. Always writes to localStorage; also writes to Firestore if configured. */
export async function addShot(shot: Shot): Promise<void> {
  const cached = JSON.parse(localStorage.getItem(LOCAL_SHOTS_KEY) ?? '[]') as Shot[];
  localStorage.setItem(LOCAL_SHOTS_KEY, JSON.stringify([...cached, shot]));

  if (!isFirebaseConfigured() || !db) return;

  try {
    const sessionId = getSessionId();
    const shotsRef = collection(db, 'sessions', sessionId, 'shots');
    await addDoc(shotsRef, shot);
  } catch (err) {
    console.warn('Failed to save shot to Firestore:', err);
  }
}

/** Delete a single shot by its id field. */
export async function deleteShot(shotId: string): Promise<void> {
  const cached = JSON.parse(localStorage.getItem(LOCAL_SHOTS_KEY) ?? '[]') as Shot[];
  localStorage.setItem(LOCAL_SHOTS_KEY, JSON.stringify(cached.filter((s) => s.id !== shotId)));

  if (!isFirebaseConfigured() || !db) return;

  try {
    const sessionId = getSessionId();
    const shotsRef = collection(db, 'sessions', sessionId, 'shots');
    const snapshot = await getDocs(query(shotsRef, where('id', '==', shotId)));
    await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.warn('Failed to delete shot from Firestore:', err);
  }
}

/** Delete all shots for the current session. */
export async function clearShots(): Promise<void> {
  localStorage.removeItem(LOCAL_SHOTS_KEY);

  if (!isFirebaseConfigured() || !db) return;

  try {
    const sessionId = getSessionId();
    const shotsRef = collection(db, 'sessions', sessionId, 'shots');
    const snapshot = await getDocs(shotsRef);
    await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.warn('Failed to clear shots from Firestore:', err);
  }
}
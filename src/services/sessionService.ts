import { db, isFirebaseConfigured } from '../firebase';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import { Shot, Session, Participant, SessionStatus } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireDb(): NonNullable<typeof db> {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase is not configured. Please add your Firebase credentials.');
  }
  return db;
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

async function generateUniqueCode(database: NonNullable<typeof db>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const ref = doc(database, 'sessions', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return code;
    }
  }
  throw new Error('Failed to generate a unique session code after 5 attempts.');
}

// ---------------------------------------------------------------------------
// Teacher actions
// ---------------------------------------------------------------------------

/**
 * Creates a new session document and returns the generated session code.
 */
export async function createSession(): Promise<string> {
  const database = requireDb();
  try {
    const sessionCode = await generateUniqueCode(database);
    const sessionData: Session = {
      sessionCode,
      status: 'lobby',
      createdAt: Date.now(),
      hostDeviceId: crypto.randomUUID(),
    };
    await setDoc(doc(database, 'sessions', sessionCode), sessionData);
    return sessionCode;
  } catch (err) {
    console.warn('Failed to create session:', err);
    throw err;
  }
}

/**
 * Advances a session to the given status.
 */
export async function advanceSession(sessionCode: string, newStatus: SessionStatus): Promise<void> {
  const database = requireDb();
  try {
    await updateDoc(doc(database, 'sessions', sessionCode), { status: newStatus });
  } catch (err) {
    console.warn('Failed to advance session:', err);
    throw err;
  }
}

/**
 * Fetches all participants, shuffles them with Fisher-Yates, pairs them into
 * teams of 2 (with a trio for odd counts), then writes teamId to each
 * participant and advances the session status to 'team_strategy' atomically.
 */
export async function pairTeams(sessionCode: string): Promise<void> {
  const database = requireDb();
  try {
    const participantsRef = collection(database, 'sessions', sessionCode, 'participants');
    const snapshot = await getDocs(participantsRef);
    const participants = snapshot.docs.map((d) => d.data() as Participant);

    // Fisher-Yates shuffle
    for (let i = participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [participants[i], participants[j]] = [participants[j], participants[i]];
    }

    // Assign teamIds: pairs [0,1],[2,3]...; if odd total, last 3 share a team
    const teamAssignments: Map<string, string> = new Map();
    let pairIndex = 0;
    let i = 0;
    while (i < participants.length) {
      const remaining = participants.length - i;
      const teamId = `team-${pairIndex + 1}`;
      if (remaining === 3 || remaining === 2) {
        // Assign remaining participants to this team
        for (let j = i; j < participants.length; j++) {
          teamAssignments.set(participants[j].studentId, teamId);
        }
        break;
      } else {
        teamAssignments.set(participants[i].studentId, teamId);
        teamAssignments.set(participants[i + 1].studentId, teamId);
        i += 2;
        pairIndex++;
      }
    }

    // Write all updates in a batch
    const batch = writeBatch(database);
    for (const participant of participants) {
      const teamId = teamAssignments.get(participant.studentId) ?? null;
      const participantRef = doc(database, 'sessions', sessionCode, 'participants', participant.studentId);
      batch.update(participantRef, { teamId });
    }
    // Also advance session status
    const sessionRef = doc(database, 'sessions', sessionCode);
    batch.update(sessionRef, { status: 'team_strategy' as SessionStatus });

    await batch.commit();
  } catch (err) {
    console.warn('Failed to pair teams:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Student actions
// ---------------------------------------------------------------------------

/**
 * Joins an existing session. Validates that the session exists, is in an
 * acceptable status, and that the chosen name is not already taken.
 */
export async function joinSession(
  sessionCode: string,
  name: string,
  studentId: string
): Promise<void> {
  const database = requireDb();
  try {
    const sessionRef = doc(database, 'sessions', sessionCode);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error('Session not found.');
    }

    const sessionData = sessionSnap.data() as Session;
    const acceptableStatuses: SessionStatus[] = ['lobby', 'solo_active', 'solo_review'];
    if (!acceptableStatuses.includes(sessionData.status)) {
      throw new Error('Session already started.');
    }

    // Check for name collision
    const participantsRef = collection(database, 'sessions', sessionCode, 'participants');
    const nameQuery = query(participantsRef, where('name', '==', name));
    const nameSnap = await getDocs(nameQuery);
    if (!nameSnap.empty) {
      throw new Error('Name taken.');
    }

    const participant: Participant = {
      studentId,
      name,
      joinedAt: Date.now(),
      teamId: null,
      soloShotsComplete: 0,
      teamShotsComplete: 0,
    };

    await setDoc(
      doc(database, 'sessions', sessionCode, 'participants', studentId),
      participant
    );
  } catch (err) {
    console.warn('Failed to join session:', err);
    throw err;
  }
}

/**
 * Updates the name field on a participant document.
 */
export async function updateParticipantName(
  sessionCode: string,
  studentId: string,
  name: string
): Promise<void> {
  const database = requireDb();
  try {
    const participantRef = doc(database, 'sessions', sessionCode, 'participants', studentId);
    await updateDoc(participantRef, { name });
  } catch (err) {
    console.warn('Failed to update participant name:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Shot actions
// ---------------------------------------------------------------------------

/**
 * Writes a shot document and increments the appropriate completion counter
 * on the participant document, all in a single batch.
 */
export async function addSessionShot(sessionCode: string, shot: Shot): Promise<void> {
  const database = requireDb();
  try {
    const batch = writeBatch(database);

    const shotRef = doc(database, 'sessions', sessionCode, 'shots', shot.id);
    batch.set(shotRef, shot);

    if (shot.studentId) {
      const participantRef = doc(
        database,
        'sessions',
        sessionCode,
        'participants',
        shot.studentId
      );
      const participantSnap = await getDoc(participantRef);
      if (participantSnap.exists()) {
        const participantData = participantSnap.data() as Participant;
        if (shot.activity === 'team') {
          batch.update(participantRef, {
            teamShotsComplete: participantData.teamShotsComplete + 1,
          });
        } else {
          batch.update(participantRef, {
            soloShotsComplete: participantData.soloShotsComplete + 1,
          });
        }
      }
    }

    await batch.commit();
  } catch (err) {
    console.warn('Failed to add session shot:', err);
    throw err;
  }
}

/**
 * Finds the most recent shot for a given student and activity, deletes it,
 * and decrements the participant's corresponding counter.
 */
export async function undoLastShot(
  sessionCode: string,
  studentId: string,
  activity: 'solo' | 'team'
): Promise<void> {
  const database = requireDb();
  try {
    const shotsRef = collection(database, 'sessions', sessionCode, 'shots');
    const shotsQuery = query(
      shotsRef,
      where('studentId', '==', studentId),
      where('activity', '==', activity),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(shotsQuery);

    if (snapshot.empty) {
      return; // Nothing to undo
    }

    const mostRecent = snapshot.docs[0];
    const batch = writeBatch(database);
    batch.delete(mostRecent.ref);

    const participantRef = doc(
      database,
      'sessions',
      sessionCode,
      'participants',
      studentId
    );
    const participantSnap = await getDoc(participantRef);
    if (participantSnap.exists()) {
      const participantData = participantSnap.data() as Participant;
      if (activity === 'team') {
        batch.update(participantRef, {
          teamShotsComplete: Math.max(0, participantData.teamShotsComplete - 1),
        });
      } else {
        batch.update(participantRef, {
          soloShotsComplete: Math.max(0, participantData.soloShotsComplete - 1),
        });
      }
    }

    await batch.commit();
  } catch (err) {
    console.warn('Failed to undo last shot:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Real-time listeners
// ---------------------------------------------------------------------------

/**
 * Subscribes to the session document. Returns an unsubscribe function.
 */
export function subscribeToSession(
  sessionCode: string,
  callback: (session: Session) => void
): () => void {
  const database = requireDb();
  const sessionRef = doc(database, 'sessions', sessionCode);
  return onSnapshot(sessionRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as Session);
    }
  });
}

/**
 * Subscribes to the participants subcollection. Returns an unsubscribe function.
 */
export function subscribeToParticipants(
  sessionCode: string,
  callback: (participants: Participant[]) => void
): () => void {
  const database = requireDb();
  const participantsRef = collection(database, 'sessions', sessionCode, 'participants');
  return onSnapshot(participantsRef, (snap) => {
    const participants = snap.docs.map((d) => d.data() as Participant);
    callback(participants);
  });
}

/**
 * Subscribes to the shots subcollection. Returns an unsubscribe function.
 */
export function subscribeToShots(
  sessionCode: string,
  callback: (shots: Shot[]) => void
): () => void {
  const database = requireDb();
  const shotsRef = collection(database, 'sessions', sessionCode, 'shots');
  return onSnapshot(shotsRef, (snap) => {
    const shots = snap.docs.map((d) => d.data() as Shot);
    callback(shots);
  });
}

import { db, isFirebaseConfigured } from '../firebase';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  Shot,
  Session,
  Participant,
  SessionStatus,
  ShotAllocation,
  SabotageAction,
  calculateScore,
} from '../types';

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
      teacherLastSeen: Date.now(),
      hostDeviceId: crypto.randomUUID(),
    };
    await setDoc(doc(database, 'sessions', sessionCode), sessionData);
    return sessionCode;
  } catch (err) {
    console.warn('Failed to create session:', err);
    throw err;
  }
}

const N8N_WEBHOOK_URL = 'https://piero7.app.n8n.cloud/webhook/session-end';
const SPREADSHEET_ID = '1yraTcUbOuzTVakjLxEwjCfCVuWZk07KFhlpXObnwC7c';
const TEACHER_EMAIL = 'pierevco@gmail.com';

/**
 * Marks the session as teacher-disconnected (teacher closed/reloaded the page).
 * Called from a beforeunload handler — fire and forget.
 */
export function markTeacherDisconnected(sessionCode: string): void {
  try {
    const database = requireDb();
    updateDoc(doc(database, 'sessions', sessionCode), { teacherDisconnected: true }).catch(() => {});
  } catch {
    // Silently ignore — best-effort on page unload
  }
}

/**
 * Updates the teacher's heartbeat timestamp. Called on an interval while the
 * teacher's tab is open so students can detect a dead session.
 */
export function updateTeacherHeartbeat(sessionCode: string): void {
  try {
    const database = requireDb();
    updateDoc(doc(database, 'sessions', sessionCode), { teacherLastSeen: Date.now() }).catch(() => {});
  } catch {
    // ignore — best-effort
  }
}

/**
 * Advances a session to the given status.
 */
export async function advanceSession(sessionCode: string, newStatus: SessionStatus): Promise<void> {
  const database = requireDb();
  try {
    await updateDoc(doc(database, 'sessions', sessionCode), { status: newStatus });

    if (newStatus === 'ended') {
      fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode, spreadsheetId: SPREADSHEET_ID, teacherEmail: TEACHER_EMAIL }),
      }).catch((err) => console.warn('n8n webhook failed:', err));
    }
  } catch (err) {
    console.warn('Failed to advance session:', err);
    throw err;
  }
}

/**
 * Assigns Round 1 display groups of 4. Shuffles participants with Fisher-Yates
 * and assigns groupId ("group-1", "group-2", etc.). Last group may have < 4.
 */
export async function assignRound1Groups(sessionCode: string): Promise<void> {
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

    const batch = writeBatch(database);
    for (let i = 0; i < participants.length; i++) {
      const groupId = `group-${Math.floor(i / 4) + 1}`;
      const participantRef = doc(database, 'sessions', sessionCode, 'participants', participants[i].studentId);
      batch.update(participantRef, { groupId });
    }

    await batch.commit();
  } catch (err) {
    console.warn('Failed to assign Round 1 groups:', err);
    throw err;
  }
}

/**
 * Fetches all participants, shuffles them with Fisher-Yates, assigns them into
 * teams of 4, then writes teamId to each participant and advances the session
 * status to 'team_strategy' atomically.
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

    // Assign teamIds in groups of 4; last group may have fewer
    const batch = writeBatch(database);
    for (let i = 0; i < participants.length; i++) {
      const teamId = `team-${Math.floor(i / 4) + 1}`;
      const participantRef = doc(database, 'sessions', sessionCode, 'participants', participants[i].studentId);
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
      groupId: null,
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

/**
 * Removes a participant document from the session (teacher kick).
 */
export async function removeParticipant(
  sessionCode: string,
  studentId: string
): Promise<void> {
  const database = requireDb();
  await deleteDoc(doc(database, 'sessions', sessionCode, 'participants', studentId));
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
 * Calls callback with null if the document does not exist.
 */
export function subscribeToSession(
  sessionCode: string,
  callback: (session: Session | null) => void,
  onError?: (err: Error) => void
): () => void {
  const database = requireDb();
  const sessionRef = doc(database, 'sessions', sessionCode);
  return onSnapshot(
    sessionRef,
    (snap) => { callback(snap.exists() ? (snap.data() as Session) : null); },
    (err) => { onError?.(err); }
  );
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

/**
/**
 * Subscribes to the allocations subcollection. Returns an unsubscribe function.
 */
export function subscribeToAllocations(
  sessionCode: string,
  callback: (allocations: ShotAllocation[]) => void
): () => void {
  const database = requireDb();
  const allocationsRef = collection(database, 'sessions', sessionCode, 'allocations');
  return onSnapshot(allocationsRef, (snap) => {
    const allocations = snap.docs.map((d) => d.data() as ShotAllocation);
    callback(allocations);
  });
}

/**
 * Subscribes to the sabotages subcollection. Returns an unsubscribe function.
 */
export function subscribeToSabotages(
  sessionCode: string,
  callback: (sabotages: SabotageAction[]) => void
): () => void {
  const database = requireDb();
  const sabotagesRef = collection(database, 'sessions', sessionCode, 'sabotages');
  return onSnapshot(sabotagesRef, (snap) => {
    const sabotages = snap.docs.map((d) => d.data() as SabotageAction);
    callback(sabotages);
  });
}

// ---------------------------------------------------------------------------
// Shot allocation & sabotage actions
// ---------------------------------------------------------------------------

/**
 * Saves shot allocations for a team and updates each participant's
 * allocatedShots field.
 */
export async function saveShotAllocations(
  sessionCode: string,
  allocations: ShotAllocation[]
): Promise<void> {
  const database = requireDb();
  try {
    const batch = writeBatch(database);

    for (const alloc of allocations) {
      const allocRef = doc(
        database,
        'sessions',
        sessionCode,
        'allocations',
        `${alloc.teamId}-${alloc.studentId}`
      );
      batch.set(allocRef, alloc);

      const participantRef = doc(
        database,
        'sessions',
        sessionCode,
        'participants',
        alloc.studentId
      );
      batch.update(participantRef, { allocatedShots: alloc.allocatedShots });
    }

    await batch.commit();
  } catch (err) {
    console.warn('Failed to save shot allocations:', err);
    throw err;
  }
}

/**
 * Saves sabotage actions for a team.
 */
export async function saveSabotageActions(
  sessionCode: string,
  actions: SabotageAction[]
): Promise<void> {
  const database = requireDb();
  try {
    const batch = writeBatch(database);

    for (const action of actions) {
      const actionRef = doc(
        database,
        'sessions',
        sessionCode,
        'sabotages',
        action.id
      );
      batch.set(actionRef, action);
    }

    await batch.commit();
  } catch (err) {
    console.warn('Failed to save sabotage actions:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Round 1 winner calculation
// ---------------------------------------------------------------------------

/**
 * Calculates Round 1 scores for all participants and writes the winner
 * to the session document.
 */
export async function calculateRound1Winner(sessionCode: string): Promise<void> {
  const database = requireDb();
  try {
    const shotsRef = collection(database, 'sessions', sessionCode, 'shots');
    const shotsQuery = query(shotsRef, where('activity', '==', 'solo'));
    const shotsSnap = await getDocs(shotsQuery);
    const shots = shotsSnap.docs.map((d) => d.data() as Shot);

    const participantsRef = collection(database, 'sessions', sessionCode, 'participants');
    const participantsSnap = await getDocs(participantsRef);
    const participants = participantsSnap.docs.map((d) => d.data() as Participant);

    const batch = writeBatch(database);

    let winnerId: string | null = null;
    let highScore = -1;

    for (const p of participants) {
      const playerShots = shots.filter((s) => s.studentId === p.studentId);
      const score = calculateScore(playerShots);

      const pRef = doc(database, 'sessions', sessionCode, 'participants', p.studentId);
      batch.update(pRef, { round1Score: score });

      if (score > highScore) {
        highScore = score;
        winnerId = p.studentId;
      }
    }

    if (winnerId) {
      const sessionRef = doc(database, 'sessions', sessionCode);
      batch.update(sessionRef, { round1Winner: winnerId });
    }

    await batch.commit();
  } catch (err) {
    console.warn('Failed to calculate Round 1 winner:', err);
    throw err;
  }
}

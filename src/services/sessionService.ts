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
  increment,
} from 'firebase/firestore';
import { checkRateLimit, trackRequest } from '../utils/rateLimit';
import { generateTeamName } from '../utils/nicknames';
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
      participantCount: 0,
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
 * Assigns participants into 2 teams using smart sizing rules:
 *   n=1 → [1]  n=2 → [1,1]  n=3 → [2,1]  n=4 → [2,2]
 *   n=5 → [4,1]  n=6 → [4,2]  n=7 → [4,3]  n≥8 → groups of 4
 * Returns {studentId → teamId} map.
 */
export function buildTeamAssignments(shuffled: Participant[]): Record<string, string> {
  const n = shuffled.length;
  let teamSizes: number[];

  if (n <= 0) return {};
  if (n === 1) teamSizes = [1];
  else if (n === 2) teamSizes = [1, 1];
  else if (n === 3) teamSizes = [2, 1];
  else if (n === 4) teamSizes = [2, 2];
  else if (n <= 7) teamSizes = [4, n - 4];
  else {
    const numTeams = Math.ceil(n / 4);
    let remaining = n;
    teamSizes = [];
    for (let i = 0; i < numTeams; i++) {
      teamSizes.push(Math.min(4, remaining));
      remaining -= 4;
    }
  }

  const assignments: Record<string, string> = {};
  let idx = 0;
  teamSizes.forEach((size, teamIdx) => {
    for (let j = 0; j < size; j++) {
      assignments[shuffled[idx].studentId] = `team-${teamIdx + 1}`;
      idx++;
    }
  });
  return assignments;
}

/**
 * Fetches all participants, shuffles them with Fisher-Yates, assigns them into
 * smart-sized teams, then writes teamId to each participant and advances the
 * session status to 'team_strategy' atomically.
 * If `assignments` is provided, skips shuffle and uses the given {studentId→teamId} map.
 */
export async function pairTeams(
  sessionCode: string,
  assignments?: Record<string, string>
): Promise<void> {
  const database = requireDb();
  try {
    let resolvedAssignments = assignments;

    if (!resolvedAssignments) {
      const participantsRef = collection(database, 'sessions', sessionCode, 'participants');
      const snapshot = await getDocs(participantsRef);
      const participants = snapshot.docs.map((d) => d.data() as Participant);

      // Fisher-Yates shuffle
      for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
      }

      resolvedAssignments = buildTeamAssignments(participants);
    }

    const batch = writeBatch(database);
    for (const [studentId, teamId] of Object.entries(resolvedAssignments)) {
      const participantRef = doc(database, 'sessions', sessionCode, 'participants', studentId);
      batch.update(participantRef, { teamId });
    }

    // Generate a fun name for each team
    const uniqueTeamIds = [...new Set(Object.values(resolvedAssignments))];
    const teamNames: Record<string, string> = {};
    uniqueTeamIds.forEach((tid) => { teamNames[tid] = generateTeamName(); });

    // Also advance session status and save team names
    const sessionRef = doc(database, 'sessions', sessionCode);
    batch.update(sessionRef, { status: 'team_strategy' as SessionStatus, teamNames });

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
 * Joins an existing session. Validates that the session exists and is not ended.
 * If the name already exists (student rejoining after disconnect), returns the
 * existing participant's studentId instead of creating a new record.
 *
 * Returns { studentId, rejoined } — callers must use the returned studentId
 * because it may differ from the one passed in on a rejoin.
 */
export async function joinSession(
  sessionCode: string,
  name: string,
  studentId: string
): Promise<{ studentId: string; rejoined: boolean }> {
  const database = requireDb();
  try {
    const sessionRef = doc(database, 'sessions', sessionCode);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error('Session not found.');
    }

    const sessionData = sessionSnap.data() as Session;
    if (sessionData.status === 'ended') {
      throw new Error('Session has already ended.');
    }

    // Check for name collision
    const participantsRef = collection(database, 'sessions', sessionCode, 'participants');
    const nameQuery = query(participantsRef, where('name', '==', name));
    const nameSnap = await getDocs(nameQuery);

    if (!nameSnap.empty) {
      // Name already exists — treat as a rejoin and return the existing studentId
      const existing = nameSnap.docs[0].data() as Participant;
      return { studentId: existing.studentId, rejoined: true };
    }

    // New participant — only allow joining during pre-team phases
    const newJoinStatuses: SessionStatus[] = ['lobby', 'solo_active', 'solo_review'];
    if (!newJoinStatuses.includes(sessionData.status)) {
      throw new Error('Session is in progress. Use your original name to rejoin.');
    }

    // Participant cap check
    const currentCount = sessionData.participantCount ?? 0;
    if (currentCount >= 100) {
      throw new Error('Session is full. Maximum 100 participants allowed.');
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

    const batch = writeBatch(database);
    batch.set(
      doc(database, 'sessions', sessionCode, 'participants', studentId),
      participant
    );
    batch.update(doc(database, 'sessions', sessionCode), { participantCount: increment(1) });
    await batch.commit();
    return { studentId, rejoined: false };
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
 * Soft-removes a participant from the session (teacher kick).
 * Sets kicked: true instead of deleting so the teacher can see who was removed.
 */
export async function removeParticipant(
  sessionCode: string,
  studentId: string
): Promise<void> {
  const database = requireDb();
  await updateDoc(doc(database, 'sessions', sessionCode, 'participants', studentId), { kicked: true });
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
  const deviceId = shot.studentId ?? 'unknown';
  checkRateLimit(deviceId);
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
    trackRequest(deviceId);
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
  checkRateLimit(studentId);
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
    trackRequest(studentId);
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
  callback: (participants: Participant[]) => void,
  onError?: (err: Error) => void
): () => void {
  const database = requireDb();
  const participantsRef = collection(database, 'sessions', sessionCode, 'participants');
  return onSnapshot(participantsRef, (snap) => {
    const participants = snap.docs.map((d) => d.data() as Participant);
    callback(participants);
  }, (err) => { onError?.(err); });
}

/**
 * Subscribes to the shots subcollection. Returns an unsubscribe function.
 */
export function subscribeToShots(
  sessionCode: string,
  callback: (shots: Shot[]) => void,
  onError?: (err: Error) => void
): () => void {
  const database = requireDb();
  const shotsRef = collection(database, 'sessions', sessionCode, 'shots');
  return onSnapshot(shotsRef, (snap) => {
    const shots = snap.docs.map((d) => d.data() as Shot);
    callback(shots);
  }, (err) => { onError?.(err); });
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
  const deviceId = allocations[0]?.studentId ?? 'teacher';
  checkRateLimit(deviceId);
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
    trackRequest(deviceId);
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
  const deviceId = actions[0]?.actingTeamId ?? 'teacher';
  checkRateLimit(deviceId);
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
    trackRequest(deviceId);
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

/**
 * Emulator test helpers
 *
 * These helpers perform the same Firestore operations as sessionService.ts
 * but use the emulator-connected Firestore instance directly, bypassing
 * the import.meta.env-dependent firebase.ts module.
 */
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  query,
  where,
  orderBy,
  type Firestore,
} from 'firebase/firestore';

// Types copied from src/types.ts to avoid import.meta.env issues
export type SessionStatus =
  | 'lobby'
  | 'solo_active'
  | 'solo_review'
  | 'team_strategy'
  | 'team_active'
  | 'team_review'
  | 'ended';

export interface Session {
  sessionCode: string;
  status: SessionStatus;
  createdAt: number;
  hostDeviceId: string;
}

export interface Participant {
  studentId: string;
  name: string;
  joinedAt: number;
  teamId: string | null;
  soloShotsComplete: number;
  teamShotsComplete: number;
}

export interface Shot {
  id: string;
  x: number;
  y: number;
  made: boolean;
  timestamp: number;
  zone: string;
  studentId?: string;
  activity?: 'solo' | 'team';
}

// ---------------------------------------------------------------------------
// Session operations
// ---------------------------------------------------------------------------

export async function createSession(db: Firestore, code: string): Promise<void> {
  const session: Session = {
    sessionCode: code,
    status: 'lobby',
    createdAt: Date.now(),
    hostDeviceId: 'test-host-id',
  };
  await setDoc(doc(db, 'sessions', code), session);
}

export async function advanceSession(
  db: Firestore,
  code: string,
  newStatus: SessionStatus
): Promise<void> {
  await updateDoc(doc(db, 'sessions', code), { status: newStatus });
}

export async function getSession(db: Firestore, code: string): Promise<Session | null> {
  const snap = await getDoc(doc(db, 'sessions', code));
  return snap.exists() ? (snap.data() as Session) : null;
}

// ---------------------------------------------------------------------------
// Participant operations
// ---------------------------------------------------------------------------

export async function joinSession(
  db: Firestore,
  code: string,
  name: string,
  studentId: string
): Promise<void> {
  // Check session exists and is in acceptable status
  const sessionSnap = await getDoc(doc(db, 'sessions', code));
  if (!sessionSnap.exists()) throw new Error('Session not found.');

  const sessionData = sessionSnap.data() as Session;
  const acceptable: SessionStatus[] = ['lobby', 'solo_active', 'solo_review'];
  if (!acceptable.includes(sessionData.status)) throw new Error('Session already started.');

  // Check name collision
  const participantsRef = collection(db, 'sessions', code, 'participants');
  const nameQuery = query(participantsRef, where('name', '==', name));
  const nameSnap = await getDocs(nameQuery);
  if (!nameSnap.empty) throw new Error('Name taken.');

  const participant: Participant = {
    studentId,
    name,
    joinedAt: Date.now(),
    teamId: null,
    soloShotsComplete: 0,
    teamShotsComplete: 0,
  };
  await setDoc(doc(db, 'sessions', code, 'participants', studentId), participant);
}

export async function getParticipants(db: Firestore, code: string): Promise<Participant[]> {
  const snap = await getDocs(collection(db, 'sessions', code, 'participants'));
  return snap.docs.map((d) => d.data() as Participant);
}

export async function getParticipant(
  db: Firestore,
  code: string,
  studentId: string
): Promise<Participant | null> {
  const snap = await getDoc(doc(db, 'sessions', code, 'participants', studentId));
  return snap.exists() ? (snap.data() as Participant) : null;
}

// ---------------------------------------------------------------------------
// Shot operations
// ---------------------------------------------------------------------------

export async function addSessionShot(db: Firestore, code: string, shot: Shot): Promise<void> {
  const batch = writeBatch(db);

  const shotRef = doc(db, 'sessions', code, 'shots', shot.id);
  batch.set(shotRef, shot);

  if (shot.studentId) {
    const participantRef = doc(db, 'sessions', code, 'participants', shot.studentId);
    const participantSnap = await getDoc(participantRef);
    if (participantSnap.exists()) {
      const data = participantSnap.data() as Participant;
      if (shot.activity === 'team') {
        batch.update(participantRef, { teamShotsComplete: data.teamShotsComplete + 1 });
      } else {
        batch.update(participantRef, { soloShotsComplete: data.soloShotsComplete + 1 });
      }
    }
  }

  await batch.commit();
}

export async function getShots(db: Firestore, code: string): Promise<Shot[]> {
  const snap = await getDocs(collection(db, 'sessions', code, 'shots'));
  return snap.docs.map((d) => d.data() as Shot);
}

// ---------------------------------------------------------------------------
// Team pairing (mirrors sessionService.pairTeams)
// ---------------------------------------------------------------------------

export async function pairTeams(db: Firestore, code: string): Promise<void> {
  const participantsRef = collection(db, 'sessions', code, 'participants');
  const snapshot = await getDocs(participantsRef);
  const participants = snapshot.docs.map((d) => d.data() as Participant);

  // Fisher-Yates shuffle
  for (let i = participants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [participants[i], participants[j]] = [participants[j], participants[i]];
  }

  const teamAssignments = new Map<string, string>();
  let pairIndex = 0;
  let i = 0;
  while (i < participants.length) {
    const remaining = participants.length - i;
    const teamId = `team-${pairIndex + 1}`;
    if (remaining === 1) {
      teamAssignments.set(participants[i].studentId, teamId);
      break;
    } else if (remaining === 3 || remaining === 2) {
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

  const batch = writeBatch(db);
  for (const p of participants) {
    const teamId = teamAssignments.get(p.studentId) ?? null;
    const ref = doc(db, 'sessions', code, 'participants', p.studentId);
    batch.update(ref, { teamId });
  }
  batch.update(doc(db, 'sessions', code), { status: 'team_strategy' as SessionStatus });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

export function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: `shot-${Math.random().toString(36).slice(2, 8)}`,
    x: 250,
    y: 200,
    made: true,
    timestamp: Date.now(),
    zone: 'Zone 1: Paint',
    studentId: 'default-student',
    activity: 'solo',
    ...overrides,
  };
}

/**
 * Shared test helpers for session-related tests.
 *
 * Provides mock setup for sessionService subscribe functions and
 * utilities to push Firestore "snapshots" on demand.
 */
import { vi, type Mock } from 'vitest';
import { act } from '@testing-library/react';
import type { Session, Participant, Shot } from '../src/types';

// Re-export for convenience
export type { Session, Participant, Shot };

// ---------------------------------------------------------------------------
// Module mocks — call these AFTER vi.mock declarations in your test file
// ---------------------------------------------------------------------------

// Import mocked module (must be called after vi.mock in each test file)
import * as sessionService from '../src/services/sessionService';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

export const STUDENT_ID = 'stu-uuid-1';
export const SESSION_CODE = 'TEST01';

export function createMockParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    studentId: STUDENT_ID,
    name: 'TestPlayer',
    joinedAt: 1000000,
    teamId: null,
    groupId: null,
    soloShotsComplete: 0,
    teamShotsComplete: 0,
    ...overrides,
  };
}

export function createMockShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: `shot-${Math.random().toString(36).slice(2, 8)}`,
    x: 250,
    y: 200,
    made: true,
    timestamp: Date.now(),
    zone: 'Zone 1: Paint',
    studentId: STUDENT_ID,
    activity: 'solo',
    ...overrides,
  };
}

export function sessionSnapshot(
  status: Session['status'],
  code: string = SESSION_CODE
): Session {
  return {
    sessionCode: code,
    status,
    createdAt: 1000000,
    hostDeviceId: 'host-uuid-1',
  };
}

// ---------------------------------------------------------------------------
// Subscribe mock controller
// ---------------------------------------------------------------------------

type SessionCb = (s: Session) => void;
type ParticipantsCb = (p: Participant[]) => void;
type ShotsCb = (shots: Shot[]) => void;

export interface SubscribeMockControls {
  /** Push a session snapshot and flush React state. */
  pushSession: (status: Session['status']) => Promise<void>;
  /** Push participants snapshot and flush React state. */
  pushParticipants: (participants: Participant[]) => Promise<void>;
  /** Push shots snapshot and flush React state. */
  pushShots: (shots: Shot[]) => Promise<void>;
  /** Hydrate all three subscriptions at once (clears loading state). */
  hydrate: (
    status: Session['status'],
    participants?: Participant[],
    shots?: Shot[]
  ) => Promise<void>;
}

/**
 * Captures the subscribe callbacks from sessionService mock implementations
 * and returns helpers to push snapshots into them.
 *
 * Must be called AFTER vi.mock('../src/services/sessionService') has been set up.
 */
export function setupSubscribeMocks(): SubscribeMockControls {
  let onSession: SessionCb | null = null;
  let onParticipants: ParticipantsCb | null = null;
  let onShots: ShotsCb | null = null;

  vi.mocked(sessionService.subscribeToSession).mockImplementation((_code, cb) => {
    onSession = cb;
    return () => { onSession = null; };
  });

  vi.mocked(sessionService.subscribeToParticipants).mockImplementation((_code, cb) => {
    onParticipants = cb;
    return () => { onParticipants = null; };
  });

  vi.mocked(sessionService.subscribeToShots).mockImplementation((_code, cb) => {
    onShots = cb;
    return () => { onShots = null; };
  });

  vi.mocked(sessionService.subscribeToAllocations).mockImplementation((_code, cb) => {
    cb([]);
    return () => {};
  });

  vi.mocked(sessionService.subscribeToSabotages).mockImplementation((_code, cb) => {
    cb([]);
    return () => {};
  });

  const pushSession = (status: Session['status']) =>
    act(() => { onSession?.(sessionSnapshot(status)); });

  const pushParticipants = (participants: Participant[]) =>
    act(() => { onParticipants?.(participants); });

  const pushShots = (shots: Shot[]) =>
    act(() => { onShots?.(shots); });

  const hydrate = (
    status: Session['status'],
    participants: Participant[] = [createMockParticipant()],
    shots: Shot[] = []
  ) =>
    act(() => {
      onSession?.(sessionSnapshot(status));
      onParticipants?.(participants);
      onShots?.(shots);
    });

  return { pushSession, pushParticipants, pushShots, hydrate };
}

// ---------------------------------------------------------------------------
// Common mock declarations — use these in vi.mock() calls
// ---------------------------------------------------------------------------

export const FIREBASE_MOCK = {
  isFirebaseConfigured: () => true,
  db: {},
};

export const SHOTS_SERVICE_MOCK = {
  loadShots: vi.fn().mockResolvedValue([]),
  addShot: vi.fn().mockResolvedValue(undefined),
  deleteShot: vi.fn().mockResolvedValue(undefined),
  clearShots: vi.fn().mockResolvedValue(undefined),
  startNewSession: vi.fn(),
};

export const SESSION_SERVICE_MOCK = {
  subscribeToSession: vi.fn(),
  subscribeToParticipants: vi.fn(),
  subscribeToShots: vi.fn(),
  subscribeToAllocations: vi.fn(),
  subscribeToSabotages: vi.fn(),
  createSession: vi.fn().mockResolvedValue('TEST01'),
  advanceSession: vi.fn().mockResolvedValue(undefined),
  pairTeams: vi.fn().mockResolvedValue(undefined),
  assignRound1Groups: vi.fn().mockResolvedValue(undefined),
  joinSession: vi.fn().mockResolvedValue(undefined),
  updateParticipantName: vi.fn().mockResolvedValue(undefined),
  addSessionShot: vi.fn().mockResolvedValue(undefined),
  undoLastShot: vi.fn().mockResolvedValue(undefined),
  saveShotAllocations: vi.fn().mockResolvedValue(undefined),
  saveSabotageActions: vi.fn().mockResolvedValue(undefined),
  calculateRound1Winner: vi.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Utility: set up localStorage for a student session
// ---------------------------------------------------------------------------

export function setStudentLocalStorage(
  code: string = SESSION_CODE,
  id: string = STUDENT_ID,
  name: string = 'TestPlayer'
) {
  localStorage.setItem('appMode', 'session');
  localStorage.setItem('appRole', 'student');
  localStorage.setItem('sessionCode', code);
  localStorage.setItem('studentId', id);
  localStorage.setItem('studentName', name);
}

export function setTeacherLocalStorage(code: string = SESSION_CODE) {
  localStorage.setItem('appMode', 'session');
  localStorage.setItem('appRole', 'teacher');
  localStorage.setItem('sessionCode', code);
  localStorage.setItem('hostDeviceId', 'host-uuid-1');
}

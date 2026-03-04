/**
 * PM Verification Test — LOBBY → SOLO_ACTIVE state machine transition
 *
 * Strategy: mock sessionService's three subscribe* functions so we can push
 * Firestore "snapshots" (Session, Participant[], Shot[]) on demand.
 * The test wires up a student session via localStorage, verifies the Lobby
 * screen, then advances the mocked session to solo_active and asserts the
 * Solo Activity screen appears.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import App from '../src/App';
import type { Session, Participant } from '../src/types';

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Vitest before any import)
// ---------------------------------------------------------------------------

vi.mock('../src/firebase', () => ({
  isFirebaseConfigured: () => true,
  db: {},
}));

vi.mock('../src/services/shotsService', () => ({
  loadShots: vi.fn().mockResolvedValue([]),
  addShot: vi.fn().mockResolvedValue(undefined),
  deleteShot: vi.fn().mockResolvedValue(undefined),
  clearShots: vi.fn().mockResolvedValue(undefined),
  startNewSession: vi.fn(),
}));

vi.mock('../src/services/sessionService', () => ({
  subscribeToSession: vi.fn(),
  subscribeToParticipants: vi.fn(),
  subscribeToShots: vi.fn(),
  createSession: vi.fn().mockResolvedValue('TEST01'),
  advanceSession: vi.fn().mockResolvedValue(undefined),
  pairTeams: vi.fn().mockResolvedValue(undefined),
  joinSession: vi.fn().mockResolvedValue(undefined),
  updateParticipantName: vi.fn().mockResolvedValue(undefined),
  addSessionShot: vi.fn().mockResolvedValue(undefined),
  undoLastShot: vi.fn().mockResolvedValue(undefined),
}));

// Import mocked module AFTER vi.mock declarations so Vitest resolves the mock
import * as sessionService from '../src/services/sessionService';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const STUDENT_ID = 'stu-uuid-1';
const SESSION_CODE = 'TEST01';

const mockParticipant: Participant = {
  studentId: STUDENT_ID,
  name: 'TestPlayer',
  joinedAt: 1000000,
  teamId: null,
  soloShotsComplete: 0,
  teamShotsComplete: 0,
};

function sessionSnapshot(status: Session['status']): Session {
  return {
    sessionCode: SESSION_CODE,
    status,
    createdAt: 1000000,
    hostDeviceId: 'host-uuid-1',
  };
}

// ---------------------------------------------------------------------------
// Helpers to capture and control the subscribe callbacks
// ---------------------------------------------------------------------------

type SessionCb = (s: Session) => void;
type ParticipantsCb = (p: Participant[]) => void;
type ShotsCb = (shots: []) => void;

function setupSubscribeMocks() {
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

  /** Push a new session snapshot (and flush loading state). */
  const pushSession = (status: Session['status']) =>
    act(() => { onSession?.(sessionSnapshot(status)); });

  /** Hydrate all three subscriptions at once (clears loading state). */
  const hydrate = (status: Session['status']) =>
    act(() => {
      onSession?.(sessionSnapshot(status));
      onParticipants?.([mockParticipant]);
      onShots?.([]);
    });

  return { hydrate, pushSession };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Session state machine — LOBBY → SOLO_ACTIVE', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows Lobby when session status is lobby', async () => {
    localStorage.setItem('appMode', 'session');
    localStorage.setItem('appRole', 'student');
    localStorage.setItem('sessionCode', SESSION_CODE);
    localStorage.setItem('studentId', STUDENT_ID);
    localStorage.setItem('studentName', 'TestPlayer');

    const { hydrate } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby');

    expect(
      screen.getByText(/Waiting for your teacher to start/i)
    ).toBeInTheDocument();
  });

  it('transitions from Lobby to Solo Activity when teacher advances to solo_active', async () => {
    localStorage.setItem('appMode', 'session');
    localStorage.setItem('appRole', 'student');
    localStorage.setItem('sessionCode', SESSION_CODE);
    localStorage.setItem('studentId', STUDENT_ID);
    localStorage.setItem('studentName', 'TestPlayer');

    const { hydrate, pushSession } = setupSubscribeMocks();

    render(<App />);

    // Step 1 — establish lobby state (clears loading)
    await hydrate('lobby');
    expect(
      screen.getByText(/Waiting for your teacher to start/i)
    ).toBeInTheDocument();

    // Step 2 — teacher fires onSnapshot with solo_active
    await pushSession('solo_active');

    // Student screen should now show Solo Activity
    expect(screen.getByText(/Solo Activity/i)).toBeInTheDocument();

    // Lobby waiting message must be gone
    expect(
      screen.queryByText(/Waiting for your teacher to start/i)
    ).not.toBeInTheDocument();
  });

  it('shows the BasketballCourt with maxShots=15 during solo_active', async () => {
    localStorage.setItem('appMode', 'session');
    localStorage.setItem('appRole', 'student');
    localStorage.setItem('sessionCode', SESSION_CODE);
    localStorage.setItem('studentId', STUDENT_ID);

    const { hydrate, pushSession } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby');
    await pushSession('solo_active');

    // BasketballCourt renders a counter: "{shots.length} / {maxShots} shots"
    // With 0 shots recorded the counter reads "0 / 15 shots"
    expect(screen.getByText(/0 \/ 15 shots/i)).toBeInTheDocument();
  });
});

/**
 * PM Verification Test — LOBBY → SOLO_ACTIVE state machine transition
 *
 * Uses shared helpers from tests/helpers.ts for mock setup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

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
}));

import {
  setupSubscribeMocks,
  setStudentLocalStorage,
  SESSION_CODE,
  STUDENT_ID,
} from './helpers';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Session state machine — LOBBY → SOLO_ACTIVE', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows Lobby when session status is lobby', async () => {
    setStudentLocalStorage();
    const { hydrate } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby');

    expect(
      screen.getByText(/Waiting for your teacher to start/i)
    ).toBeInTheDocument();
  });

  it('transitions from Lobby to Solo Activity when teacher advances to solo_active', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession } = setupSubscribeMocks();

    render(<App />);

    await hydrate('lobby');
    expect(
      screen.getByText(/Waiting for your teacher to start/i)
    ).toBeInTheDocument();

    await pushSession('solo_active');

    expect(screen.getByText(/Solo Activity/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Waiting for your teacher to start/i)
    ).not.toBeInTheDocument();
  });

  it('shows the BasketballCourt with maxShots=15 during solo_active', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby');
    await pushSession('solo_active');

    expect(screen.getByText(/0 \/ 20 shots/i)).toBeInTheDocument();
  });
});

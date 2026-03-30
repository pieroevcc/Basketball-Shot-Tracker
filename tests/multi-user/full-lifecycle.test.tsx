/**
 * Full Session Lifecycle Test
 *
 * Verifies all 7 session states render the correct component
 * when advancing through the complete state machine:
 * LOBBY → SOLO_ACTIVE → SOLO_REVIEW → TEAM_STRATEGY → TEAM_ACTIVE → TEAM_REVIEW → ENDED
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';
import type { Participant, Shot } from '../../src/types';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/firebase', () => ({
  isFirebaseConfigured: () => true,
  db: {},
}));

vi.mock('../../src/services/shotsService', () => ({
  loadShots: vi.fn().mockResolvedValue([]),
  addShot: vi.fn().mockResolvedValue(undefined),
  deleteShot: vi.fn().mockResolvedValue(undefined),
  clearShots: vi.fn().mockResolvedValue(undefined),
  startNewSession: vi.fn(),
}));

vi.mock('../../src/services/sessionService', () => ({
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
  subscribeToAllocations: vi.fn(),
  subscribeToSabotages: vi.fn(),
  assignRound1Groups: vi.fn().mockResolvedValue(undefined),
  saveShotAllocations: vi.fn().mockResolvedValue(undefined),
  saveSabotageActions: vi.fn().mockResolvedValue(undefined),
  calculateRound1Winner: vi.fn().mockResolvedValue(undefined),
}));

import {
  setupSubscribeMocks,
  setStudentLocalStorage,
  createMockParticipant,
  createMockShot,
  STUDENT_ID,
} from '../helpers';

// ---------------------------------------------------------------------------
// Fixtures: 5 participants with team assignments
// ---------------------------------------------------------------------------

const participants: Participant[] = [
  createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
  createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
  createMockParticipant({ studentId: 'stu-3', name: 'Carol', teamId: 'team-2' }),
  createMockParticipant({ studentId: 'stu-4', name: 'Dave', teamId: 'team-2' }),
  createMockParticipant({ studentId: 'stu-5', name: 'Eve', teamId: 'team-3' }),
];

const soloShots: Shot[] = [
  createMockShot({ studentId: STUDENT_ID, activity: 'solo', made: true }),
  createMockShot({ studentId: STUDENT_ID, activity: 'solo', made: false }),
  createMockShot({ studentId: 'stu-2', activity: 'solo', made: true }),
];

const teamShots: Shot[] = [
  createMockShot({ studentId: STUDENT_ID, activity: 'team', made: true }),
  createMockShot({ studentId: 'stu-2', activity: 'team', made: false }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Full session lifecycle — all 7 states', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders Lobby in lobby state', async () => {
    setStudentLocalStorage();
    const { hydrate } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);

    expect(screen.getByText(/Waiting for your teacher to start/i)).toBeInTheDocument();
  });

  it('renders Solo Activity in solo_active state', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushSession('solo_active');

    expect(screen.getByText(/Solo Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('renders Solo Review in solo_review state with shot data', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushShots(soloShots);
    await pushSession('solo_review');

    expect(screen.getByText(/Your Solo Results/i)).toBeInTheDocument();
  });

  it('renders Team Strategy in team_strategy state', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushShots(soloShots);
    await pushSession('team_strategy');

    expect(screen.getByText(/Team Strategy/i)).toBeInTheDocument();
  });

  it('renders Team Activity in team_active state with maxShots=20', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushShots(soloShots);
    await pushSession('team_active');

    expect(screen.getByText(/Team Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('renders Team Review in team_review state', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushShots([...soloShots, ...teamShots]);
    await pushSession('team_review');

    expect(screen.getByText(/Team Results/i)).toBeInTheDocument();
  });

  it('renders Session Ended in ended state', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushShots([...soloShots, ...teamShots]);
    await pushSession('ended');

    expect(screen.getByText(/Great work today/i)).toBeInTheDocument();
  });

  it('advances through all states sequentially', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);

    // LOBBY → SOLO_ACTIVE
    await pushSession('solo_active');
    expect(screen.getByText(/Solo Activity/i)).toBeInTheDocument();

    // Record some solo shots
    await pushShots(soloShots);

    // SOLO_ACTIVE → SOLO_REVIEW
    await pushSession('solo_review');
    expect(screen.getByText(/Your Solo Results/i)).toBeInTheDocument();

    // SOLO_REVIEW → TEAM_STRATEGY
    await pushSession('team_strategy');
    expect(screen.getByText(/Team Strategy/i)).toBeInTheDocument();

    // TEAM_STRATEGY → TEAM_ACTIVE
    await pushSession('team_active');
    expect(screen.getByText(/Team Activity/i)).toBeInTheDocument();

    // Record team shots
    await pushShots([...soloShots, ...teamShots]);

    // TEAM_ACTIVE → TEAM_REVIEW
    await pushSession('team_review');
    expect(screen.getByText(/Team Results/i)).toBeInTheDocument();

    // TEAM_REVIEW → ENDED
    await pushSession('ended');
    expect(screen.getByText(/Great work today/i)).toBeInTheDocument();
  });
});

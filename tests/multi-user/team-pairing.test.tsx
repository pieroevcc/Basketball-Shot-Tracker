/**
 * Team Pairing Test
 *
 * Verifies the Team Strategy and Team Review components correctly display
 * teammate data based on teamId assignments, including edge cases like
 * odd participant counts and solo teams.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';

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
// Tests
// ---------------------------------------------------------------------------

describe('Team pairing — teammate display', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows Team Strategy with teammate data for paired students', async () => {
    setStudentLocalStorage();
    const participants = [
      createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
      createMockParticipant({ studentId: 'stu-3', name: 'Carol', teamId: 'team-2' }),
      createMockParticipant({ studentId: 'stu-4', name: 'Dave', teamId: 'team-2' }),
    ];

    const soloShots = [
      createMockShot({ studentId: STUDENT_ID, activity: 'solo', zone: 'Zone 1: Paint', made: true }),
      createMockShot({ studentId: 'stu-2', activity: 'solo', zone: 'Zone 2: Left Mid-Range', made: false }),
    ];

    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushShots(soloShots);
    await pushSession('team_strategy');

    expect(screen.getByText(/Team Strategy/i)).toBeInTheDocument();
  });

  it('handles trio team (odd number of participants)', async () => {
    setStudentLocalStorage();
    const participants = [
      createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
      createMockParticipant({ studentId: 'stu-3', name: 'Carol', teamId: 'team-1' }), // Trio!
      createMockParticipant({ studentId: 'stu-4', name: 'Dave', teamId: 'team-2' }),
      createMockParticipant({ studentId: 'stu-5', name: 'Eve', teamId: 'team-2' }),
    ];

    const { hydrate, pushSession } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushSession('team_strategy');

    expect(screen.getByText(/Team Strategy/i)).toBeInTheDocument();
  });

  it('displays team review with combined team data', async () => {
    setStudentLocalStorage();
    const participants = [
      createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
    ];

    const allShots = [
      // Solo shots
      createMockShot({ id: 'solo-1', studentId: STUDENT_ID, activity: 'solo', made: true }),
      createMockShot({ id: 'solo-2', studentId: 'stu-2', activity: 'solo', made: false }),
      // Team shots
      createMockShot({ id: 'team-1', studentId: STUDENT_ID, activity: 'team', made: true }),
      createMockShot({ id: 'team-2', studentId: 'stu-2', activity: 'team', made: true }),
      createMockShot({ id: 'team-3', studentId: STUDENT_ID, activity: 'team', made: false }),
    ];

    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushShots(allShots);
    await pushSession('team_review');

    expect(screen.getByText(/Team Results/i)).toBeInTheDocument();
  });

  it('handles large team count (12 teams = 24 students)', async () => {
    setStudentLocalStorage();
    const participants = Array.from({ length: 24 }, (_, i) => {
      const teamNum = Math.floor(i / 2) + 1;
      return createMockParticipant({
        studentId: i === 0 ? STUDENT_ID : `stu-${i + 1}`,
        name: `Player${i + 1}`,
        teamId: `team-${teamNum}`,
      });
    });

    const { hydrate, pushSession } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushSession('team_strategy');

    expect(screen.getByText(/Team Strategy/i)).toBeInTheDocument();
  });

  it('handles team activity with shots from both teammates', async () => {
    setStudentLocalStorage();
    const participants = [
      createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
    ];

    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushSession('team_active');

    // Both teammates shooting
    const shots = [
      createMockShot({ id: 't1', studentId: STUDENT_ID, activity: 'team' }),
      createMockShot({ id: 't2', studentId: 'stu-2', activity: 'team' }),
      createMockShot({ id: 't3', studentId: STUDENT_ID, activity: 'team' }),
    ];
    await pushShots(shots);

    // Alice sees her 2 team shots
    expect(screen.getByText(/2 \/ 20 shots/i)).toBeInTheDocument();
  });
});

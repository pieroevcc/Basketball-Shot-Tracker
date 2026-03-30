/**
 * Real-time Sync Test
 *
 * Verifies that onSnapshot updates correctly propagate through the
 * useSession hook's derived values (mySoloShots, myTeamShots, teammateShots)
 * when handling large volumes of shots from multiple students.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';
import { ZONES } from '../../src/types';

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
// Helpers
// ---------------------------------------------------------------------------

const zoneNames = Object.keys(ZONES);

function randomZone(): string {
  return zoneNames[Math.floor(Math.random() * zoneNames.length)];
}

function generateShotsForStudents(
  studentIds: string[],
  count: number,
  activity: 'solo' | 'team'
) {
  return studentIds.flatMap((sid) =>
    Array.from({ length: count }, (_, i) =>
      createMockShot({
        id: `${sid}-${activity}-${i}`,
        studentId: sid,
        activity,
        made: Math.random() > 0.4,
        zone: randomZone(),
        timestamp: 1000000 + i,
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Real-time sync — large snapshot handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('correctly filters shots for 5 students with 15 solo shots each (75 total)', async () => {
    setStudentLocalStorage();
    const studentIds = [STUDENT_ID, 'stu-2', 'stu-3', 'stu-4', 'stu-5'];
    const participants = studentIds.map((id, i) =>
      createMockParticipant({ studentId: id, name: `Player${i + 1}` })
    );

    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushSession('solo_active');

    const allShots = generateShotsForStudents(studentIds, 15, 'solo');
    expect(allShots.length).toBe(75);
    await pushShots(allShots);

    expect(screen.getByText(/15 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('handles mixed solo and team shots in the same snapshot', async () => {
    setStudentLocalStorage();
    const participants = [
      createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
    ];

    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);

    // Mix of solo and team shots from both players
    const soloShots = generateShotsForStudents([STUDENT_ID, 'stu-2'], 10, 'solo');
    const teamShots = generateShotsForStudents([STUDENT_ID, 'stu-2'], 5, 'team');
    const allShots = [...soloShots, ...teamShots];

    await pushShots(allShots);
    await pushSession('team_active');

    // Should show team shots count (5 for current student) not solo
    expect(screen.getByText(/5 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('handles snapshot replacement (full array swap)', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby');
    await pushSession('solo_active');

    // First snapshot: 5 shots
    const first = Array.from({ length: 5 }, (_, i) =>
      createMockShot({ id: `first-${i}`, studentId: STUDENT_ID, activity: 'solo' })
    );
    await pushShots(first);
    expect(screen.getByText(/5 \/ 20 shots/i)).toBeInTheDocument();

    // Second snapshot replaces entirely: 3 shots (simulating undo)
    const second = Array.from({ length: 3 }, (_, i) =>
      createMockShot({ id: `second-${i}`, studentId: STUDENT_ID, activity: 'solo' })
    );
    await pushShots(second);
    expect(screen.getByText(/3 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('handles 25 students × 15 shots = 375 shot docs efficiently', async () => {
    setStudentLocalStorage();
    const studentIds = Array.from({ length: 25 }, (_, i) =>
      i === 0 ? STUDENT_ID : `stu-${i + 1}`
    );
    const participants = studentIds.map((id, i) =>
      createMockParticipant({ studentId: id, name: `S${i + 1}` })
    );

    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushSession('solo_active');

    const start = performance.now();
    const allShots = generateShotsForStudents(studentIds, 15, 'solo');
    await pushShots(allShots);
    const elapsed = performance.now() - start;

    expect(screen.getByText(/15 \/ 20 shots/i)).toBeInTheDocument();

    // Should complete in under 2 seconds even with 375 shots
    expect(elapsed).toBeLessThan(2000);
  });

  it('handles empty snapshot gracefully', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby');
    await pushSession('solo_active');

    // Push non-empty then empty
    await pushShots([
      createMockShot({ studentId: STUDENT_ID, activity: 'solo' }),
    ]);
    expect(screen.getByText(/1 \/ 20 shots/i)).toBeInTheDocument();

    await pushShots([]);
    expect(screen.getByText(/0 \/ 20 shots/i)).toBeInTheDocument();
  });
});

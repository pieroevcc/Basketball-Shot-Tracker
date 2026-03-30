/**
 * Concurrent Shots Test
 *
 * Verifies that when multiple students' shots arrive via onSnapshot,
 * only the current student's shots count toward their personal limit
 * and the UI correctly filters/displays shot data.
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

describe('Concurrent shots — multi-student filtering', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('counts only own shots toward solo limit', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', [
      createMockParticipant({ studentId: STUDENT_ID, name: 'Alice' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob' }),
    ]);
    await pushSession('solo_active');

    // 5 of mine, 10 of Bob's
    const myShots = Array.from({ length: 5 }, (_, i) =>
      createMockShot({ id: `my-${i}`, studentId: STUDENT_ID, activity: 'solo' })
    );
    const bobShots = Array.from({ length: 10 }, (_, i) =>
      createMockShot({ id: `bob-${i}`, studentId: 'stu-2', activity: 'solo' })
    );
    await pushShots([...myShots, ...bobShots]);

    expect(screen.getByText(/5 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('handles interleaved shots from multiple students', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', [
      createMockParticipant({ studentId: STUDENT_ID, name: 'Alice' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob' }),
      createMockParticipant({ studentId: 'stu-3', name: 'Carol' }),
    ]);
    await pushSession('solo_active');

    // Interleaved shots from 3 students
    const shots = [
      createMockShot({ id: 's1', studentId: STUDENT_ID, activity: 'solo' }),
      createMockShot({ id: 's2', studentId: 'stu-2', activity: 'solo' }),
      createMockShot({ id: 's3', studentId: STUDENT_ID, activity: 'solo' }),
      createMockShot({ id: 's4', studentId: 'stu-3', activity: 'solo' }),
      createMockShot({ id: 's5', studentId: STUDENT_ID, activity: 'solo' }),
      createMockShot({ id: 's6', studentId: 'stu-2', activity: 'solo' }),
    ];
    await pushShots(shots);

    // Only Alice's 3 shots count
    expect(screen.getByText(/3 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('updates shot count as snapshots arrive incrementally', async () => {
    setStudentLocalStorage();
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby');
    await pushSession('solo_active');

    // Initial: 2 shots
    await pushShots([
      createMockShot({ id: 's1', studentId: STUDENT_ID, activity: 'solo' }),
      createMockShot({ id: 's2', studentId: STUDENT_ID, activity: 'solo' }),
    ]);
    expect(screen.getByText(/2 \/ 20 shots/i)).toBeInTheDocument();

    // Snapshot update: now 7 shots
    const sevenShots = Array.from({ length: 7 }, (_, i) =>
      createMockShot({ id: `shot-${i}`, studentId: STUDENT_ID, activity: 'solo' })
    );
    await pushShots(sevenShots);
    expect(screen.getByText(/7 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('counts team shots separately during team_active', async () => {
    setStudentLocalStorage();
    const participants = [
      createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
    ];
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);

    // Advance through solo to team
    await pushSession('solo_active');
    const soloShots = Array.from({ length: 10 }, (_, i) =>
      createMockShot({ id: `solo-${i}`, studentId: STUDENT_ID, activity: 'solo' })
    );
    await pushShots(soloShots);

    await pushSession('team_active');

    // Now add team shots on top of solo shots
    const teamShots = Array.from({ length: 4 }, (_, i) =>
      createMockShot({ id: `team-${i}`, studentId: STUDENT_ID, activity: 'team' })
    );
    await pushShots([...soloShots, ...teamShots]);

    // Should show 4/20 for team, not 14 combined
    expect(screen.getByText(/4 \/ 20 shots/i)).toBeInTheDocument();
  });

  it('handles 25 students each with 15 shots (375 total shot docs), shows 15/20', async () => {
    setStudentLocalStorage();
    const participants = Array.from({ length: 25 }, (_, i) =>
      createMockParticipant({
        studentId: i === 0 ? STUDENT_ID : `stu-${i + 1}`,
        name: `Player${i + 1}`,
      })
    );
    const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', participants);
    await pushSession('solo_active');

    // Generate 375 shots: 15 from each of 25 students
    const allShots = participants.flatMap((p) =>
      Array.from({ length: 15 }, (_, j) =>
        createMockShot({
          id: `${p.studentId}-shot-${j}`,
          studentId: p.studentId,
          activity: 'solo',
        })
      )
    );
    await pushShots(allShots);

    // Current student should see 15/15
    expect(screen.getByText(/15 \/ 20 shots/i)).toBeInTheDocument();
  });
});

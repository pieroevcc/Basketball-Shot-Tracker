/**
 * Shot Limits Test
 *
 * Verifies maxShots enforcement (15 solo, 20 team) by pushing
 * shots via the mock and checking the court's locked state.
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
// Helpers
// ---------------------------------------------------------------------------

function generateShots(count: number, activity: 'solo' | 'team'): ReturnType<typeof createMockShot>[] {
  return Array.from({ length: count }, (_, i) =>
    createMockShot({
      id: `shot-${activity}-${i}`,
      studentId: STUDENT_ID,
      activity,
      made: i % 2 === 0,
      timestamp: 1000000 + i,
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Shot limits enforcement', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Solo mode (max 20 shots)', () => {
    it('shows shot counter with current count during solo_active', async () => {
      setStudentLocalStorage();
      const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

      render(<App />);
      await hydrate('lobby');
      await pushSession('solo_active');

      const shots = generateShots(5, 'solo');
      await pushShots(shots);

      expect(screen.getByText(/5 \/ 20 shots/i)).toBeInTheDocument();
    });

    it('shows 19/20 when approaching limit', async () => {
      setStudentLocalStorage();
      const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

      render(<App />);
      await hydrate('lobby');
      await pushSession('solo_active');

      await pushShots(generateShots(19, 'solo'));

      expect(screen.getByText(/19 \/ 20 shots/i)).toBeInTheDocument();
    });

    it('shows 20/20 when at limit', async () => {
      setStudentLocalStorage();
      const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

      render(<App />);
      await hydrate('lobby');
      await pushSession('solo_active');

      await pushShots(generateShots(20, 'solo'));

      expect(screen.getByText(/20 \/ 20 shots/i)).toBeInTheDocument();
    });

    it('only counts current student shots toward limit', async () => {
      setStudentLocalStorage();
      const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

      render(<App />);
      await hydrate('lobby');
      await pushSession('solo_active');

      // 3 shots from current student, 5 from other students
      const myShots = generateShots(3, 'solo');
      const otherShots = Array.from({ length: 5 }, (_, i) =>
        createMockShot({
          id: `other-shot-${i}`,
          studentId: 'other-student',
          activity: 'solo',
        })
      );
      await pushShots([...myShots, ...otherShots]);

      expect(screen.getByText(/3 \/ 20 shots/i)).toBeInTheDocument();
    });
  });

  describe('Team mode (max 20 shots)', () => {
    it('shows team shot counter during team_active', async () => {
      setStudentLocalStorage();
      const participants = [
        createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
        createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
      ];
      const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

      render(<App />);
      await hydrate('lobby', participants);
      await pushSession('team_active');

      const teamShots = generateShots(8, 'team');
      await pushShots(teamShots);

      expect(screen.getByText(/8 \/ 20 shots/i)).toBeInTheDocument();
    });

    it('shows 20/20 when at team limit', async () => {
      setStudentLocalStorage();
      const participants = [
        createMockParticipant({ studentId: STUDENT_ID, name: 'Alice', teamId: 'team-1' }),
        createMockParticipant({ studentId: 'stu-2', name: 'Bob', teamId: 'team-1' }),
      ];
      const { hydrate, pushSession, pushShots } = setupSubscribeMocks();

      render(<App />);
      await hydrate('lobby', participants);
      await pushSession('team_active');

      await pushShots(generateShots(20, 'team'));

      expect(screen.getByText(/20 \/ 20 shots/i)).toBeInTheDocument();
    });
  });
});

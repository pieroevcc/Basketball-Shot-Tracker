/**
 * Concurrent Join Test
 *
 * Verifies the TeacherLobby UI correctly updates when multiple participants
 * join the session in rapid succession via onSnapshot updates.
 * Uses teacher role because the teacher lobby displays the full participant list.
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
  setTeacherLocalStorage,
  createMockParticipant,
} from '../helpers';

// ---------------------------------------------------------------------------
// Tests — Teacher view shows full participant list
// ---------------------------------------------------------------------------

describe('Concurrent join — participant list updates (teacher view)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows initial participants in teacher lobby', async () => {
    setTeacherLocalStorage();
    const { hydrate } = setupSubscribeMocks();

    const threeParticipants = [
      createMockParticipant({ studentId: 'stu-1', name: 'Alice' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob' }),
      createMockParticipant({ studentId: 'stu-3', name: 'Carol' }),
    ];

    render(<App />);
    await hydrate('lobby', threeParticipants);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/Carol/)).toBeInTheDocument();
  });

  it('updates participant list when new students join', async () => {
    setTeacherLocalStorage();
    const { hydrate, pushParticipants } = setupSubscribeMocks();

    const initial = [
      createMockParticipant({ studentId: 'stu-1', name: 'Alice' }),
      createMockParticipant({ studentId: 'stu-2', name: 'Bob' }),
      createMockParticipant({ studentId: 'stu-3', name: 'Carol' }),
    ];

    render(<App />);
    await hydrate('lobby', initial);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();

    // Two more students join
    const updated = [
      ...initial,
      createMockParticipant({ studentId: 'stu-4', name: 'Dave' }),
      createMockParticipant({ studentId: 'stu-5', name: 'Eve' }),
    ];
    await pushParticipants(updated);

    expect(screen.getByText(/Dave/)).toBeInTheDocument();
    expect(screen.getByText(/Eve/)).toBeInTheDocument();
  });

  it('handles rapid sequential participant updates', async () => {
    setTeacherLocalStorage();
    const { hydrate, pushParticipants } = setupSubscribeMocks();

    render(<App />);
    await hydrate('lobby', [
      createMockParticipant({ studentId: 'stu-1', name: 'Player1' }),
    ]);

    // Rapid joins — 5 snapshot updates in succession
    for (let i = 2; i <= 6; i++) {
      const participants = Array.from({ length: i }, (_, j) =>
        createMockParticipant({
          studentId: `stu-${j + 1}`,
          name: `Player${j + 1}`,
        })
      );
      await pushParticipants(participants);
    }

    // After all updates, we should see 6 players
    expect(screen.getByText(/Player1/)).toBeInTheDocument();
    expect(screen.getByText(/Player6/)).toBeInTheDocument();
  });

  it('handles 20 participants in teacher lobby', async () => {
    setTeacherLocalStorage();
    const { hydrate } = setupSubscribeMocks();

    const twentyParticipants = Array.from({ length: 20 }, (_, i) =>
      createMockParticipant({
        studentId: `stu-${i + 1}`,
        name: `Stu_${String(i + 1).padStart(2, '0')}`,
      })
    );

    render(<App />);
    await hydrate('lobby', twentyParticipants);

    expect(screen.getByText('Stu_01')).toBeInTheDocument();
    expect(screen.getByText('Stu_20')).toBeInTheDocument();
  });

  it('handles 30 participants (stress test)', async () => {
    setTeacherLocalStorage();
    const { hydrate } = setupSubscribeMocks();

    const thirtyParticipants = Array.from({ length: 30 }, (_, i) =>
      createMockParticipant({
        studentId: `stu-${i + 1}`,
        name: `Kid_${String(i + 1).padStart(2, '0')}`,
      })
    );

    render(<App />);
    await hydrate('lobby', thirtyParticipants);

    expect(screen.getByText('Kid_01')).toBeInTheDocument();
    expect(screen.getByText('Kid_30')).toBeInTheDocument();
  });
});

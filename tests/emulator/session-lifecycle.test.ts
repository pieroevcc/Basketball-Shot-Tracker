/**
 * Integration Test: Session Lifecycle
 *
 * Tests the complete session lifecycle against the Firestore emulator:
 * create → join (5 parallel) → advance through all states → verify docs.
 *
 * Requires: firebase emulators:start --only firestore
 */
import { describe, it, expect } from 'vitest';
import { db } from '../setup-emulator';
import {
  createSession,
  advanceSession,
  getSession,
  joinSession,
  getParticipants,
  addSessionShot,
  getShots,
  pairTeams,
  makeShot,
} from './emulator-helpers';

const CODE = 'LIFE01';

describe('Session lifecycle (emulator)', () => {
  it('creates a session document', async () => {
    await createSession(db, CODE);
    const session = await getSession(db, CODE);
    expect(session).not.toBeNull();
    expect(session!.status).toBe('lobby');
    expect(session!.sessionCode).toBe(CODE);
  });

  it('allows 5 students to join in parallel', async () => {
    await createSession(db, 'JOIN05');

    const joins = Array.from({ length: 5 }, (_, i) =>
      joinSession(db, 'JOIN05', `Student${i + 1}`, `stu-${i + 1}`)
    );
    await Promise.all(joins);

    const participants = await getParticipants(db, 'JOIN05');
    expect(participants).toHaveLength(5);

    const names = participants.map((p) => p.name).sort();
    expect(names).toEqual(['Student1', 'Student2', 'Student3', 'Student4', 'Student5']);
  });

  it('advances through all session states', async () => {
    await createSession(db, 'ADV01');

    const statuses = [
      'solo_active',
      'solo_review',
      'team_strategy',
      'team_active',
      'team_review',
      'ended',
    ] as const;

    for (const status of statuses) {
      await advanceSession(db, 'ADV01', status);
      const session = await getSession(db, 'ADV01');
      expect(session!.status).toBe(status);
    }
  });

  it('runs a complete session with 5 students', async () => {
    const code = 'FULL01';
    await createSession(db, code);

    // 5 students join
    for (let i = 1; i <= 5; i++) {
      await joinSession(db, code, `Player${i}`, `stu-${i}`);
    }

    // Solo active: each student fires 3 shots
    await advanceSession(db, code, 'solo_active');
    for (let i = 1; i <= 5; i++) {
      for (let j = 0; j < 3; j++) {
        await addSessionShot(db, code, makeShot({
          id: `solo-${i}-${j}`,
          studentId: `stu-${i}`,
          activity: 'solo',
          made: j % 2 === 0,
        }));
      }
    }

    let shots = await getShots(db, code);
    expect(shots).toHaveLength(15); // 5 × 3

    // Solo review
    await advanceSession(db, code, 'solo_review');

    // Team strategy (pairs teams)
    await pairTeams(db, code);
    const session = await getSession(db, code);
    expect(session!.status).toBe('team_strategy');

    const participants = await getParticipants(db, code);
    const allHaveTeams = participants.every((p) => p.teamId !== null);
    expect(allHaveTeams).toBe(true);

    // Team active: each student fires 2 team shots
    await advanceSession(db, code, 'team_active');
    for (let i = 1; i <= 5; i++) {
      for (let j = 0; j < 2; j++) {
        await addSessionShot(db, code, makeShot({
          id: `team-${i}-${j}`,
          studentId: `stu-${i}`,
          activity: 'team',
          made: true,
        }));
      }
    }

    shots = await getShots(db, code);
    expect(shots).toHaveLength(25); // 15 solo + 10 team

    // Team review → ended
    await advanceSession(db, code, 'team_review');
    await advanceSession(db, code, 'ended');

    const finalSession = await getSession(db, code);
    expect(finalSession!.status).toBe('ended');

    // Verify participant counters
    const finalParticipants = await getParticipants(db, code);
    for (const p of finalParticipants) {
      expect(p.soloShotsComplete).toBe(3);
      expect(p.teamShotsComplete).toBe(2);
    }
  });
});

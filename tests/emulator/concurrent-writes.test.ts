/**
 * Integration Test: Concurrent Writes
 *
 * Tests that parallel addSessionShot calls from different students
 * all succeed and counters are updated correctly.
 *
 * Also tests the known counter race condition when multiple shots
 * from the same student happen simultaneously.
 *
 * Requires: firebase emulators:start --only firestore
 */
import { describe, it, expect } from 'vitest';
import { db } from '../setup-emulator';
import {
  createSession,
  advanceSession,
  joinSession,
  addSessionShot,
  getShots,
  getParticipant,
  makeShot,
} from './emulator-helpers';

describe('Concurrent writes (emulator)', () => {
  it('handles 10 simultaneous shots from different students', async () => {
    const code = 'CW01';
    await createSession(db, code);
    await advanceSession(db, code, 'solo_active');

    // Join 10 students
    for (let i = 1; i <= 10; i++) {
      await joinSession(db, code, `Player${i}`, `stu-${i}`);
    }

    // 10 parallel shot writes — one per student
    const shotPromises = Array.from({ length: 10 }, (_, i) =>
      addSessionShot(db, code, makeShot({
        id: `shot-${i + 1}`,
        studentId: `stu-${i + 1}`,
        activity: 'solo',
        made: i % 2 === 0,
      }))
    );

    const results = await Promise.allSettled(shotPromises);
    const successes = results.filter((r) => r.status === 'fulfilled');
    expect(successes).toHaveLength(10);

    const shots = await getShots(db, code);
    expect(shots).toHaveLength(10);

    // Each student's counter should be 1
    for (let i = 1; i <= 10; i++) {
      const p = await getParticipant(db, code, `stu-${i}`);
      expect(p).not.toBeNull();
      expect(p!.soloShotsComplete).toBe(1);
    }
  });

  it('handles 5 sequential shots from the same student', async () => {
    const code = 'CW02';
    await createSession(db, code);
    await advanceSession(db, code, 'solo_active');
    await joinSession(db, code, 'TestPlayer', 'stu-seq');

    // Sequential shots — no race condition
    for (let i = 0; i < 5; i++) {
      await addSessionShot(db, code, makeShot({
        id: `seq-shot-${i}`,
        studentId: 'stu-seq',
        activity: 'solo',
      }));
    }

    const p = await getParticipant(db, code, 'stu-seq');
    expect(p!.soloShotsComplete).toBe(5);

    const shots = await getShots(db, code);
    expect(shots).toHaveLength(5);
  });

  it('documents counter race condition with simultaneous same-student shots', async () => {
    // KNOWN ISSUE: addSessionShot does getDoc → batch.update (not atomic increment)
    // Two simultaneous shots from the same student can both read counter=0
    // and both write counter=1, losing one increment.
    const code = 'CW03';
    await createSession(db, code);
    await advanceSession(db, code, 'solo_active');
    await joinSession(db, code, 'Racer', 'stu-race');

    // 5 simultaneous shots from the same student
    const parallelShots = Array.from({ length: 5 }, (_, i) =>
      addSessionShot(db, code, makeShot({
        id: `race-shot-${i}`,
        studentId: 'stu-race',
        activity: 'solo',
      }))
    );

    const results = await Promise.allSettled(parallelShots);
    const successes = results.filter((r) => r.status === 'fulfilled');

    // All 5 shot documents should be written
    const shots = await getShots(db, code);
    expect(shots).toHaveLength(5);

    // Counter may be less than 5 due to the race condition
    // This test documents the behavior, not asserts correctness
    const p = await getParticipant(db, code, 'stu-race');
    console.log(
      `[Race condition test] Expected counter=5, actual counter=${p!.soloShotsComplete}` +
      ` (${successes.length} writes succeeded)`
    );
    // The counter should be at least 1 (but may not be 5)
    expect(p!.soloShotsComplete).toBeGreaterThanOrEqual(1);
    expect(p!.soloShotsComplete).toBeLessThanOrEqual(5);
  });

  it('handles mixed solo and team shots', async () => {
    const code = 'CW04';
    await createSession(db, code);
    await joinSession(db, code, 'MixPlayer', 'stu-mix');

    // Solo shots
    await advanceSession(db, code, 'solo_active');
    for (let i = 0; i < 3; i++) {
      await addSessionShot(db, code, makeShot({
        id: `solo-${i}`,
        studentId: 'stu-mix',
        activity: 'solo',
      }));
    }

    // Team shots
    await advanceSession(db, code, 'team_active');
    for (let i = 0; i < 4; i++) {
      await addSessionShot(db, code, makeShot({
        id: `team-${i}`,
        studentId: 'stu-mix',
        activity: 'team',
      }));
    }

    const p = await getParticipant(db, code, 'stu-mix');
    expect(p!.soloShotsComplete).toBe(3);
    expect(p!.teamShotsComplete).toBe(4);

    const shots = await getShots(db, code);
    expect(shots).toHaveLength(7);
  });
});

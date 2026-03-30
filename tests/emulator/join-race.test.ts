/**
 * Integration Test: Join Race Conditions
 *
 * Tests concurrent join operations to document the TOCTOU race
 * condition in name uniqueness checking.
 *
 * Requires: firebase emulators:start --only firestore
 */
import { describe, it, expect } from 'vitest';
import { db } from '../setup-emulator';
import {
  createSession,
  advanceSession,
  joinSession,
  getParticipants,
} from './emulator-helpers';

describe('Join race conditions (emulator)', () => {
  it('10 simultaneous joins with unique names all succeed', async () => {
    const code = 'JR01';
    await createSession(db, code);

    const joins = Array.from({ length: 10 }, (_, i) =>
      joinSession(db, code, `UniquePlayer${i + 1}`, `stu-${i + 1}`)
    );

    const results = await Promise.allSettled(joins);
    const successes = results.filter((r) => r.status === 'fulfilled');
    expect(successes).toHaveLength(10);

    const participants = await getParticipants(db, code);
    expect(participants).toHaveLength(10);
  });

  it('sequential joins with duplicate name — second is rejected', async () => {
    const code = 'JR02';
    await createSession(db, code);

    await joinSession(db, code, 'DuplicateName', 'stu-first');

    // Second join with same name should fail
    await expect(
      joinSession(db, code, 'DuplicateName', 'stu-second')
    ).rejects.toThrow('Name taken');

    const participants = await getParticipants(db, code);
    expect(participants).toHaveLength(1);
    expect(participants[0].name).toBe('DuplicateName');
  });

  it('documents TOCTOU race: simultaneous joins with same name', async () => {
    // KNOWN ISSUE: joinSession reads participants, checks name, then writes.
    // Two simultaneous joins with the same name can both pass the check.
    const code = 'JR03';
    await createSession(db, code);

    const [result1, result2] = await Promise.allSettled([
      joinSession(db, code, 'RaceName', 'stu-race-1'),
      joinSession(db, code, 'RaceName', 'stu-race-2'),
    ]);

    const participants = await getParticipants(db, code);
    const raceNames = participants.filter((p) => p.name === 'RaceName');

    // Document the behavior: one or both may succeed
    console.log(
      `[TOCTOU test] result1: ${result1.status}, result2: ${result2.status}` +
      `, participants with name 'RaceName': ${raceNames.length}`
    );

    // At least one should succeed
    const anySuccess = result1.status === 'fulfilled' || result2.status === 'fulfilled';
    expect(anySuccess).toBe(true);

    // If both succeeded, we have a duplicate (demonstrates the race condition)
    if (raceNames.length > 1) {
      console.log('[TOCTOU test] RACE CONDITION DETECTED: duplicate names allowed');
    }
  });

  it('rejects join when session is in team_active', async () => {
    const code = 'JR04';
    await createSession(db, code);
    await advanceSession(db, code, 'team_active');

    await expect(
      joinSession(db, code, 'LateJoiner', 'stu-late')
    ).rejects.toThrow('Session already started');
  });

  it('rejects join when session is in team_review', async () => {
    const code = 'JR05';
    await createSession(db, code);
    await advanceSession(db, code, 'team_review');

    await expect(
      joinSession(db, code, 'VeryLate', 'stu-very-late')
    ).rejects.toThrow('Session already started');
  });

  it('rejects join to non-existent session', async () => {
    await expect(
      joinSession(db, 'NOPE99', 'Ghost', 'stu-ghost')
    ).rejects.toThrow('Session not found');
  });

  it('handles 25 students joining sequentially', async () => {
    const code = 'JR06';
    await createSession(db, code);

    for (let i = 1; i <= 25; i++) {
      await joinSession(db, code, `Student_${i}`, `stu-${i}`);
    }

    const participants = await getParticipants(db, code);
    expect(participants).toHaveLength(25);
  });
});

/**
 * Integration Test: Team Pairing
 *
 * Tests the pairTeams function with various participant counts
 * against the Firestore emulator.
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
  getSession,
  pairTeams,
} from './emulator-helpers';

async function setupSessionWithStudents(code: string, count: number) {
  await createSession(db, code);
  await advanceSession(db, code, 'solo_review');
  for (let i = 1; i <= count; i++) {
    await joinSession(db, code, `S${i}`, `stu-${i}`);
  }
}

describe('Team pairing (emulator)', () => {
  it('pairs 2 participants into 1 team', async () => {
    await setupSessionWithStudents('TP01', 2);
    await pairTeams(db, 'TP01');

    const participants = await getParticipants(db, 'TP01');
    expect(participants).toHaveLength(2);
    expect(participants[0].teamId).not.toBeNull();
    expect(participants[0].teamId).toBe(participants[1].teamId);

    const session = await getSession(db, 'TP01');
    expect(session!.status).toBe('team_strategy');
  });

  it('pairs 4 participants into 2 teams of 2', async () => {
    await setupSessionWithStudents('TP02', 4);
    await pairTeams(db, 'TP02');

    const participants = await getParticipants(db, 'TP02');
    const teams = new Map<string, string[]>();
    for (const p of participants) {
      const team = p.teamId!;
      if (!teams.has(team)) teams.set(team, []);
      teams.get(team)!.push(p.studentId);
    }

    expect(teams.size).toBe(2);
    for (const [, members] of teams) {
      expect(members).toHaveLength(2);
    }
  });

  it('pairs 7 participants: 2 pairs + 1 trio', async () => {
    await setupSessionWithStudents('TP03', 7);
    await pairTeams(db, 'TP03');

    const participants = await getParticipants(db, 'TP03');
    const teams = new Map<string, string[]>();
    for (const p of participants) {
      const team = p.teamId!;
      if (!teams.has(team)) teams.set(team, []);
      teams.get(team)!.push(p.studentId);
    }

    expect(teams.size).toBe(3);
    const sizes = Array.from(teams.values()).map((m) => m.length).sort();
    expect(sizes).toEqual([2, 2, 3]);
  });

  it('pairs 1 participant into a solo team', async () => {
    await setupSessionWithStudents('TP04', 1);
    await pairTeams(db, 'TP04');

    const participants = await getParticipants(db, 'TP04');
    expect(participants).toHaveLength(1);
    expect(participants[0].teamId).not.toBeNull();
  });

  it('pairs 25 participants correctly', async () => {
    await setupSessionWithStudents('TP05', 25);
    await pairTeams(db, 'TP05');

    const participants = await getParticipants(db, 'TP05');
    expect(participants).toHaveLength(25);

    // All should have teamIds
    expect(participants.every((p) => p.teamId !== null)).toBe(true);

    const teams = new Map<string, string[]>();
    for (const p of participants) {
      const team = p.teamId!;
      if (!teams.has(team)) teams.set(team, []);
      teams.get(team)!.push(p.studentId);
    }

    // 25 = 11 pairs + 1 trio = 12 teams
    expect(teams.size).toBe(12);

    const sizes = Array.from(teams.values()).map((m) => m.length).sort();
    // 11 teams of 2 and 1 team of 3
    expect(sizes.filter((s) => s === 2)).toHaveLength(11);
    expect(sizes.filter((s) => s === 3)).toHaveLength(1);
  });

  it('pairs 6 participants into exactly 3 teams of 2', async () => {
    await setupSessionWithStudents('TP06', 6);
    await pairTeams(db, 'TP06');

    const participants = await getParticipants(db, 'TP06');
    const teams = new Map<string, string[]>();
    for (const p of participants) {
      const team = p.teamId!;
      if (!teams.has(team)) teams.set(team, []);
      teams.get(team)!.push(p.studentId);
    }

    expect(teams.size).toBe(3);
    for (const [, members] of teams) {
      expect(members).toHaveLength(2);
    }
  });

  it('advances session status to team_strategy after pairing', async () => {
    await setupSessionWithStudents('TP07', 4);

    const before = await getSession(db, 'TP07');
    expect(before!.status).toBe('solo_review');

    await pairTeams(db, 'TP07');

    const after = await getSession(db, 'TP07');
    expect(after!.status).toBe('team_strategy');
  });
});

/**
 * Bot Simulation Script
 *
 * Spawns N bot players that join a session and play through the full
 * session lifecycle against a real or emulated Firestore instance.
 *
 * Usage:
 *   npx tsx scripts/bot-simulation.ts --emulator --bots 25
 *   npx tsx scripts/bot-simulation.ts --bots 10
 *
 * Requires:
 *   - Firebase emulator running (if --emulator flag is used)
 *   - Or real Firebase credentials in .env
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Types (duplicated to avoid import.meta.env issues)
// ---------------------------------------------------------------------------

type SessionStatus =
  | 'lobby'
  | 'solo_active'
  | 'solo_review'
  | 'team_strategy'
  | 'team_active'
  | 'team_review'
  | 'ended';

interface Session {
  sessionCode: string;
  status: SessionStatus;
  createdAt: number;
  hostDeviceId: string;
}

interface Participant {
  studentId: string;
  name: string;
  joinedAt: number;
  teamId: string | null;
  soloShotsComplete: number;
  teamShotsComplete: number;
}

interface Shot {
  id: string;
  x: number;
  y: number;
  made: boolean;
  timestamp: number;
  zone: string;
  studentId: string;
  activity: 'solo' | 'team';
}

// ---------------------------------------------------------------------------
// Zone definitions (from src/types.ts)
// ---------------------------------------------------------------------------

const ZONES = [
  { name: 'Zone 1: Paint', x: 250, y: 95 },
  { name: 'Zone 2: Left Mid-Range', x: 125, y: 240 },
  { name: 'Zone 3: Right Mid-Range', x: 375, y: 240 },
  { name: 'Zone 5: Top of Key', x: 250, y: 320 },
  { name: 'Zone 4: Left Outside', x: 125, y: 410 },
  { name: 'Zone 6: Right Outside', x: 375, y: 410 },
];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const useEmulator = args.includes('--emulator');
const botCountArg = args.find((a) => a.startsWith('--bots'));
const botCountIdx = args.indexOf('--bots');
const BOT_COUNT = botCountIdx >= 0 ? parseInt(args[botCountIdx + 1], 10) : 25;

if (isNaN(BOT_COUNT) || BOT_COUNT < 1) {
  console.error('Invalid bot count. Usage: --bots <number>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase initialization
// ---------------------------------------------------------------------------

const app = initializeApp({
  projectId: useEmulator ? 'basketball-test' : (process.env.VITE_FIREBASE_PROJECT_ID ?? 'basketball-test'),
  apiKey: useEmulator ? 'fake-api-key' : (process.env.VITE_FIREBASE_API_KEY ?? 'fake-api-key'),
  appId: useEmulator ? 'fake-app-id' : (process.env.VITE_FIREBASE_APP_ID ?? 'fake-app-id'),
});

const db = getFirestore(app);

if (useEmulator) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.log('[Bot] Connected to Firestore Emulator');
} else {
  console.log('[Bot] Connected to production Firebase');
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

const ADJECTIVES = [
  'Swift', 'Brave', 'Clever', 'Mighty', 'Quick', 'Bold', 'Calm', 'Keen',
  'Sharp', 'Wild', 'Cool', 'Fast', 'Bright', 'Fierce', 'Wise', 'Lucky',
  'Happy', 'Grand', 'Loud', 'Quiet', 'Smooth', 'Tough', 'Warm', 'Free',
  'Busy', 'Dark', 'Deep', 'Fair', 'Tall', 'True',
];

const NOUNS = [
  'Tiger', 'Eagle', 'Shark', 'Wolf', 'Bear', 'Hawk', 'Fox', 'Lion',
  'Panther', 'Falcon', 'Cobra', 'Otter', 'Raven', 'Bison', 'Moose',
  'Puma', 'Crane', 'Viper', 'Lynx', 'Drake', 'Stag', 'Owl', 'Ram',
  'Elk', 'Dove', 'Crow', 'Hare', 'Toad', 'Seal', 'Wren',
];

function generateName(index: number): string {
  const adj = ADJECTIVES[index % ADJECTIVES.length];
  const noun = NOUNS[index % NOUNS.length];
  return `${adj}${noun}${index + 1}`;
}

// ---------------------------------------------------------------------------
// Firestore operations (mirrors sessionService.ts)
// ---------------------------------------------------------------------------

async function createSession(code: string): Promise<void> {
  const session: Session = {
    sessionCode: code,
    status: 'lobby',
    createdAt: Date.now(),
    hostDeviceId: 'bot-teacher',
  };
  await setDoc(doc(db, 'sessions', code), session);
}

async function advanceSession(code: string, status: SessionStatus): Promise<void> {
  await updateDoc(doc(db, 'sessions', code), { status });
}

async function joinSessionAsBot(
  code: string,
  name: string,
  studentId: string
): Promise<void> {
  // Check name collision
  const participantsRef = collection(db, 'sessions', code, 'participants');
  const nameQuery = query(participantsRef, where('name', '==', name));
  const nameSnap = await getDocs(nameQuery);
  if (!nameSnap.empty) {
    throw new Error(`Name taken: ${name}`);
  }

  const participant: Participant = {
    studentId,
    name,
    joinedAt: Date.now(),
    teamId: null,
    soloShotsComplete: 0,
    teamShotsComplete: 0,
  };
  await setDoc(doc(db, 'sessions', code, 'participants', studentId), participant);
}

async function addShot(code: string, shot: Shot): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'sessions', code, 'shots', shot.id), shot);

  const participantRef = doc(db, 'sessions', code, 'participants', shot.studentId);
  const snap = await getDoc(participantRef);
  if (snap.exists()) {
    const data = snap.data() as Participant;
    if (shot.activity === 'team') {
      batch.update(participantRef, { teamShotsComplete: data.teamShotsComplete + 1 });
    } else {
      batch.update(participantRef, { soloShotsComplete: data.soloShotsComplete + 1 });
    }
  }
  await batch.commit();
}

async function pairTeams(code: string): Promise<void> {
  const snap = await getDocs(collection(db, 'sessions', code, 'participants'));
  const participants = snap.docs.map((d) => d.data() as Participant);

  // Fisher-Yates shuffle
  for (let i = participants.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [participants[i], participants[j]] = [participants[j], participants[i]];
  }

  const assignments = new Map<string, string>();
  let pairIdx = 0;
  let i = 0;
  while (i < participants.length) {
    const rem = participants.length - i;
    const teamId = `team-${pairIdx + 1}`;
    if (rem === 1) {
      assignments.set(participants[i].studentId, teamId);
      break;
    } else if (rem <= 3) {
      for (let j = i; j < participants.length; j++) {
        assignments.set(participants[j].studentId, teamId);
      }
      break;
    } else {
      assignments.set(participants[i].studentId, teamId);
      assignments.set(participants[i + 1].studentId, teamId);
      i += 2;
      pairIdx++;
    }
  }

  const batch = writeBatch(db);
  for (const p of participants) {
    batch.update(
      doc(db, 'sessions', code, 'participants', p.studentId),
      { teamId: assignments.get(p.studentId) ?? null }
    );
  }
  batch.update(doc(db, 'sessions', code), { status: 'team_strategy' });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Bot behavior
// ---------------------------------------------------------------------------

interface Bot {
  name: string;
  studentId: string;
  soloShots: number;
  teamShots: number;
  undos: number;
  errors: string[];
}

function createShot(studentId: string, activity: 'solo' | 'team'): Shot {
  const zone = ZONES[randomBetween(0, ZONES.length - 1)];
  return {
    id: generateId(),
    x: zone.x + randomBetween(-30, 30),
    y: zone.y + randomBetween(-30, 30),
    made: Math.random() < 0.6,
    timestamp: Date.now(),
    zone: zone.name,
    studentId,
    activity,
  };
}

async function botShootPhase(
  code: string,
  bot: Bot,
  activity: 'solo' | 'team',
  maxShots: number
): Promise<void> {
  const shouldUndo = Math.random() < 0.1; // 10% chance to undo one shot
  const undoAt = shouldUndo ? randomBetween(3, maxShots - 2) : -1;

  for (let i = 0; i < maxShots; i++) {
    try {
      await addShot(code, createShot(bot.studentId, activity));
      if (activity === 'solo') bot.soloShots++;
      else bot.teamShots++;

      if (i === undoAt) {
        // Simulate undo (skip for simplicity — just note it)
        bot.undos++;
      }
    } catch (err) {
      bot.errors.push(`Shot error (${activity} #${i}): ${err}`);
    }

    // Random delay between shots
    await sleep(randomBetween(50, 200));
  }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

async function verify(code: string, bots: Bot[]): Promise<boolean> {
  let allGood = true;

  // Read final state
  const sessionSnap = await getDoc(doc(db, 'sessions', code));
  const session = sessionSnap.data() as Session;

  const participantsSnap = await getDocs(collection(db, 'sessions', code, 'participants'));
  const participants = participantsSnap.docs.map((d) => d.data() as Participant);

  const shotsSnap = await getDocs(collection(db, 'sessions', code, 'shots'));
  const shots = shotsSnap.docs.map((d) => d.data() as Shot);

  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION REPORT');
  console.log('='.repeat(70));

  // Session status
  console.log(`\nSession status: ${session.status}`);
  if (session.status !== 'ended') {
    console.log('  ❌ Expected: ended');
    allGood = false;
  } else {
    console.log('  ✅ Correct');
  }

  // Participant count
  console.log(`\nParticipants: ${participants.length} (expected ${bots.length})`);
  if (participants.length !== bots.length) {
    console.log('  ❌ Mismatch!');
    allGood = false;
  } else {
    console.log('  ✅ Correct');
  }

  // Total shots
  const expectedSoloShots = bots.reduce((sum, b) => sum + b.soloShots, 0);
  const expectedTeamShots = bots.reduce((sum, b) => sum + b.teamShots, 0);
  const actualSoloShots = shots.filter((s) => s.activity === 'solo').length;
  const actualTeamShots = shots.filter((s) => s.activity === 'team').length;

  console.log(`\nSolo shots: ${actualSoloShots} (bots recorded ${expectedSoloShots})`);
  console.log(`Team shots: ${actualTeamShots} (bots recorded ${expectedTeamShots})`);
  console.log(`Total shots: ${shots.length}`);

  // Team assignments
  const withTeams = participants.filter((p) => p.teamId !== null);
  console.log(`\nTeam assignments: ${withTeams.length}/${participants.length} have teamIds`);
  if (withTeams.length !== participants.length) {
    console.log('  ❌ Not all participants have team assignments');
    allGood = false;
  } else {
    console.log('  ✅ All assigned');
  }

  // Print bot summary table
  console.log('\n' + '-'.repeat(70));
  console.log(
    'Name'.padEnd(25) +
    'Solo'.padEnd(8) +
    'Team'.padEnd(8) +
    'Undos'.padEnd(8) +
    'Errors'.padEnd(8) +
    'TeamId'
  );
  console.log('-'.repeat(70));

  for (const bot of bots) {
    const participant = participants.find((p) => p.studentId === bot.studentId);
    const teamId = participant?.teamId ?? 'N/A';
    console.log(
      bot.name.padEnd(25) +
      String(bot.soloShots).padEnd(8) +
      String(bot.teamShots).padEnd(8) +
      String(bot.undos).padEnd(8) +
      String(bot.errors.length).padEnd(8) +
      teamId
    );
  }

  // Counter consistency check
  console.log('\n' + '-'.repeat(70));
  console.log('Counter consistency check:');
  let counterMismatches = 0;
  for (const bot of bots) {
    const p = participants.find((pp) => pp.studentId === bot.studentId);
    if (!p) continue;
    const actualSolo = shots.filter(
      (s) => s.studentId === bot.studentId && s.activity === 'solo'
    ).length;
    const actualTeam = shots.filter(
      (s) => s.studentId === bot.studentId && s.activity === 'team'
    ).length;

    if (p.soloShotsComplete !== actualSolo) {
      console.log(`  ❌ ${bot.name}: soloShotsComplete=${p.soloShotsComplete} but actual=${actualSolo}`);
      counterMismatches++;
    }
    if (p.teamShotsComplete !== actualTeam) {
      console.log(`  ❌ ${bot.name}: teamShotsComplete=${p.teamShotsComplete} but actual=${actualTeam}`);
      counterMismatches++;
    }
  }
  if (counterMismatches === 0) {
    console.log('  ✅ All counters match');
  } else {
    console.log(`  ❌ ${counterMismatches} counter mismatches (possible race condition)`);
    allGood = false;
  }

  console.log('\n' + '='.repeat(70));
  console.log(allGood ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
  console.log('='.repeat(70));

  return allGood;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🏀 Bot Simulation — ${BOT_COUNT} bots, ${useEmulator ? 'emulator' : 'production'}\n`);

  const code = `BOT${Date.now().toString(36).slice(-4).toUpperCase()}`;
  console.log(`Creating session: ${code}`);
  await createSession(code);

  // Create bots
  const bots: Bot[] = Array.from({ length: BOT_COUNT }, (_, i) => ({
    name: generateName(i),
    studentId: generateId(),
    soloShots: 0,
    teamShots: 0,
    undos: 0,
    errors: [],
  }));

  // Intentionally duplicate 2 names to test "Name taken" path
  if (bots.length >= 4) {
    bots[3].name = bots[0].name;
  }

  // --- PHASE: JOIN ---
  console.log(`\n📥 Joining ${BOT_COUNT} bots...`);
  const joinResults = await Promise.allSettled(
    bots.map(async (bot, i) => {
      await sleep(randomBetween(50, 300));
      try {
        await joinSessionAsBot(code, bot.name, bot.studentId);
        console.log(`  ✅ ${bot.name} joined`);
      } catch (err: any) {
        console.log(`  ⚠️  ${bot.name} failed: ${err.message}`);
        // Retry with modified name
        bot.name = bot.name + '_retry';
        await joinSessionAsBot(code, bot.name, bot.studentId);
        console.log(`  ✅ ${bot.name} joined (retry)`);
      }
    })
  );

  const joinedCount = joinResults.filter((r) => r.status === 'fulfilled').length;
  console.log(`  Joined: ${joinedCount}/${BOT_COUNT}`);

  // --- PHASE: SOLO_ACTIVE ---
  console.log('\n🏀 Solo phase — 15 shots each...');
  await advanceSession(code, 'solo_active');

  await Promise.allSettled(
    bots.map((bot) => botShootPhase(code, bot, 'solo', 15))
  );
  console.log('  Solo phase complete');

  // --- PHASE: SOLO_REVIEW ---
  console.log('\n👀 Solo review...');
  await advanceSession(code, 'solo_review');
  await sleep(1000);

  // --- PHASE: TEAM_STRATEGY ---
  console.log('\n🤝 Pairing teams...');
  await pairTeams(code);
  console.log('  Teams paired');
  await sleep(1000);

  // --- PHASE: TEAM_ACTIVE ---
  console.log('\n🏀 Team phase — 20 shots each...');
  await advanceSession(code, 'team_active');

  await Promise.allSettled(
    bots.map((bot) => botShootPhase(code, bot, 'team', 20))
  );
  console.log('  Team phase complete');

  // --- PHASE: TEAM_REVIEW ---
  console.log('\n👀 Team review...');
  await advanceSession(code, 'team_review');
  await sleep(1000);

  // --- PHASE: ENDED ---
  console.log('\n🏁 Ending session...');
  await advanceSession(code, 'ended');

  // --- VERIFICATION ---
  const passed = await verify(code, bots);
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

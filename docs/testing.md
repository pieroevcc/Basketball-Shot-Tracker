# Testing

## Setup

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (Jest-compatible API) |
| **@testing-library/react** | Component rendering utilities |
| **@testing-library/user-event** | Simulates real user interactions |
| **@testing-library/jest-dom** | Custom DOM matchers (`.toBeInTheDocument()`, etc.) |
| **jsdom** | Browser-like DOM environment for Node |
| **Playwright** | E2E browser testing with multiple contexts |
| **tsx** | TypeScript execution for bot simulation scripts |

### Configuration

**`vitest.config.ts`** — merges the Vite config then adds:

```ts
test: {
  environment: 'jsdom',   // simulate browser DOM
  globals: true,          // no need to import describe/it/expect
  setupFiles: ['./tests/setup.ts'],
  css: true,
}
```

**`vitest.config.emulator.ts`** — separate config for Firebase Emulator integration tests:

```ts
test: {
  environment: 'node',    // no browser DOM needed
  globals: true,
  setupFiles: ['./tests/setup-emulator.ts'],
  include: ['tests/emulator/**/*.test.ts'],
  testTimeout: 30000,
}
```

**`tests/setup.ts`** — runs before every unit test:
- Imports `@testing-library/jest-dom` for DOM matchers
- Replaces `window.localStorage` with a fully functional in-memory mock

**`tests/setup-emulator.ts`** — runs before emulator integration tests:
- Initializes Firebase client SDK against the local emulator
- Clears all Firestore data between tests
- Exports `db` instance for test files

---

## Running Tests

| Command | What it runs | Prerequisites |
|---------|-------------|---------------|
| `npm test` | All Vitest tests (watch mode) | None |
| `npm run test:unit` | Multi-user Vitest tests only | None |
| `npm run test:emulator:start` | Start Firestore emulator | `firebase-tools` installed |
| `npm run test:emulator` | Emulator integration tests | Emulator running |
| `npm run test:emulator:ci` | Start emulator + run tests | `firebase-tools` installed |
| `npm run test:e2e` | Playwright E2E tests | Emulator + dev server |
| `npm run test:e2e:ui` | Playwright in UI mode | Emulator + dev server |
| `npm run test:bots` | Bot simulation (25 bots) | Emulator running |
| `npm run test:all` | Unit + emulator + E2E | All prerequisites |

### Quick start

```bash
# Unit tests only (no setup needed)
npm test

# Emulator integration tests
npm run test:emulator:start    # Terminal 1
npm run test:emulator          # Terminal 2

# Bot simulation
npm run test:emulator:start    # Terminal 1
npm run test:bots              # Terminal 2

# E2E tests
npm run test:emulator:start    # Terminal 1 (if using emulator)
npm run test:e2e               # Terminal 2 (auto-starts dev server)
```

---

## Test Suites

### 1. Vitest Unit Tests (Mocked)

Located in `tests/` and `tests/multi-user/`. These mock Firebase and use snapshot callbacks to test React component behavior.

**Shared helpers** (`tests/helpers.ts`):
- `setupSubscribeMocks()` — captures onSnapshot callbacks, returns `pushSession`, `pushParticipants`, `pushShots`, `hydrate`
- `createMockParticipant()`, `createMockShot()`, `sessionSnapshot()` — fixture generators
- `setStudentLocalStorage()`, `setTeacherLocalStorage()` — localStorage setup

#### `tests/session-transition.test.tsx` (3 tests)

| Test | What it verifies |
|------|-----------------|
| Shows Lobby when status is lobby | Lobby component renders |
| Transitions from Lobby to Solo Activity | Status change via onSnapshot |
| Shows BasketballCourt with maxShots=15 | Solo activity shot counter |

#### `tests/multi-user/full-lifecycle.test.tsx` (8 tests)

Full session state machine with 5 participants through all 7 states:
LOBBY → SOLO_ACTIVE → SOLO_REVIEW → TEAM_STRATEGY → TEAM_ACTIVE → TEAM_REVIEW → ENDED

#### `tests/multi-user/shot-limits.test.tsx` (6 tests)

| Test | What it verifies |
|------|-----------------|
| Solo shot counter | Shows current/max (e.g., "5 / 15 shots") |
| Approaching limit | 14/15 display |
| At limit | 15/15 display (court locked) |
| Only own shots count | Other students' shots filtered |
| Team shot counter | Shows x/20 during team_active |
| Team limit | 20/20 display |

#### `tests/multi-user/concurrent-join.test.tsx` (5 tests)

Tests teacher lobby updating as 3→5→20→30 participants join via snapshot updates.

#### `tests/multi-user/concurrent-shots.test.tsx` (5 tests)

Tests shot filtering when multiple students' shots arrive interleaved. Includes 25-student × 15-shot (375 total) stress test.

#### `tests/multi-user/team-pairing.test.tsx` (5 tests)

Tests Team Strategy and Team Review components with team assignments, including trio teams and 24-student scenarios.

#### `tests/multi-user/realtime-sync.test.tsx` (5 tests)

Tests snapshot replacement, mixed solo/team shots, empty snapshots, and performance with 375 shot documents.

---

### 2. Firebase Emulator Integration Tests

Located in `tests/emulator/`. These run against a real Firestore emulator (no mocking) to test actual database operations.

#### `tests/emulator/session-lifecycle.test.ts`

- Creates session, verifies document exists
- 5 parallel joins, verifies participant count
- Advances through all states
- Complete 5-student session with shot recording and counter verification

#### `tests/emulator/concurrent-writes.test.ts`

- 10 simultaneous shots from different students
- 5 sequential shots from same student
- **Documents race condition**: simultaneous same-student shots can lose counter increments
- Mixed solo and team shots

#### `tests/emulator/join-race.test.ts`

- 10 simultaneous joins with unique names
- Sequential duplicate name rejection
- **Documents TOCTOU race**: simultaneous joins with same name may both succeed
- Late join rejection (team_active, team_review, non-existent session)
- 25-student sequential join

#### `tests/emulator/team-pairing.test.ts`

- 2 participants → 1 team
- 4 participants → 2 teams of 2
- 7 participants → 2 pairs + 1 trio
- 1 participant → solo team
- 25 participants → 12 teams (11 pairs + 1 trio)
- Status advances to team_strategy

---

### 3. Bot Simulation Script

Located at `scripts/bot-simulation.ts`. Spawns 25 bots that play through the full session lifecycle.

**Lifecycle:**
1. Teacher creates session
2. Bots join with staggered delays (50-300ms)
3. Solo phase: 15 shots each with 50-200ms intervals
4. Solo review: 1s pause
5. Team pairing (Fisher-Yates shuffle)
6. Team phase: 20 shots each
7. Team review → ended

**Verification report:**
- Session final status = ended
- Participant count matches bot count
- Shot counts (solo + team)
- Team assignments (all have teamIds)
- Counter consistency (soloShotsComplete/teamShotsComplete match actual shot docs)
- Per-bot summary table

**Edge cases tested:**
- 2 bots intentionally share a name → "Name taken" error → auto-retry with suffix
- 10% of bots undo one shot mid-round

---

### 4. Playwright E2E Tests

Located in `e2e/`. Use multiple browser contexts to simulate teacher + students.

#### `e2e/multi-user-session.spec.ts`

**Full lifecycle test** (1 teacher + 4 students):
- Teacher creates session
- 4 students join in separate browser contexts
- Teacher sees all students in lobby
- Teacher starts solo → students record shots → teacher ends solo
- Students see solo review heatmap
- Teacher pairs teams → students see team strategy
- Team shots → team review → session ended

**Edge case tests:**
- Duplicate name rejection

---

## Known Race Conditions

The test suite documents (but does not fix) these concurrency issues:

| Issue | Where | Impact |
|-------|-------|--------|
| **TOCTOU name check** | `joinSession()` reads then writes | Two simultaneous joins with same name can both succeed |
| **Counter increment** | `addSessionShot()` getDoc → batch.update | Two simultaneous shots from same student can lose an increment |
| **Client-only shot limit** | `BasketballCourt.tsx` | Nothing at Firestore level prevents >15 or >20 shots |

**Recommended fixes:**
- Use `FieldValue.increment(1)` for atomic counter updates
- Use Firestore transactions for name uniqueness checks

---

## Legacy Test Files

| File | Status | Notes |
|------|--------|-------|
| `tests/App.test.tsx` | Outdated | References removed ModeSelector component |
| `tests/ModeSelector.test.tsx` | Outdated | Component no longer exists |
| `tests/BasketballCourt.test.tsx` | Active | SVG court rendering and interaction |
| `tests/StatsDisplay.test.tsx` | Active | Stats panel display |
| `tests/ShotHistory.test.tsx` | Active | Shot history list |

---

## Coverage Areas

| Area | Covered by |
|------|-----------|
| Session state machine (all 7 states) | full-lifecycle, session-transition |
| Multi-user concurrent joins | concurrent-join, join-race (emulator) |
| Shot recording and filtering | concurrent-shots, shot-limits |
| Team pairing (2/4/7/25 participants) | team-pairing (mocked + emulator) |
| Real-time sync with large data | realtime-sync |
| Counter atomicity | concurrent-writes (emulator) |
| Full lifecycle (real Firestore) | session-lifecycle (emulator) |
| 25-bot stress test | bot-simulation script |
| Multi-browser E2E | Playwright tests |
| Court SVG rendering | BasketballCourt.test |
| Stats calculations | StatsDisplay.test |
| Shot history display | ShotHistory.test |

# Project Implementation Timeline

Derived from actual file changes in each commit, not commit messages alone.

---

## March 2 — Project Bootstrap

**Commits:** `a6a26fa`, `5ccc3b7`

Full Vite + React + TypeScript scaffold created from scratch. Core shot-tracking components built in one commit:

- `src/App.tsx` — root component with student/mentor routing
- `src/types.ts` — `Shot`, `Stats`, zone definitions, `calculateStats()`
- `src/components/BasketballCourt.tsx` — interactive SVG court with 6 zones
- `src/components/ModeSelector.tsx` — student vs. mentor mode picker
- `src/components/ShotHistory.tsx` — scrollable shot log
- `src/components/StatsDisplay.tsx` — zone-by-zone stats grid

---

## March 2 — Testing Infrastructure

**Commits:** `c4ddb16`, `1f267d4`

Vitest + Testing Library test suite wired up alongside Vitest config:

- `tests/App.test.tsx`
- `tests/BasketballCourt.test.tsx`
- `tests/ModeSelector.test.tsx`
- `tests/ShotHistory.test.tsx`
- `tests/StatsDisplay.test.tsx`
- `tests/setup.ts`
- `vitest.config.ts`

---

## March 2 — Firebase Integration & MentorDashboard

**Commit:** `fc9172b`

Firebase connected; practice-mode data layer built; mentor view introduced:

- `src/firebase.ts` — Firebase app initialization
- `src/services/shotsService.ts` — Firestore reads/writes for shots
- `src/hooks/useShots.ts` — React hook wrapping shotsService
- `src/components/CourtHeatmap.tsx` — read-only heatmap (reused across modes)
- `src/components/MentorDashboard.tsx` — mentor-facing view with heatmap + stats
- `CLAUDE.md` — project context file for AI tooling
- `.env.example` — Firebase config template

---

## March 3 — Documentation

**Commits:** `084729f`, `8096a2a`

Full `docs/` folder written from scratch:

- `docs/architecture.md`, `docs/components.md`, `docs/data-model.md`
- `docs/features.md`, `docs/testing.md`, `docs/README.md`
- `docs/PRD.md` — product requirements document

---

## March 4 — Live Session System

**Commit:** `580d38a`

The entire Firebase-backed multi-user session mode built in one large commit:

**New components:**
- `src/components/SessionCreate.tsx` — teacher creates a session, displays join code
- `src/components/SessionJoin.tsx` — student enters code + name to join
- `src/components/Lobby.tsx` — student waiting room (editable name)
- `src/components/TeacherLobby.tsx` — teacher control panel (advances all phases)
- `src/components/SessionEnded.tsx` — end-of-session results screen
- `src/components/TeamReview.tsx` — combined team heatmap + stats
- `src/components/TeamStrategy.tsx` — side-by-side solo vs. team heatmap comparison
- `src/utils/nicknames.ts` — random nickname generator for join screen

**New services / hooks:**
- `src/hooks/useSession.ts` — real-time Firestore `onSnapshot` session hook
- `src/services/sessionService.ts` — all session Firestore ops (create, join, advance, shots, undo)

**New tests:**
- `tests/session-transition.test.tsx` — verifies LOBBY→SOLO_ACTIVE state transition

**Session state machine introduced:** `LOBBY → SOLO_ACTIVE → SOLO_REVIEW → TEAM_STRATEGY → TEAM_ACTIVE → TEAM_REVIEW → ENDED`

---

## March 5 — Firebase Hosting & Deployment Config

**Commit:** `7d878f4`

App deployed to Firebase Hosting; production config files added:

- `.firebaserc` — project alias
- `firebase.json` — hosting + Firestore rules config
- `firestore.indexes.json` — composite Firestore indexes

---

## March 11 — TeacherLobby Refinements

**Commit:** `0dbf1d4`

Minor UI and routing edits: `TeacherLobby.tsx/css` and `App.tsx` adjusted.

---

## March 30 — Game Mechanics, Bot Simulator & Playwright E2E Tests

**Commit:** `64e3678`

Major batch of new features and testing infrastructure:

**New game mechanics:**
- `src/components/SabotagePanel.tsx` — teacher "sabotage" mechanic (disrupts student shots)
- `src/components/ShotAllocationPanel.tsx` — shot allocation UI for team phase

**New test infrastructure:**
- `e2e/multi-user-session.spec.ts` — Playwright multi-user session E2E test
- `e2e/fixtures/session-helpers.ts` — shared test helpers
- `e2e/playwright.config.ts` — Playwright config
- `scripts/bot-simulation.ts` — automated bot that plays through a full session (525 lines)

**Major updates:**
- `TeacherLobby.tsx` — overhauled to support new game mechanics
- `SessionEnded.tsx` — class overview tab + per-team results tabs added

---

## March 30 — Landing Page Routing Fix

**Commit:** `ff5880f`

`App.tsx` slimmed down; landing page routing bug corrected; `SessionJoin.tsx` tweaked.

---

## April 3 — Firebase Hosting Fix + Session Hardening

**Commit:** `910bd84`

Firebase hosting deployment issues resolved; `sessionService.ts` and `useSession.ts` hardened against edge cases; new fields added to `types.ts`.

---

## April 3 — MentorDashboard & ShotHistory Redesign (Sai)

**Commit:** `e20b01b`

Complete visual and functional overhaul of the mentor/practice experience:

- `MentorDashboard.tsx/css` — top-player stats, shot streak bar, sparkline, coaching insights
- `ShotHistory.tsx/css` — filter by student and shot type; edit/delete buttons added
- `CourtHeatmap.tsx` — zone number watermarks overlaid on heatmap

---

## April 5 — TestMode Component; ModeSelector Removed

**Commit:** `7f45a8a`

- `src/components/TestMode.tsx/css` — dedicated in-app test/debug mode component added
- `src/components/ModeSelector.tsx/css` — **deleted** (superseded by new app routing)
- `tests/ModeSelector.test.tsx` — **deleted** (component no longer exists)

---

## April 6 — Multi-Branch UI Merge Day

Four branches merged into main in a single day:

### Eyosyas Branch (`357b34a` → merged `1cfd77b`)

- `CourtHeatmap.tsx/css` — visual overhaul
- `MentorDashboard.tsx` — restructured layout
- `StatsDisplay.tsx/css` — redesigned stats grid
- `SessionCreate.tsx/css` — updated styles

### Preston Branch (merged `390ff67`)

- `src/components/TopStats.tsx/css` — **new** top-level summary stats component
- `StatsDisplay.tsx/css` — dropdown selector, zone breakdown, strategy tips added
- `App.tsx` — tab-based navigation (Court / Stats / History) for practice mode
- `ShotHistory.tsx` — tab-aware shot log

### Sai Branch (merged `3bfa01c`)

- `MentorDashboard.tsx/css` — coaching insights, streak visualization, sparklines
- `ShotHistory.tsx/css` — filter by student/shot-type; edit/delete per shot
- `CourtHeatmap.tsx` — dark rect backgrounds on stat labels

### Post-merge Cleanup (`1bd722c`)

- `src/components/PracticeMode.tsx` — **new** dedicated practice mode component (logic extracted from App.tsx)
- `src/components/CreateSession.tsx/css` — **deleted** (functionality moved elsewhere)
- `src/components/ModeSelector.css` — **deleted**
- `TeacherLobby.tsx/css` — restructured; kick-btn styles replaced

### Full UI Integration (`9a43034`)

- `src/components/PracticeMode.tsx/css` — finalized with full CSS
- `src/components/SabotagePanel.css` — full stylesheet added
- `src/components/ShotAllocationPanel.css` — full stylesheet added
- `src/components/TeamStrategy.css` — full stylesheet added
- `src/components/TopStats.tsx/css` — **deleted** (absorbed into StatsDisplay)
- `TeamStrategy.tsx` — redesigned layout
- `SabotagePanel.tsx` — rebuilt with new styles

---

## April 6 — Session UI Polish

**Commit:** `cc2ecb0`

- `ShotAllocationPanel.tsx/css` — expanded functionality and layout
- `SessionJoin.css` — layout refinements
- `ShotHistory.tsx/css` — polish pass

---

## April 8 — Logic Overhaul, Firestore Security Rules & FeedbackPopup

**Commit:** `ecccc85`

- `firestore.rules` — **new** Firestore security rules written
- `src/components/FeedbackPopup.css` — **new** popup component CSS scaffolded
- `sessionService.ts` — major rewrite of core session logic
- `useSession.ts` — updated to match new service
- `TeacherLobby.tsx/css` — significantly expanded (114 lines of new CSS)
- `TeamReview.tsx` — updated with new session data shape
- `SabotagePanel.tsx/css` — extended with new mechanics

---

## April 8 — UI Polish, Rate Limiting & Expanded Firestore Rules

**Commit:** `b8c427c`

- `src/utils/rateLimit.ts` — **new** client-side rate-limiting utility
- `firestore.rules` — significantly expanded (82 lines added)
- `SessionEnded.tsx/css` — visual overhaul (144 lines CSS added)
- `TeamReview.tsx/css` — styled up (85 lines CSS added)
- `BasketballCourt.tsx/css` — visual refinements
- `CourtHeatmap.tsx/css` — style updates
- `SabotagePanel.tsx/css` — rebuilt with cleaner layout
- `src/utils/nicknames.ts` — expanded nickname list

---

## April 10 — Leaderboard, Final Logic & UI

**Commit:** `e0197d9`

- `src/components/Leaderboard.tsx/css` — **new** leaderboard component for session end screen
- `TeacherLobby.tsx/css` — finalized teacher flow
- `TeamStrategy.tsx/css` — strategy phase finalized
- `SabotagePanel.tsx/css` — final mechanics pass
- `ShotAllocationPanel.tsx/css` — final layout
- `sessionService.ts` — final service logic pass
- `TestMode.tsx` — expanded with additional test scenarios (52 lines added)
- `App.tsx` — final routing and session integration

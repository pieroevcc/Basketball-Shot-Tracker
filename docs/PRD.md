# Basketball Shot Tracker — Product Requirements Document

> Last updated after full design interview. All decisions confirmed with stakeholder.

---

## 1. Overview

### Purpose
Transform the Basketball Shot Tracker from a single-device tool into a **live, classroom-wide session experience** (similar to Kahoot). A teacher starts a session, students join using a session code, and the group moves through two structured activities together in real-time.

### Physical Context
Students are playing a **tabletop mini basketball game** — physically shooting a small ball at a mini hoop. After each shot, the student taps the **zone on screen that corresponds to where they were standing** when they shot. The app records whether the shot was made or missed for that zone.

### Target Users
- **Students** — ages 10–14, after-school program, using Chromebooks/laptops on reliable school wifi
- **Teacher/Mentor** — controls session pacing, monitors all student progress, projects their screen

### Success Criteria
- Teacher can start a session and see students join within 30 seconds
- Students can join with just a code and a name (no login required)
- All students' screens advance automatically when the teacher advances the phase
- Students see meaningful heatmap visualizations of their own and their team's data at the end

---

## 2. User Roles

| Role | How They Enter | What They Control |
|------|---------------|-----------------|
| **Teacher** | Clicks "Create Session" | Starts and manually advances each phase; sees all student progress |
| **Student** | Types session code + name | Records shots during active shooting phases |

No password or PIN required for either role — UI separation is sufficient.

---

## 3. Landing Page (replaces current ModeSelector)

Three options on the landing page:

| Button | Who uses it | What it does |
|--------|------------|-------------|
| **Join Session** | Students | Code + name entry → Student Lobby |
| **Create Session** | Teacher | Generates session in Firestore → Teacher Lobby |
| **Practice Mode** | Anyone | Opens existing single-device student/mentor mode (kept for offline use) |

> **Note:** The existing single-device student/mentor mode is preserved as "Practice Mode." The new session system is the primary path.

---

## 4. Session State Machine

The teacher manually advances all transitions. There are no auto-timers.

```
LOBBY
  ↓  Teacher: "Start Solo Activity"
SOLO_ACTIVE       ← students record up to 15 shots
  ↓  Teacher: "End Solo & Show Review"
SOLO_REVIEW       ← students see personal heatmap + stats (read-only)
  ↓  Teacher: "Pair Teams & Start Strategy"
TEAM_STRATEGY     ← auto-paired; students see own + teammate's heatmap side-by-side
  ↓  Teacher: "Start Team Shooting"
TEAM_ACTIVE       ← students record up to 20 shots; teammate counter visible in real-time
  ↓  Teacher: "Show Team Results"
TEAM_REVIEW       ← students see combined team heatmap + stats
  ↓  Teacher: "End Session"
ENDED
```

---

## 5. Screens & Feature Requirements

### 5.1 Join Session Screen

**Fields:**
- Session code input (6 characters, auto-uppercase, case-insensitive on submit)
- Name input — required

**Nickname generator:**
- A "🎲 Generate Name" button fills the name field with a random fun nickname (e.g., "SpeedyHooper", "CoolShark42")
- Student can override with their real name or keep the generated one
- Provides a fun, low-friction entry point for kids

**Validation:**
- If code doesn't exist in Firestore → "Session not found. Check the code and try again."
- If session status is `TEAM_STRATEGY` or later → "This session has already started. Ask your teacher."
- If the name is already taken in this session → "That name is taken — choose another or generate one."
- Late joiners allowed: students can join during `SOLO_ACTIVE` and `SOLO_REVIEW` phases

**On success:** Student's `studentId` (UUID), `studentName`, and `sessionCode` saved to `localStorage`.

---

### 5.2 Student Lobby Screen

**Shown when:** Student joined; session status = `LOBBY`

- "Waiting for your teacher to start..." (large, friendly message)
- Shows student's name and session code for reference
- Name is editable here — student can update their display name before session starts
- Automatically transitions when teacher advances to `SOLO_ACTIVE`

---

### 5.3 Teacher Lobby Screen

**Shown when:** Teacher created session; status = `LOBBY`

- **Session code displayed large** at top (designed for projector visibility + easy to read aloud)
  - Character set excludes visually ambiguous characters: `O`, `0`, `I`, `1`, `L`
  - Uses only: `A-Z` (minus I, L, O) and `2-9`
- Real-time list of joined students (updates live via `onSnapshot`)
- "Start Solo Activity" button (requires ≥ 2 students to be enabled)

---

### 5.4 Solo Activity Screen (Student)

**Shown when:** Session status = `SOLO_ACTIVE`

- **Reuses `BasketballCourt` component** — `maxShots` prop = `15`
- Shot counter above court: **"Shot 4 / 15"**
- Shot recording flow (unchanged from current): tap zone → Made 🎯 / Missed ❌ / Cancel
- **"Undo Last Shot" button** — removes the most recent shot from Firestore and decrements counter
- Students see **only their own progress** — no classmate counts shown
- After 15th shot:
  - Confetti/emoji burst celebration animation
  - Court locks (non-interactive)
  - Message: "Nice work! 🏀 Waiting for your classmates to finish..."
- Shots written to Firestore with `activity: 'solo'` and `studentId`

---

### 5.5 Teacher Solo Monitor Screen

**Shown when:** Session status = `SOLO_ACTIVE`

- Real-time progress table (updates via `onSnapshot` on participants):
  - Student name | Shot count | Progress bar | Status
  - e.g., `Sarah — 12 / 15 ████████░░ In Progress`
  - e.g., `Marcus — 15 / 15 ██████████ ✓ Done`
- "End Solo & Show Review" button → writes `status: 'solo_review'` to Firestore

---

### 5.6 Solo Review Screen (Student)

**Shown when:** Session status = `SOLO_REVIEW`

- **Reuses `CourtHeatmap` + `StatsDisplay` components** — read-only, student's solo shots only
- Message: "Review your shooting! Your teacher will pair you with a teammate soon. 👀"
- Personal stats only — no class average or peer comparison in v1
- Automatically transitions when teacher advances to `TEAM_STRATEGY`

---

### 5.7 Team Strategy Screen (Student)

**Shown when:** Session status = `TEAM_STRATEGY`

**Layout:** Two `CourtHeatmap` components side-by-side:
- Left: **"Your Heatmap"** — own solo shots
- Right: **"[Teammate Name]'s Heatmap"** — teammate's solo shots

**Prompt (brief, minimal):**
> "Look at both heatmaps. 🔥 = hot zone, ❄️ = cold zone. Talk with your teammate: who should shoot from where?"

- No in-app input needed — verbal discussion only
- Phase is **very brief** (30s–1min), so UI must be instantly readable
- Automatically transitions when teacher advances to `TEAM_ACTIVE`

---

### 5.8 Teacher Team Strategy Screen

**Shown when:** Session status = `TEAM_STRATEGY`

- Shows auto-generated team pairings:
  - e.g., "Team 1: Sarah + Marcus", "Team 2: Destiny + Jordan"
- "Start Team Shooting" button → writes `status: 'team_active'` to Firestore

---

### 5.9 Team Activity Screen (Student)

**Shown when:** Session status = `TEAM_ACTIVE`

- **Reuses `BasketballCourt` component** — `maxShots` prop = `20`
- Dual counter above court: **"Your shots: 7 / 20 | [Teammate Name]: 12 / 20"**
  - Teammate counter updates in real-time via `onSnapshot`
- **"Undo Last Shot" button** available (same behavior as solo)
- After 20th shot:
  - Confetti/emoji burst celebration
  - Court locks
  - Message: "Great shooting! Waiting for [Teammate Name] to finish... 🏀"
- Shots written to Firestore with `activity: 'team'` and `studentId`

---

### 5.10 Teacher Team Monitor Screen

**Shown when:** Session status = `TEAM_ACTIVE`

- Table of all teams with per-player real-time progress:
  - e.g., `Team 1: Sarah 18/20 | Marcus 20/20 ✓`
- "Show Team Results" button → writes `status: 'team_review'` to Firestore

---

### 5.11 Team Review Screen (Student)

**Shown when:** Session status = `TEAM_REVIEW`

- Header: **"Team [N] — [Name1] + [Name2]"**
- Combined team `CourtHeatmap` — aggregates both teammates' `activity: 'team'` shots
- Combined `StatsDisplay` — team totals and per-zone breakdown
- Automatically transitions when teacher sets status → `ENDED`

---

### 5.12 Session Ended Screen

**Student view:**
- "Great work today! The session is over. 🏆"
- "Return to Home" button — clears session localStorage and goes to Landing Page

**Teacher view — two tabs:**

| Tab | Content |
|-----|---------|
| **Class Overview** | All students' shots combined into one class-wide `CourtHeatmap` + aggregate `StatsDisplay` |
| **Team Results** | Scrollable list of each team: team name, both players, combined team heatmap, team stats |

> **Future (not v1):** Solo leaderboard and team leaderboard tabs showing rankings by shooting percentage.

---

## 6. Auto-Pairing Logic

Triggered when teacher clicks "Pair Teams & Start Strategy":

1. Fetch complete participant list from `sessions/{code}/participants`
2. Shuffle randomly (Fisher-Yates)
3. Pair sequentially: `[0,1]`, `[2,3]`, `[4,5]`, ...
4. If **odd number**: last 3 students form a team of 3
5. Write `teamId` to each participant document in Firestore
6. Update session `status` to `'team_strategy'` atomically

> For the target group of 2–3 students, there will always be exactly 1 team. The logic still handles larger groups correctly as the program scales.

---

## 7. Nickname Generator

On the Join Session screen, the "🎲 Generate Name" button picks a random name from a curated word list.

**Format:** `[Adjective][BasketballNoun]` + optional number
- Examples: `SpeedyHooper`, `CoolShark42`, `BoldDunker`, `QuickSniper7`
- Adjective list: ~30 words (Speedy, Cool, Bold, Quick, Slick, Sharp, ...)
- Noun list: ~20 words (Hooper, Dunker, Sniper, Shooter, Hawk, Shark, ...)
- Generated client-side (no API needed) — stored as a string in the name field

---

## 8. Data Model (Firestore)

### `sessions/{sessionCode}`
```typescript
{
  sessionCode: string;        // 6-char, no ambiguous chars (e.g. "AB3K9Z")
  status: SessionStatus;
  createdAt: number;          // Unix ms
  hostDeviceId: string;       // UUID identifying the teacher's device
}
```

### `sessions/{sessionCode}/participants/{studentId}`
```typescript
{
  studentId: string;           // client-generated UUID
  name: string;                // display name (editable in LOBBY)
  joinedAt: number;
  teamId: string | null;       // null until auto-pairing runs
  soloShotsComplete: number;   // 0–15, incremented on each solo shot
  teamShotsComplete: number;   // 0–20, incremented on each team shot
}
```

### `sessions/{sessionCode}/shots/{shotId}`
```typescript
{
  id: string;
  studentId: string;
  activity: 'solo' | 'team';
  x: number;                   // zone centroid SVG x (0–500)
  y: number;                   // zone centroid SVG y (0–470)
  made: boolean;
  timestamp: number;
  zone: string;                // e.g. "Zone 1: Paint"
}
```

---

## 9. New TypeScript Types (`src/types.ts`)

```typescript
export type SessionStatus =
  | 'lobby'
  | 'solo_active'
  | 'solo_review'
  | 'team_strategy'
  | 'team_active'
  | 'team_review'
  | 'ended';

export interface Session {
  sessionCode: string;
  status: SessionStatus;
  createdAt: number;
  hostDeviceId: string;
}

export interface Participant {
  studentId: string;
  name: string;
  joinedAt: number;
  teamId: string | null;
  soloShotsComplete: number;
  teamShotsComplete: number;
}
```

---

## 10. Technical Requirements

### Real-time Synchronization
- Replace `getDocs()` calls with `onSnapshot()` listeners for:
  - `sessions/{code}` — drives all screen transitions for students
  - `sessions/{code}/participants` — drives teacher progress tables and teammate counter
- All student screens must update automatically when session status changes

### Shot Limits & Undo
- `BasketballCourt` gets a `maxShots?: number` prop
- Court SVG becomes non-interactive when `shots.length >= maxShots`
- "Undo Last Shot" button: deletes the last shot document from Firestore, decrements the participant's `soloShotsComplete` or `teamShotsComplete` counter

### Session Code Generation
- 6-character uppercase string using unambiguous characters only
- Character set: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (excludes O, I, L, 0, 1)
- Check Firestore for collision before writing; retry on collision

### Student Identity & Reconnect
- On join: generate UUID → `localStorage('studentId')`
- Also store: `localStorage('studentName')`, `localStorage('sessionCode')`
- On page reload: detect all three localStorage values, re-query Firestore for session status, render the correct screen automatically

### Late Joiners
- Joining allowed when session status is `LOBBY`, `SOLO_ACTIVE`, or `SOLO_REVIEW`
- Blocked at `TEAM_STRATEGY` and beyond — show error: "This session has already started. Ask your teacher."

### Firebase Dependency
- Session features **require Firebase** to be configured
- If `isFirebaseConfigured()` is false: hide "Join Session" and "Create Session"; show only "Practice Mode"

### Visual Design
- **Tone:** Playful, colorful, Kahoot/Duolingo style — big buttons, bold colors, emoji-friendly
- **Color palette:** Basketball oranges and court browns as primary; company purple and white as accent
- **Typography:** Rounded, sports-adjacent — clear and large for easy reading on Chromebook displays
- **Court diagram:** Existing wood-grain `#d2691e` court stays as the signature visual

---

## 11. New Files to Create

| File | Purpose |
|------|---------|
| `src/components/SessionJoin.tsx` | Code + name entry, nickname generator |
| `src/components/SessionCreate.tsx` | Teacher creates session, displays code |
| `src/components/Lobby.tsx` | Student waiting room with editable name |
| `src/components/TeacherLobby.tsx` | Teacher waiting room with live student list |
| `src/components/SoloWaiting.tsx` | Celebration + waiting screen after 15 shots |
| `src/components/TeamStrategy.tsx` | Side-by-side heatmap comparison |
| `src/components/TeamReview.tsx` | Combined team stats + heatmap |
| `src/components/SessionEnded.tsx` | End screen (student) + two-tab summary (teacher) |
| `src/services/sessionService.ts` | Firestore: create/join/advance session, real-time listeners |
| `src/hooks/useSession.ts` | React hook wrapping sessionService with onSnapshot |
| `src/utils/nicknames.ts` | Nickname word lists + generator function |

---

## 12. Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Replace ModeSelector with landing page; route on session status |
| `src/components/BasketballCourt.tsx` | Add `maxShots?: number` prop; disable when limit reached; add Undo button |
| `src/types.ts` | Add `Session`, `Participant`, `SessionStatus` exports |
| `src/services/shotsService.ts` | Add `studentId`, `activity` to shots; support real-time listeners |
| `src/components/MentorDashboard.tsx` | Add session phase controls + student progress table |

---

## 13. Out of Scope (v1)

- Student login/password authentication
- Multiple concurrent sessions per teacher
- Session history / data export
- Student-to-student chat
- Solo or team leaderboards *(planned for v2)*
- Manual team override *(planned for v2)*
- Class average comparison in Solo Review *(planned for v2)*
- Admin panel for multiple classes

---

## 14. Edge Cases & Decisions

| Scenario | Behavior |
|----------|----------|
| Student enters wrong name | Editable in LOBBY; locked once SOLO_ACTIVE starts |
| Duplicate name in session | Blocked at join: "That name is taken — choose another or generate one." |
| Student disconnects mid-session | On reload: detect localStorage values → re-query Firestore → resume correct screen |
| Late joiner after TEAM_STRATEGY | Blocked with error message |
| Odd number of students | Last 3 form a team of 3 |
| Only 1 student in session | "Start Solo Activity" button disabled; requires ≥ 2 students |
| Student finishes before teammate | Court locks; waiting message shown; no action needed |
| Teacher tries to advance before students finish | No enforcement — teacher controls all pacing manually |
| Firebase not configured | Landing page shows only "Practice Mode"; session features hidden |

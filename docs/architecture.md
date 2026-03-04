# Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 18.2 |
| Language | TypeScript | 5.2 |
| Build Tool | Vite | 5.0 |
| Database (cloud) | Firebase Firestore | 12.x |
| Database (local) | `localStorage` | — |
| Testing | Vitest + Testing Library | — |

No Node.js/Express backend — all data storage is handled client-side via `localStorage` or directly to Firestore from the browser.

---

## Project Structure

```
Basketball-Data-Collection-Web-App/
├── src/
│   ├── components/
│   │   ├── BasketballCourt.tsx     # Interactive click-to-record court (SVG)
│   │   ├── BasketballCourt.css
│   │   ├── CourtHeatmap.tsx        # Read-only heatmap with zone % labels
│   │   ├── CourtHeatmap.css
│   │   ├── MentorDashboard.tsx     # 4-tab mentor analysis interface
│   │   ├── MentorDashboard.css
│   │   ├── ModeSelector.tsx        # Landing screen — pick Student or Mentor
│   │   ├── ModeSelector.css
│   │   ├── StatsDisplay.tsx        # Zone-by-zone stat cards + legend
│   │   ├── StatsDisplay.css
│   │   ├── ShotHistory.tsx         # Chronological list of last 10 shots
│   │   └── ShotHistory.css
│   ├── hooks/
│   │   └── useShots.ts             # Custom hook: wraps shotsService with React state
│   ├── services/
│   │   └── shotsService.ts         # Persistence: localStorage + optional Firestore
│   ├── App.tsx                     # Root — mode state, tab state, layout
│   ├── App.css
│   ├── main.tsx                    # React entry point (ReactDOM.createRoot)
│   ├── index.css                   # Global styles
│   ├── types.ts                    # Shot, Stats interfaces; ZONES; calculateStats()
│   ├── firebase.ts                 # Firebase init; isFirebaseConfigured() guard
│   └── vite-env.d.ts
├── tests/
│   ├── setup.ts                    # Vitest global setup; localStorage mock
│   ├── tsconfig.json
│   ├── App.test.tsx
│   ├── BasketballCourt.test.tsx
│   ├── ModeSelector.test.tsx
│   ├── StatsDisplay.test.tsx
│   └── ShotHistory.test.tsx
├── docs/                           # This documentation folder
├── index.html
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
└── tsconfig.node.json
```

---

## State Management

All application state lives in `App.tsx` and is passed down as props — no Redux or Context API.

| State | Type | Stored In | Purpose |
|-------|------|-----------|---------|
| `mode` | `'student' \| 'mentor' \| null` | `localStorage('appMode')` + React state | Which view to render |
| `shots` | `Shot[]` | `localStorage('basketballShots')` + React state | All recorded shots |
| `activeTab` | `'court' \| 'stats' \| 'history'` | React state only | Active tab in student view |

---

## Data Flow

```
User clicks court (BasketballCourt)
  → getZoneAtCoordinates(x, y) returns zone name
  → setSelectedZone(zone) — shows Made/Missed buttons
  → recordShot(made: boolean)
      → builds Shot object { id, x, y, made, timestamp, zone }
      → onShotRecorded(shot) callback to App.tsx
          → useShots.addShot(shot)
              → shotsService.addShot(shot) — writes to localStorage + Firestore
              → setShots(prev => [...prev, shot]) — re-renders UI
```

---

## Persistence Layer

`shotsService.ts` implements a dual-write strategy:

1. **Always** writes to `localStorage` as the primary/offline store
2. **If** `isFirebaseConfigured()` is true, also writes to Firestore under `sessions/{sessionId}/shots`

On load, Firestore is preferred if it returns data; otherwise falls back to `localStorage`. This ensures the app works without any Firebase configuration.

---

## Session Management

A session ID is auto-generated on first use and stored in `localStorage('sessionId')`. Each session maps to a Firestore document at `sessions/{sessionId}`. `startNewSession()` generates a new ID and clears stored shots, isolating data between plays.

---

## Routing

There is no URL-based router. Navigation is state-driven:

```
null mode  → <ModeSelector>
'student'  → <App> with nav-tabs (court / stats / history)
'mentor'   → <MentorDashboard> with its own 4-tab layout
```

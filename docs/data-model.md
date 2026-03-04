# Data Model

---

## TypeScript Interfaces

### `Shot`

Defined in `src/types.ts`. Represents a single recorded shot attempt.

```typescript
interface Shot {
  id: string;        // Unique ID — "shot-{timestamp}" e.g. "shot-1704067200000"
  x: number;         // SVG x coordinate of the zone centroid (0–500)
  y: number;         // SVG y coordinate of the zone centroid (0–470)
  made: boolean;     // true = made, false = missed
  timestamp: number; // Unix milliseconds (Date.now())
  zone: string;      // One of the 6 zone name strings (see Zones below)
}
```

### `Stats`

Calculated from a `Shot[]` array by `calculateStats()`. Never persisted — always recomputed from raw shots.

```typescript
interface Stats {
  totalShots: number;
  totalMade: number;
  shootingPercentage: number;   // 0–100, e.g. 66.7
  byZone: Record<string, {
    made: number;
    total: number;
    percentage: number;         // 0–100
  }>;
}
```

---

## Zone Layout

The half-court SVG is 500 × 470 pixels. The basket/backboard is at the **top** (y ≈ 50–60) and the half-court line is at the **bottom** (y = 470). Six zones cover the entire court surface.

```
 ┌──────────────────────────────────┐  y=0   (basket end)
 │  Z4  │     Zone 1: Paint    │ Z6 │
 │      │   x:175–325 y:0–220  │    │
 │      ├──────────────────────┤    │
 │  Z2  │                      │ Z3 │
 │ Left │    (arc region)      │Rgt │
 │ Mid  │                      │Mid │
 │      └──────────────────────┘    │
 │                                  │  y≈315
 │  Z4  │  Zone 5: Top of Key  │ Z6 │
 │ Left │    (bottom center)   │Rgt │
 │ Out  │                      │Out │
 └──────────────────────────────────┘  y=470  (half-court)
```

### Zone Definitions

| Zone Name | Shape | Approx Coordinates | Centroid (x, y) |
|-----------|-------|--------------------|-----------------|
| Zone 1: Paint | Rectangle | x: 175–325, y: 0–220 | (250, 95) |
| Zone 2: Left Mid-Range | Left arc slice | x: 40–250, arc region | (125, 240) |
| Zone 3: Right Mid-Range | Right arc slice | x: 250–460, arc region | (375, 240) |
| Zone 4: Left Outside | Far-left + corners | x: 0–145, all y | (125, 410) |
| Zone 5: Top of Key | Bottom center trapezoid | x: 100–400, y: 315–470 | (250, 320) |
| Zone 6: Right Outside | Far-right + corners | x: 355–500, all y | (375, 410) |

The arc boundary uses an ellipse formula with center (250, 170), rx=210, ry=167:
```
(x - 250)²/210² + (y - 170)²/167² ≤ 1
```

---

## `calculateStats(shots)`

Pure function in `src/types.ts`. Returns a `Stats` object:

1. Counts total shots and total made
2. Computes `shootingPercentage = (made / total) * 100`
3. Groups shots by zone, computes per-zone `made`, `total`, and `percentage`
4. Zones with no shots have `{ made: 0, total: 0, percentage: 0 }`

---

## Persistence

### localStorage Keys

| Key | Value | Description |
|-----|-------|-------------|
| `basketballShots` | JSON `Shot[]` | All shots for the current session |
| `sessionId` | `"session-{timestamp}-{random}"` | Current session identifier |
| `appMode` | `"student"` or `"mentor"` | Last selected mode |

### Firestore Structure (when configured)

```
sessions/
  {sessionId}/           ← auto-generated session document
    shots/
      {autoId}           ← one document per Shot, fields match Shot interface
        id: string
        x: number
        y: number
        made: boolean
        timestamp: number
        zone: string
```

Shots are stored under `sessions/{sessionId}/shots` as a subcollection. The session document itself is not explicitly created — Firestore creates it implicitly when the first shot is written.

### Dual-Write Strategy

`shotsService.ts` always writes to `localStorage` first. Firebase writes are fire-and-forget (errors are caught and logged as warnings, so offline use is seamless).

On load:
1. If Firestore returns data → use it and update `localStorage` cache
2. If Firestore returns empty or is unconfigured → use `localStorage`

---

## Session Lifecycle

```
App loads
  → getSessionId() checks localStorage('sessionId')
  → if none: generate new ID and store it

User clicks "Switch Mode"
  → setMode(null) → back to ModeSelector
  → (session ID preserved, shots preserved)

User calls resetForNewSession() [via useShots hook]
  → startNewSession() generates new ID, clears localStorage shots
  → setShots([])
```

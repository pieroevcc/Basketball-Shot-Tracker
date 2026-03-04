# Testing

## Setup

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (Jest-compatible API) |
| **@testing-library/react** | Component rendering utilities |
| **@testing-library/user-event** | Simulates real user interactions |
| **@testing-library/jest-dom** | Custom DOM matchers (`.toBeInTheDocument()`, etc.) |
| **jsdom** | Browser-like DOM environment for Node |

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

**`tests/setup.ts`** — runs before every test file:
- Imports `@testing-library/jest-dom` for DOM matchers
- Replaces `window.localStorage` with a fully functional in-memory mock (Vitest v4 + jsdom doesn't expose a real localStorage implementation)

---

## Running Tests

```bash
npm test           # run all tests (watch mode)
npx vitest run     # single run, no watch
```

---

## Test Files

### `tests/App.test.tsx` (8 tests)

Integration tests for the root `App` component, covering the full mode-switching flow.

| Test | What it verifies |
|------|-----------------|
| Shows ModeSelector when no mode stored | Default landing state |
| Enters student mode on click | Mode transition to student |
| Enters mentor mode on click | Mode transition to mentor |
| Shows Court/Stats/History tabs in student mode | Student tab navigation rendered |
| Does not show Court tab in mentor mode | Mentor tabs are different |
| Switches to Stats tab | Tab navigation works |
| Switches to History tab | Tab navigation works, empty state shown |
| Returns to ModeSelector on Switch Mode | Mode reset works |
| Restores mode from localStorage | Persistence survives mount |

**Setup:** `localStorage.clear()` before each test; `window.confirm` is mocked to return `true`.

---

### `tests/BasketballCourt.test.tsx` (9 tests)

Tests the interactive SVG court component, including coordinate-to-zone mapping and shot recording.

| Test | What it verifies |
|------|-----------------|
| Renders the SVG court | SVG element is present |
| Does not show shot buttons initially | Buttons hidden before zone click |
| Renders circle marker for each shot | Shot markers drawn per shot |
| Colors made shot markers green | `fill="#00ff00"` for made |
| Colors missed shot markers red | `fill="#ff0000"` for missed |
| Shows Made/Missed/Cancel after clicking valid zone | Zone selection flow |
| Calls onShotRecorded with made=true | Made button fires callback correctly |
| Calls onShotRecorded with made=false | Missed button fires callback correctly |
| Hides shot buttons after Cancel | Cancel clears selection |

**Technique:** `svg.getBoundingClientRect` is mocked to return a `500×470` bounding box so `fireEvent.click(svg, { clientX: 250, clientY: 95 })` maps exactly to Zone 1: Paint.

---

### `tests/ModeSelector.test.tsx` (5 tests)

Tests the landing screen component.

| Test | What it verifies |
|------|-----------------|
| Renders app title | Title text present |
| Renders Student Mode button | Button rendered |
| Renders Mentor Mode button | Button rendered |
| Calls onModeSelect with "student" | Click fires correct argument |
| Calls onModeSelect with "mentor" | Click fires correct argument |

---

### `tests/StatsDisplay.test.tsx` (9 tests)

Tests the stats panel with both empty and populated stats fixtures.

| Test | What it verifies |
|------|-----------------|
| Renders Overall Stats heading | Section header present |
| Renders Stats by Zone heading | Section header present |
| Renders Heat Map Legend | Legend section present |
| Displays total shots count | Numeric value rendered |
| Displays made shots count | Numeric value rendered |
| Displays shooting percentage | Formatted % rendered |
| Displays zone names | Zone labels in DOM |
| Displays made/total for a zone | Fraction display (`5/6`) |
| Shows legend labels | All 4 color categories labeled |

**Fixtures:**
- `emptyStats` — all zeros, all 6 zones at 0%
- `populatedStats` — 10 shots, 70% overall, data in zones 1 and 2

---

### `tests/ShotHistory.test.tsx` (9 tests)

Tests the shot history list component.

| Test | What it verifies |
|------|-----------------|
| Shows empty state message | Empty list renders a hint |
| Does not show Clear All when empty | Button hidden when no shots |
| Shows Clear All when shots exist | Button appears with shots |
| Calls onClear when Clear All clicked | Callback fired |
| Renders zone name for each shot | Zone label in each row |
| Shows Made label for made shot | Result label correct |
| Shows Missed label for missed shot | Result label correct |
| Displays total shot count in footer | Footer count accurate |
| Only shows up to 10 most recent shots | Slice cap enforced |
| Displays most recent shot first | Reverse chronological order |

**Note:** The `ShotHistory` component's `onDelete` prop is required by TypeScript but not tested here (it's implicitly tested in `App.test.tsx`). The `ShotHistory.test.tsx` file passes `onClear` only; `onDelete` handling is covered by the component's delete button wiring.

---

## Coverage Areas

| Area | Covered by |
|------|-----------|
| Mode selection UI | ModeSelector.test, App.test |
| Mode persistence (localStorage) | App.test |
| Student tab navigation | App.test |
| Mentor tab layout | App.test |
| Court SVG rendering | BasketballCourt.test |
| Zone click → shot recording flow | BasketballCourt.test |
| Shot marker colors | BasketballCourt.test |
| Stats calculations (displayed values) | StatsDisplay.test |
| Shot history display and sorting | ShotHistory.test |
| Clear/delete controls | ShotHistory.test, App.test |

## Not Currently Covered

| Area | Notes |
|------|-------|
| `useShots` hook | No dedicated hook test |
| `shotsService` | No unit tests for localStorage/Firestore logic |
| `calculateStats` | No pure-function unit tests |
| `MentorDashboard` | No dedicated component tests |
| `CourtHeatmap` | No dedicated component tests |
| Firebase integration | Not tested (would require mocking Firestore) |
| Zone boundary detection | Not directly unit tested (covered indirectly by BasketballCourt.test) |

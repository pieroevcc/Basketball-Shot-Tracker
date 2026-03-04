# Features

---

## Mode Selection

On first launch (or after clicking "Switch Mode"), users see the **Mode Selector** screen. Two choices:

- **Student Mode** — for the student actively playing the game
- **Mentor Mode** — for the instructor/mentor reviewing performance

The chosen mode is persisted to `localStorage('appMode')` so it survives page refreshes. Switching mode returns to the selector screen but preserves existing shot data.

---

## Student Mode

### Shot Recording

1. Student taps/clicks a zone on the court diagram
2. The clicked zone is highlighted and its name appears on the court
3. Three buttons appear: **Made 🎯**, **Missed ❌**, **Cancel**
4. Tapping Made or Missed records the shot and returns to the blank court

Each shot is saved immediately to `localStorage` (and Firestore if configured).

### Navigation Tabs

Student mode has three tabs:

#### Court Tab (default)
- Shows the interactive `BasketballCourt` component
- Zone colors update in real-time as shots are added (live heatmap)
- Green/red dot markers show where each shot was recorded

#### Stats Tab
- Shows `CourtHeatmap` (read-only) side-by-side with `StatsDisplay`
- Heatmap zones are colored by make percentage with floating % labels
- Stat cards list made/total and percentage for each of the 6 zones
- Color legend: Hot (≥70%) / Warm (50–69%) / Cool (30–49%) / Cold (<30%)

#### History Tab
- Shows `ShotHistory` — most recent 10 shots in reverse chronological order
- Each row: shot number, zone name, Made/Missed result
- Per-shot delete button (✕)
- "Clear All" button with a confirmation dialog
- Total shot count shown at the bottom

---

## Mentor Mode

### Overview Tab

Four summary cards at the top:
- Total Shots
- Make Rate (percentage)
- Made (count)
- Missed (count)

**Zone Highlights** (shown once ≥1 zone has data):
- 🔥 **Best Zone** — highest make percentage among zones with attempts
- 🎯 **Needs Work** — lowest make percentage (shown only when a different zone from best)

**Coaching Insights** — Auto-generated text bullets based on the current data:

| Situation | Insight text |
|-----------|-------------|
| < 10 shots | "Only N shots — encourage more reps" |
| Overall ≥ 60% | "Excellent overall shooting at X%" |
| Overall 45–59% | "Solid shooting at X% — room to grow" |
| Overall 30–44% | "Focus on form fundamentals" |
| Overall < 30% (≥5 shots) | "Struggling — try drill-based practice" |
| Zone ≥ 60% (≥3 shots) | "Zone X is a confidence zone" |
| Zone < 35% (≥3 shots) | "Zone X needs work — schedule drills" |
| Second-half % > first by >10 | "Positive trend: improved by N%" |
| Second-half % < first by >10 | "Fatigue factor: dropped N% in second half" |

**Recent Activity** — Last 5 shots shown with result icon, zone, and time.

### Court Tab

Read-only `CourtHeatmap` showing zone colors and percentage labels.

### Stats Tab

Full `StatsDisplay` component with zone-by-zone stat cards and the heat map legend.

### History Tab

`ShotHistory` component — same as student view, includes per-shot delete and clear-all.

---

## Heatmap Visualization

The heatmap is implemented in two places:

| Component | Context | Interactive? |
|-----------|---------|-------------|
| `BasketballCourt` | Student Court tab | Yes — click zones to record shots |
| `CourtHeatmap` | Student Stats tab, Mentor Court tab | No — display only |

### Color Scale

| Make % | Color | Meaning |
|--------|-------|---------|
| ≥ 70% | Green | Hot zone — strong shooting |
| 50–69% | Yellow/Green | Warm zone — above average |
| 30–49% | Orange | Cool zone — below average |
| < 30% | Red | Cold zone — needs work |
| No data | Near-transparent white | No shots recorded |

---

## Data Persistence

- **Offline-first**: All data is stored in `localStorage` immediately — no network required
- **Optional cloud sync**: If Firebase environment variables are set, shots are also written to Firestore in real-time
- **Graceful degradation**: Firestore failures are silently caught; `localStorage` always serves as the fallback
- **Session isolation**: Each session has a unique ID; `resetForNewSession()` clears shots and starts fresh

---

## Shot Management

| Action | Where | Behavior |
|--------|-------|----------|
| Record shot | Court tab | Click zone → Made/Missed → saves immediately |
| Delete one shot | History tab / Mentor History | ✕ button removes shot from state and storage |
| Clear all shots | History tab / Mentor History | Confirm dialog → removes all shots |
| Switch mode | Header button | Returns to mode selector; data preserved |

---

## Firebase Integration (Optional)

When Firebase environment variables are provided in `.env`:

- App initializes Firebase and connects to Firestore
- Firebase Analytics is also initialized
- Shots are written to `sessions/{sessionId}/shots/{autoId}`
- On page load, Firestore data is loaded and synced back to `localStorage`
- A console log confirms the connected project ID

Without the `.env` variables:
- A console message confirms localStorage-only mode
- The app is fully functional with no Firebase dependency

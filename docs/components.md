# Components

All components are in `src/components/`. Each is a React functional component written in TypeScript.

---

## ModeSelector

**File:** `src/components/ModeSelector.tsx`

The landing screen shown when no mode has been selected. Renders two large buttons that set the application mode.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `onModeSelect` | `(mode: 'student' \| 'mentor') => void` | Called when a mode button is clicked |

### Behavior

- Displays the app title and two mode buttons: **Student Mode** and **Mentor Mode**
- Clicking either button fires `onModeSelect`, which updates `App.tsx` state and persists the choice to `localStorage('appMode')`

---

## BasketballCourt

**File:** `src/components/BasketballCourt.tsx`

An interactive SVG half-court diagram. Students click a zone to select it, then press **Made** or **Missed** to record the shot.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `onShotRecorded` | `(shot: Shot, zone: string) => void` | Fires after the user confirms a shot |
| `shots` | `Shot[]` | All recorded shots — used to render shot markers and live heatmap colors |

### Internal State

| State | Type | Purpose |
|-------|------|---------|
| `selectedZone` | `string \| null` | The zone the user clicked; drives the Made/Missed button display |

### Key Logic

**`getZoneAtCoordinates(x, y)`** — Maps raw SVG coordinates to one of six zone names using boundary checks:

| Zone | Detection method |
|------|-----------------|
| Zone 1: Paint | Rectangle check `x∈[175,325]`, `y∈[0,220]` |
| Zone 2: Left Mid-Range | Ellipse formula + position checks |
| Zone 3: Right Mid-Range | Ellipse formula + position checks |
| Zone 4: Left Outside | Far-left strip, arc slice, bottom-left trapezoid |
| Zone 5: Top of Key | Bottom-center trapezoid outside the arc |
| Zone 6: Right Outside | Far-right strip, arc slice, bottom-right trapezoid |

**`getHeatmapColor(zone)`** — Returns a semi-transparent overlay color based on make % for that zone:

| Make % | Color |
|--------|-------|
| ≥ 70% | Green `rgba(0,255,0,0.3)` |
| ≥ 50% | Yellow `rgba(255,255,0,0.3)` |
| ≥ 30% | Orange `rgba(255,165,0,0.3)` |
| < 30% | Red `rgba(255,0,0,0.3)` |

**`recordShot(made)`** — Builds a `Shot` object using the centroid coordinates from `ZONES[selectedZone]`, calls `onShotRecorded`, and clears `selectedZone`.

### SVG Court Elements

The court is drawn as a 500×470 SVG:
- Hardwood background (`#d2691e`)
- Six colored zone paths/rects (heatmap overlay)
- Paint/key rectangle outline
- Backboard line, basket circle, restricted area arc
- Free-throw circle (dashed below)
- Half-court arcs at the bottom
- Green/red dot markers for each recorded shot

### Shot Recording Flow

```
1. User clicks SVG → handleCourtClick scales coordinates to 500×470 space
2. getZoneAtCoordinates returns zone name
3. setSelectedZone(zone) → Made / Missed / Cancel buttons appear
4. User clicks Made or Missed → recordShot(true/false)
5. Shot object created → onShotRecorded fires → selectedZone cleared
```

---

## CourtHeatmap

**File:** `src/components/CourtHeatmap.tsx`

A **read-only** heatmap version of the court. Used in both the student Stats tab and the mentor Court tab. Shows zone colors and floating percentage labels.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `shots` | `Shot[]` | Used to render shot dot markers |
| `stats` | `Stats` | Zone percentages drive heatmap colors and percentage labels |

### Key Logic

**`getHeatmapColor(percentage, total)`** — Same color scale as `BasketballCourt` but slightly different thresholds for better visual clarity in the read-only view:

| Make % | Color |
|--------|-------|
| ≥ 70% | `rgba(0,220,0,0.35)` |
| ≥ 50% | `rgba(200,220,0,0.35)` |
| ≥ 30% | `rgba(255,140,0,0.35)` |
| < 30% | `rgba(220,30,30,0.35)` |
| 0 shots | `rgba(255,255,255,0.08)` |

Zone SVG shapes are defined as constants in `ZONE_PATHS` and rendered via `React.cloneElement` to inject the computed `fill` color.

Percentage labels are rendered as dark pill-shaped backgrounds with white bold text, positioned at the zone centroid from `ZONES`.

A **legend bar** below the court shows: Hot / Warm / Cool / Cold.

---

## StatsDisplay

**File:** `src/components/StatsDisplay.tsx`

Displays overall shooting stats and a grid of per-zone stat cards with hot/cold color indicators.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `stats` | `Stats` | All calculated statistics to display |

### Sections

1. **Overall Stats** — Total shots, made shots, shooting percentage
2. **Stats by Zone** — A card for each of the 6 zones showing `made/total` and `%`, with a colored indicator bar (`hot` / `warm` / `cool` / `cold`)
3. **Heat Map Legend** — Color key explaining the indicator classes

### `getHotColdClass(percentage)`

Returns a CSS class name:

| Threshold | Class |
|-----------|-------|
| ≥ 70% | `hot` |
| ≥ 50% | `warm` |
| ≥ 30% | `cool` |
| < 30% | `cold` |

---

## ShotHistory

**File:** `src/components/ShotHistory.tsx`

A chronological list of the most recent 10 shots with delete and clear-all controls.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `shots` | `Shot[]` | Full shot array (reversed and sliced to 10 for display) |
| `onClear` | `() => void` | Called when "Clear All" is clicked (App shows a confirm dialog) |
| `onDelete` | `(id: string) => void` | Called when the ✕ button on a shot row is clicked |

### Behavior

- Shows up to 10 most recent shots (newest first)
- Each row shows: shot number, zone name, ✅/❌ result, and a delete button
- "Clear All" button is only shown when there are shots
- Empty state: "No shots recorded yet. Click on the court to start!"
- Footer always shows total shot count

---

## MentorDashboard

**File:** `src/components/MentorDashboard.tsx`

A 4-tab analysis interface for mentors. Consumes the same `shots`/`stats` as the student view but adds coaching insights and aggregate analysis.

### Props

| Prop | Type | Description |
|------|------|-------------|
| `shots` | `Shot[]` | All shots in the current session |
| `stats` | `Stats` | Pre-calculated stats passed from `App.tsx` |
| `onDelete` | `(id: string) => void` | Passed through to `ShotHistory` |
| `onClear` | `() => void` | Passed through to `ShotHistory` |

### Tabs

| Tab | Content |
|-----|---------|
| Overview | Summary cards, best/worst zone highlights, coaching insights, recent activity |
| Court | `<CourtHeatmap>` — read-only heatmap |
| Stats | `<StatsDisplay>` — zone stat cards |
| History | `<ShotHistory>` — shot list with delete/clear |

### `generateInsights(shots, stats)` — Coaching Insights Logic

Produces an array of natural-language insight strings:

| Condition | Insight generated |
|-----------|-------------------|
| < 10 shots | "Only N shots — encourage more reps" |
| Overall % ≥ 60% | "Excellent overall shooting" |
| Overall % 45–59% | "Solid shooting — room to grow" |
| Overall % 30–44% | "Focus on form fundamentals" |
| Overall % < 30% (≥5 shots) | "Struggling — try drill-based practice" |
| Zone ≥ 60% (≥3 attempts) | "{Zone} is a confidence zone" |
| Zone < 35% (≥3 attempts) | "{Zone} needs work — schedule drills" |
| Second-half % > first by 10+ | "Positive trend: shooting improved" |
| Second-half % < first by 10+ | "Fatigue factor: accuracy dropped" |

### Overview Panel Details

- **Summary cards**: Total Shots, Make Rate, Made, Missed
- **Zone highlights**: Best zone (🔥) and worst zone (🎯) computed from `stats.byZone` filtered to zones with at least 1 attempt
- **Coaching insights**: Bulleted list from `generateInsights()`
- **Recent activity**: Last 5 shots (reversed), showing result icon, zone, and timestamp

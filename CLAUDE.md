# Basketball Data Collection Web App — Claude Context

## Project Purpose
A web application for a **non-profit after-school program** that teaches **data science to low-income kids** using a tabletop basketball game. It replaces Google Forms/Sheets with a custom, personalized system for data collection and visualization.

Students input whether they made or missed each shot during the game. After the game, a **heat map** displays their shot locations and shot percentage visually.

---

## Two Activities

### 1. Solo Activity
- Individual student tracks their own shots
- After the game, they see a personal heat map of shot percentages

### 2. Team Activity
- Students collaborate as a team
- Aggregate team data is collected
- Team-level heat map shown after the game

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | TypeScript, CSS, HTML |
| Build Tool | Vite |
| Database | Firebase Firestore (serverless, no backend needed) |
| Auth (optional) | Firebase Authentication |
| Hosting | Firebase Hosting |
| Testing | `/tests` directory |

> ✅ No Node.js/Express backend — Firebase handles all data storage and real-time sync directly from the frontend.

### Key Files
```
Basketball-Data-Collection-Web-App/
├── src/                  # Main source code (TypeScript)
├── tests/                # Test files
├── index.html            # Entry point
├── package.json          # Dependencies & scripts
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript config
└── CLAUDE.md             # This file
```

### Dev Setup
```bash
git clone <repo>
cd Basketball-Data-Collection-Web-App
npm install
npm run dev
# App runs at http://localhost:5173 (Vite default)
```

### Firebase Setup
```bash
npm install firebase
# Add Firebase config to src/firebase.ts
# Initialize Firestore in the app
```

---

## Core Features to Build

- [ ] **Shot input interface** — student taps/clicks to record made/missed shots on a court layout
- [ ] **Solo mode** — individual session tracking
- [ ] **Team mode** — shared session with real-time sync for group play (Firebase real-time updates)
- [ ] **Heat map visualization** — displays shot locations color-coded by make/miss percentage after the game
- [ ] **Session management** — start/end game sessions
- [ ] **Data storage** — Firestore for persisting shot data per student/team
- [ ] **Student-friendly UI** — simple, engaging interface appropriate for kids

---

## Design Principles
- **Audience:** Low-income kids in an after-school program — UI must be simple, intuitive, and fun
- **Purpose is educational** — the heat map should help students *understand* their data
- **Replaces Google Forms/Sheets** — must be easier and more visual than spreadsheets
- **Personalized** — tailored specifically to tabletop basketball game mechanics

---

## Data Model (Firestore)

### Collection: `sessions`
```typescript
{
  sessionId: string,
  mode: "solo" | "team",
  studentIds: string[],
  startTime: Timestamp,
  endTime?: Timestamp,
}
```

### Subcollection: `sessions/{sessionId}/shots`
```typescript
{
  studentId: string,
  x: number,          // shot location on court grid
  y: number,
  made: boolean,
  timestamp: Timestamp
}
```

---

## GitHub Repo
https://github.com/pieroevcc/Basketball-Data-Collection-Web-App

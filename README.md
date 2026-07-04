# 🏀 Basketball Shot Tracker

**A live, classroom-wide basketball data app for an after-school program that teaches data science to kids.** A teacher starts a session, students join with a code from any device, and the whole class plays a tabletop mini-basketball game through two structured rounds. Every shot gets tracked by court zone — then each kid sees their own color-coded **heat map** and stats, turning a game they just played into data they can actually read.

> 🎬 **Demo:** https://basketball-shot-tracker-21c0e.web.app/

```
  TEACHER                          STUDENTS (join with a 6-char code)
  ───────                          ──────────────────────────────────
  Create Session ──► LOBBY ──────► join + pick a nickname
        │                              │
        ▼                              ▼
  Start Solo  ───► SOLO ACTIVE ──► tap zone → made / missed (×20)
        │                              │
        ▼                              ▼
  Show Review ───► SOLO REVIEW ──► personal heat map + stats
        │                              │
        ▼                              ▼
  Pair Teams  ───► TEAM STRATEGY ─► compare heat maps, plan shots
                   ↓ ALLOCATION ──► split team shots per player
                   ↓ SABOTAGE   ──► block a rival's hot zone
                   ↓ TEAM ACTIVE ─► shoot as a team
        │                              │
        ▼                              ▼
  End Session ───► TEAM REVIEW ───► team heat map + leaderboard
```

Every screen advances in lock-step the moment the teacher moves the session forward — no refresh, no re-join.

---

## ✨ Features

- Live multi-device sessions — students join with a 6-character code, no login.
- Teacher-driven state machine — one tap advances every connected screen in real time.
- Tap-a-zone shot input on a 6-zone half-court, with undo.
- Solo round — individual shot tracking with a per-zone scoring system.
- Team round — auto-pairing, shot allocation, and a "sabotage" mechanic that blocks a rival team's zone.
- Personal, team, and class-wide heat maps color-coded by make/miss percentage.
- Leaderboard and per-zone stats breakdown.
- Random kid-friendly nickname generator (e.g. `SpeedyHooper`, `CoolShark42`).
- Resilient sessions — teacher heartbeat, disconnect detection, and idle timeouts auto-recover stranded students.
- Practice Mode — offline single-device play with no Firebase required.
- Export results to PDF/image.

---

## 🧰 Tech stack

| Stage | Tooling |
|-------|---------|
| Language | [TypeScript](https://www.typescriptlang.org/) |
| UI | [React 18](https://react.dev/) |
| Build / dev server | [Vite](https://vite.dev/) |
| Database & real-time sync | [Firebase Firestore](https://firebase.google.com/docs/firestore) (serverless, `onSnapshot` listeners) |
| Hosting | [Firebase Hosting](https://firebase.google.com/docs/hosting) |
| Export | [html2canvas](https://html2canvas.hertzen.com/) + [jsPDF](https://github.com/parallax/jsPDF) |
| Unit / component tests | [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) |
| Integration tests | [Firebase Emulator](https://firebase.google.com/docs/emulator-suite) |
| End-to-end tests | [Playwright](https://playwright.dev/) |

---

## 🛠️ How I built it (the process)

This started as a way to replace the clunky Google Forms + Sheets workflow the program used to collect shot data — but the real goal was bigger: give low-income kids a fun, visual way to *understand* their own data. A spreadsheet doesn't teach a 12-year-old anything; a heat map of their own shooting does. So the whole design leans into the game itself, then quietly turns it into a data-science lesson at the end.

I wrote a detailed PRD first and built around a single **session state machine** — every screen is just a function of the current session status, which the teacher controls. The frontend is intentionally backend-free: Firestore's `onSnapshot` listeners (wrapped in a `useSession` hook) push every state change to every device, so the teacher tapping "Start Team Shooting" instantly moves the whole class forward. The hardest parts were all about *liveness*: keeping many student and teacher screens perfectly in sync, handling the messy reality of a teacher closing their laptop mid-session (heartbeats, `beforeunload`, timeouts, and idle detection so kids never get stranded), and designing a two-round game — zone scoring, team shot allocation, and a sabotage mechanic — fun enough to keep kids engaged while still producing clean data.

> Guiding principle: simple and playful for the kid in front of the screen, even when the sync logic behind it isn't.

---

## 📚 What I learned

- Modeling a real-time multi-user app around Firestore `onSnapshot` listeners and a fully serverless (no-backend) architecture.
- Designing a simple, playful, Kahoot-style UI that actually works for 10–14 year olds.
- Testing concurrency for real — Firestore emulator tests, multi-user simulations, Playwright E2E, and a bot script that hammers a session with 25 fake students.
- Writing Firestore security rules to validate every write and protect data integrity without a traditional backend.

---

## 🚀 How it could be improved

- **No authentication** — anyone with a code can join. Fine for a supervised classroom, but real auth (or per-class teacher accounts) would harden it for wider use.
- **Open Firestore reads** — rules currently allow public reads on sessions. Scoping reads to participants would tighten privacy.
- **No session history / data export per student** — results live only for the session. Persisting longitudinal data would let kids track progress over weeks.
- **Single teacher per session** — no co-teacher or multi-class admin view yet. An admin panel is the natural next step as the program scales.
- **Fixed shot limits and zones** — scoring and zone layout are hard-coded; making them teacher-configurable would support different game variants.

---

## ▶️ How to run the project

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- A [Firebase](https://firebase.google.com/) project (free tier is plenty)

### Quick start
```bash
git clone https://github.com/pieroevcc/Basketball-Data-Collection-Web-App.git
cd Basketball-Data-Collection-Web-App
npm install
npm run dev
```
Open `http://localhost:5173`. Without Firebase configured, the app still runs in **Practice Mode** (offline, single device).

<details>
<summary><strong>🔧 Firebase setup (for live sessions)</strong></summary>

Create a `.env` file in the project root (see `.env.example`) with your Firebase web-app config:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id   # optional
```

These values come from your Firebase Console → Project Settings → Your apps. The app reads them at startup; if the core keys are missing it silently falls back to Practice Mode.
</details>

<details>
<summary><strong>🚢 Deploy to Firebase Hosting</strong></summary>

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy
```
Firestore rules and indexes ship from `firestore.rules` and `firestore.indexes.json`.
</details>

<details>
<summary><strong>🧪 Running the tests</strong></summary>

```bash
npm test                  # unit + component tests (Vitest)
npm run test:emulator:ci  # integration tests against the Firestore emulator
npm run test:e2e          # Playwright end-to-end tests
npm run test:all          # everything
```
The emulator and bot scripts need the Firebase CLI installed.
</details>

---

## 🎬 Video demo

https://github.com/user-attachments/assets/7176ab47-07b3-4129-af67-e3da9956e2e3

---

<sub>Built for a non-profit after-school program teaching data science through a tabletop basketball game.</sub>

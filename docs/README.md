# Basketball Shot Tracker — Documentation

> A web app for an after-school program that teaches data science to kids using a tabletop basketball game.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Tech stack, project structure, data flow |
| [Components](./components.md) | All React components — props, behavior, usage |
| [Data Model](./data-model.md) | TypeScript interfaces, zone layout, storage layer |
| [Features](./features.md) | Student mode, mentor mode, heatmap, shot tracking |
| [Testing](./testing.md) | Test setup, test files, coverage |

---

## What This App Does

Students record basketball shots (made or missed) by clicking on a court diagram. The app stores each shot with its zone location and displays a **color-coded heatmap** showing shooting performance by court area.

There are two user roles:

- **Student** — Records shots live during play, views their own stats and heatmap
- **Mentor** — Reviews student data, sees coaching insights, manages session history

---

## Running the App

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
npm test           # run Vitest test suite
```

## Firebase (optional)

The app works fully offline using `localStorage`. To enable cloud sync, create a `.env` file:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

When these variables are present, shots are saved to Firestore in addition to `localStorage`.

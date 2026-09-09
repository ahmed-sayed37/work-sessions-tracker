# Work Sessions Tracker

Alignerr-style time-tracking web app for logging work sessions, problems, comments, and a live timer — with full localStorage persistence across refresh.

## Features

- **Work sessions** — multiple start/end datetime rows, live `Auto: X.XX hours` badge
- **Total hours** — auto-calculated with editable override + green `Submitted` badge
- **Live timer** — Start / Pause / Stop; on stop appends a session; persists across refresh
- **Two independent tasks** — Task 1 | Task 2 tabs (renamable), isolated data per task
- **Problems** — add/remove problems with title + notes (hours are not split)
- **Comments** — per-task textarea
- **Persistence** — localStorage auto-save (~300ms debounce); Save / Reset / Refresh
- **Export / Import** — JSON backup

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## Storage

Data is stored under the key `workSessions.v1.tasks` in `localStorage`. Browser refresh (F5) never loses data. **Reset** clears only the current task after confirmation. **Save** flushes storage and updates the Submitted badge.

## Tech

Vite + React + TypeScript + plain CSS. Native `datetime-local` inputs; durations stored/computed from local datetime values to 2 decimal hours.

# Work Sessions Tracker

Alignerr-style time-tracking web app for logging work sessions, problems, comments, and a live timer — with durable browser persistence (localStorage + IndexedDB).

**Live:** https://ahmed-sayed37.github.io/work-sessions-tracker/

## Features

- **Work sessions** — multiple start/end datetime rows, live `Auto: X.XX hours` badge (overnight OK)
- **Total hours** — auto-calculated with editable override + green `Submitted` badge
- **Live timer** — Start / Pause / Stop; on stop appends a session with duration = accumulated time (pauses excluded); persists across refresh
- **Two independent tasks** — Task 1 | Task 2 tabs (renamable), isolated data per task
- **Problems** — add/remove problems with title + notes (hours are not split)
- **Comments** — per-task textarea
- **Persistence** — localStorage auto-save (~300ms debounce) + IndexedDB mirror; flush on tab hide / pagehide / beforeunload
- **Export / Import** — JSON backup (recommended before Reset or clearing site data)

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173/work-sessions-tracker/`).

## Build / verify

```bash
node scripts/verify-hours.mjs   # asserts 9PM–10:30PM + overnight = 3.0h
npm run build
npm run preview
```

## Persistence guarantees

| Behavior | What happens |
| --- | --- |
| Refresh / close tab | Data kept (localStorage primary + backup + IndexedDB mirror) |
| Corrupt primary JSON | Raw dump → `workSessions.v1.corrupt`; load tries backup, then IndexedDB; **never** silently wipes |
| Reset | Confirmed wipe of **one task only**; other task untouched; storage keys are not cleared globally |
| Quota full | Save returns failure; UI toasts — existing keys are not deleted |
| Clear site data / another browser | Local copies gone — use **Export** as the escape hatch |

Keys: `workSessions.v1.tasks` (primary), `workSessions.v1.backup`, `workSessions.v1.corrupt`. IndexedDB database `workSessions` / store `state` / id `v1`.

## Deploy

Pushes to `master` build and publish via GitHub Actions (Pages, `base: /work-sessions-tracker/`).

## Tech

Vite + React + TypeScript + plain CSS. Native `datetime-local` inputs; durations to 2 decimal hours.

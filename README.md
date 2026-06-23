# TL Design Team — Desktop App

A standalone Windows desktop app for the Tirso Lighting design team dashboard. Reads live data directly from Notion via the REST API — no browser, no Claude, no internet sign-in required after setup.

---

## Requirements

- **Node.js** (v18 or later) — download from https://nodejs.org
- A **Notion integration token** (see below)

---

## Setup

### 1 — Install Node.js

Download and install from https://nodejs.org (choose the LTS version).

### 2 — Install dependencies

Open a terminal (Command Prompt or PowerShell) in this folder and run:

```
npm install
```

This downloads Electron (~120 MB). Only needed once.

### 3 — Get your Notion token

1. Go to https://www.notion.so/my-integrations
2. Click **"New integration"**
3. Give it a name (e.g. "TL Boss View"), select your workspace, click Submit
4. Copy the **Internal Integration Token** (starts with `secret_`)
5. In your Notion workspace, open each project page and click **"Connect"** → select your integration so it has access

### 4 — Launch the app

```
npm start
```

On first launch you'll see a setup screen — paste your `secret_...` token and click **Connect**. The token is saved locally and you won't be asked again.

---

## Usage

- **Hub tab** — live overview of all active projects with scores, phase bars, overdue flags
- **History tab** — monthly snapshots. On the last day of each month, open the app and the current state is saved permanently. Use the ← → arrows to browse past months.
- **Project detail** — click any project card to see full phase breakdown, per-task detail, and timeline bar
- **Refresh** — the app fetches fresh Notion data on every launch. Click **"Clear cache & refresh"** to force a re-sync mid-session.

---

## Folder structure

```
tl-boss-app/
  main.js          Electron main process — Notion API calls, IPC handlers
  preload.js       Secure bridge between main and renderer
  src/
    index.html     The entire dashboard UI (single file)
  package.json
  README.md
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "No Notion token configured" | Re-enter your token via the setup screen (clear localStorage or reinstall) |
| Projects not showing | Make sure your integration is connected to each Notion project page |
| App won't start | Run `npm install` again; make sure Node.js ≥ 18 is installed |
| Blank screen | Open DevTools (`Ctrl+Shift+I`) and check the console for errors |

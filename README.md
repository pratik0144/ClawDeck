# 🦞 ClawDeck — Local Developer Dashboard

> A Chrome-based developer command center that lets you trigger dev tasks with one click and watch live terminal output stream in real-time.

![Status](https://img.shields.io/badge/status-MVP-blueviolet)
![Platform](https://img.shields.io/badge/platform-Chrome%20(Local)-blue)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB)
![Backend](https://img.shields.io/badge/backend-Node.js%20%2B%20Express-339933)
![Realtime](https://img.shields.io/badge/realtime-Socket.IO-010101)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Usage Guide](#usage-guide)
- [Task Reference](#task-reference)
- [Frontend — Component Architecture](#frontend--component-architecture)
- [Frontend — Styling & Design System](#frontend--styling--design-system)
- [Backend — Server & Task Handlers](#backend--server--task-handlers)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Configuration](#configuration)
- [Tech Stack](#tech-stack)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

**ClawDeck** is a local-only developer dashboard designed to run in Chrome on your laptop. Instead of switching between multiple terminal tabs to run common dev tasks, you click a button on a beautiful dark dashboard and watch the output stream live — like having a mission control for your codebase.

### Why ClawDeck?

- 🖱️ **One-click execution** — No more typing repetitive terminal commands
- 📡 **Live log streaming** — See stdout/stderr in real-time via WebSocket
- 🤖 **OpenCode-first** — Leverages OpenCode CLI for intelligent task execution, with automatic child_process fallback
- 🌑 **Dark, modern UI** — Clean card-based dashboard with glassmorphism and glow effects
- 📱 **Mobile-optimized layout** — Responsive grid that works on any screen size

---

## Features

| Feature | Description |
|---------|-------------|
| **10 Task Buttons** | Pre-configured cards for common dev workflows |
| **Live Terminal Panel** | Monospace, color-coded log output (green for stdout, red for stderr, purple for info) |
| **Status Indicator** | Real-time badge showing Idle → Running → Success / Error |
| **Running Task Banner** | Shows which task is currently executing with a spinner |
| **WebSocket Streaming** | Continuous log push — not polling, true real-time |
| **OpenCode Integration** | Tries OpenCode CLI first for AI-powered execution |
| **Fallback Execution** | Automatically falls back to direct shell commands if OpenCode is unavailable |
| **Clear Logs** | One-click log panel reset |
| **Glow Hover Effects** | Each button has a unique accent color with hover glow |
| **Glass Header** | Sticky glassmorphic header with backdrop blur |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Chrome Browser                │
│  ┌───────────────────────────────────────────┐  │
│  │         React Dashboard (port 5173)       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────┐  │  │
│  │  │ Task Card│  │ Task Card│  │  ...   │  │  │
│  │  └────┬─────┘  └────┬─────┘  └───┬────┘  │  │
│  │       │              │            │       │  │
│  │       ▼              ▼            ▼       │  │
│  │   POST /api/run-task { task: "..." }      │  │
│  │                                           │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │       Live Terminal Panel           │  │  │
│  │  │  (receives Socket.IO events)        │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────────┘
                │ HTTP + WebSocket
                ▼
┌───────────────────────────────────────────────────┐
│           Express + Socket.IO (port 3001)         │
│                                                   │
│   POST /api/run-task ──► Task Handler             │
│                            │                      │
│                   ┌────────┴────────┐             │
│                   ▼                 ▼             │
│            OpenCode CLI      child_process        │
│           (AI execution)    (direct shell)        │
│                   │                 │             │
│                   └────────┬────────┘             │
│                            ▼                      │
│              stdout/stderr streaming              │
│                            │                      │
│              Socket.IO emit("task:log")           │
│              Socket.IO emit("task:status")        │
└───────────────────────────────────────────────────┘
```

### Data Flow

1. **User clicks a task button** on the React dashboard
2. **Frontend sends** `POST /api/run-task` with `{ task: "task-id" }` to the Express backend
3. **Backend selects the handler** and attempts to run it via OpenCode CLI first
4. **If OpenCode fails**, backend falls back to `child_process.spawn()` with the direct shell command
5. **stdout/stderr are streamed** line-by-line via Socket.IO `task:log` events
6. **Status updates** are broadcast via Socket.IO `task:status` events
7. **Frontend renders** each log line in the terminal panel in real-time

---

## Project Structure

```
samsung/                          # Project root
│
├── README.md                     # ← This file (single source of truth)
│
├── frontend/                     # React + Vite client application
│   ├── index.html                # HTML entry point — title, meta, viewport
│   ├── vite.config.js            # Vite config — Tailwind plugin, API proxy, port
│   ├── package.json              # Frontend dependencies and scripts
│   ├── eslint.config.js          # ESLint configuration
│   ├── public/
│   │   ├── favicon.svg           # Browser tab icon
│   │   └── icons.svg             # SVG icon sprites
│   └── src/
│       ├── main.jsx              # React DOM root — mounts <App /> in StrictMode
│       ├── App.jsx               # Main dashboard — all components (cards, logs, status)
│       ├── App.css               # Empty (all styles handled in index.css)
│       └── index.css             # Tailwind imports + design tokens + animations
│
└── backend/                      # Node.js + Express server
    ├── server.js                 # Express server, Socket.IO, 10 task handlers
    └── package.json              # Backend dependencies and scripts
```

### Key Files Explained

| File | What It Does |
|------|-------------|
| `frontend/vite.config.js` | Registers React and Tailwind Vite plugins. Dev server on port **5173** with proxy forwarding `/api/*` and `/socket.io` to backend port **3001**. |
| `frontend/src/index.css` | Imports Tailwind via `@import "tailwindcss"`. Defines all CSS custom properties (design tokens), scrollbar styles, terminal log classes, keyframe animations, and the `.glass` glassmorphism utility. |
| `frontend/src/App.jsx` | Single-file dashboard: task definitions array, `StatusBadge`, `TaskCard`, `LogPanel` components, and the main `App` component with Socket.IO connection logic. |
| `frontend/src/main.jsx` | React 19 entry — wraps `<App />` in `<StrictMode>`, mounts to `#root`. |
| `backend/server.js` | Express server with Socket.IO. Defines `runCommand()` helper that spawns child processes and streams output. Contains `runViaOpenCode()` for OpenCode-first execution. All 10 task handlers with fallback logic. |

---

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Google Chrome** | Latest | — |
| **OpenCode CLI** *(optional)* | Any | `which opencode` |

> **Note:** OpenCode is optional. If it's not installed or fails, ClawDeck automatically falls back to direct shell execution via `child_process`.

---

## Installation

### 1. Navigate to the project

```bash
cd ~/Developer/samsung
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Install backend dependencies

```bash
cd ../backend
npm install
```

That's it — no global packages, no Docker, no build step needed for development.

---

## Running the App

You need **two terminal windows** — one for the backend, one for the frontend.

### Terminal 1 — Start the Backend

```bash
cd ~/Developer/samsung/backend
node server.js
```

Expected output:

```
  ⚡ ClawDeck Backend running on http://localhost:3001
  📁 Project directory: /Users/<you>/Developer/samsung
  🔌 WebSocket ready
```

### Terminal 2 — Start the Frontend

```bash
cd ~/Developer/samsung/frontend
npm run dev
```

Expected output:

```
  VITE v8.x.x  ready in ~1s

  ➜  Local:   http://localhost:5173/
```

### 3. Open in Chrome

Navigate to **http://localhost:5173** in Google Chrome.

> **Important:** Start the backend **before** the frontend so the WebSocket connection succeeds on page load.

---

## Usage Guide

### Dashboard Layout

| Section | Description |
|---------|-------------|
| **Header** | "ClawDeck" branding with the current status badge (Idle / Running / Success / Error) |
| **Task Grid** | 10 clickable task cards arranged in a responsive grid (2 cols mobile → 5 cols desktop) |
| **Running Banner** | Appears when a task is executing, shows task name with a loading spinner |
| **Live Terminal** | Monospace log output panel with auto-scroll and a Clear button |
| **Footer** | Version info |

### How to Use

1. **Click any task button** to trigger it
2. Watch the **status badge** change from `Idle` → `Running`
3. **Log output** appears in the terminal panel in real-time
4. When done, status changes to `Success` (green) or `Error` (red)
5. Click **Clear** to reset the log panel
6. Buttons are **disabled** while a task is running to prevent overlapping executions

---

## Task Reference

| # | Button | Task ID | Command Executed | Description |
|---|--------|---------|-----------------|-------------|
| 1 | ▶ Run Dev Server | `run-dev` | `npm run dev` | Starts the project's development server |
| 2 | ⏹ Stop Dev Server | `stop-dev` | `kill` on ports 3000, 5173, 8080 | Kills the active process and clears dev server ports |
| 3 | 🔌 Kill Port | `kill-port` | `lsof -ti :<port> \| xargs kill -9` | Clears processes on ports 3000, 5173, 8080 individually |
| 4 | ⬇ Git Pull | `git-pull` | `git pull` | Pulls latest changes from remote |
| 5 | 📝 Git Commit | `git-commit` | `git add -A && git commit` | Stages all changes and commits |
| 6 | ⬆ Git Push | `git-push` | `git push` | Pushes current branch to remote origin |
| 7 | 📦 Install Dependencies | `install-deps` | `npm install` | Installs or updates node_modules |
| 8 | 🧪 Run Tests | `run-tests` | `npm test` | Runs the project test suite |
| 9 | 📋 Open Logs | `open-logs` | `git log --oneline -20` | Shows recent git history or directory listing |
| 10 | 🔧 Fix Build | `fix-build` | `npm run build` | Attempts a production build to surface errors |

> **OpenCode priority:** Every task first attempts execution via `opencode "<prompt>"`. If OpenCode is unavailable or the command fails, it falls back to the direct shell command listed above.

---

## Frontend — Component Architecture

The dashboard is built from four React components, all co-located in `src/App.jsx`:

```
<App>                           ← Main layout, Socket.IO connection, state management
├── <StatusBadge>               ← Top-right status pill (Idle/Running/Success/Error)
├── <TaskCard> × 10             ← Clickable task buttons rendered in a CSS grid
└── <LogPanel>                  ← Terminal-style live log display with auto-scroll
```

### `App` (Main Component)

| Responsibility | Details |
|---------------|---------|
| **State** | `status` (idle/running/success/error), `logs` (array of log objects), `activeTask` (string or null) |
| **Socket.IO** | Connects to `http://localhost:3001` on mount, listens for `task:log` and `task:status` |
| **Task Trigger** | `runTask(taskId)` — sets status to running, sends `POST /api/run-task`, handles errors |
| **Layout** | Sticky glass header → optional running banner → task grid → log panel → footer |

### `StatusBadge`

Displays the current execution status as a colored pill in the header:

| Status | Dot Color | Text | Effect |
|--------|-----------|------|--------|
| `idle` | Gray | Idle | None |
| `running` | Yellow | Running | Pulsing glow animation |
| `success` | Green | Success | None |
| `error` | Red | Error | None |

### `TaskCard`

A single task button rendered as a rounded card with:
- **Unique icon and accent color** per task (emoji icon + hex color)
- **Hover effect** — border glows in the task's accent color, card scales up 4%, accent bar slides in from center
- **Click effect** — card scales down 3% for tactile feedback
- **Disabled state** — 40% opacity, no hover, no cursor when another task is running

### `LogPanel`

Terminal-style output display:
- **Auto-scroll** to the latest log line using a `ref` and `scrollIntoView`
- **Color-coded lines** — green (stdout), red (stderr), purple (info)
- **Monospace font** — JetBrains Mono at 12px with 1.6 line height
- **Clear button** — resets the entire log buffer
- **Empty state** — "Waiting for task execution..." placeholder

### Task Definition Array

Tasks are defined as a static array at the top of `App.jsx`:

| ID | Label | Icon | Accent Color |
|----|-------|------|-------------|
| `run-dev` | Run Dev Server | ▶ | `#00d68f` (green) |
| `stop-dev` | Stop Dev Server | ⏹ | `#ff4757` (red) |
| `kill-port` | Kill Port | 🔌 | `#ffa502` (orange) |
| `git-pull` | Git Pull | ⬇ | `#1e90ff` (blue) |
| `git-commit` | Git Commit | 📝 | `#6c5ce7` (purple) |
| `git-push` | Git Push | ⬆ | `#00b894` (teal) |
| `install-deps` | Install Dependencies | 📦 | `#e17055` (coral) |
| `run-tests` | Run Tests | 🧪 | `#fdcb6e` (yellow) |
| `open-logs` | Open Logs | 📋 | `#74b9ff` (light blue) |
| `fix-build` | Fix Build | 🔧 | `#a29bfe` (lavender) |

---

## Frontend — Styling & Design System

### Design Tokens (CSS Custom Properties)

All colors and theme values are defined in `src/index.css` under `:root`:

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0a0a0f` | Page background |
| `--bg-secondary` | `#12121a` | Secondary surfaces |
| `--bg-card` | `#1a1a2e` | Task card background |
| `--bg-card-hover` | `#222240` | Card hover state |
| `--border-color` | `#2a2a4a` | Default borders |
| `--border-glow` | `#6c5ce7` | Accent glow border |
| `--text-primary` | `#e8e8f0` | Main text color |
| `--text-secondary` | `#8888a8` | Subtitles and labels |
| `--text-muted` | `#5a5a7a` | Muted/dimmed text |
| `--accent` | `#6c5ce7` | Primary accent (purple) |
| `--accent-hover` | `#7c6ef7` | Accent hover state |
| `--accent-glow` | `rgba(108, 92, 231, 0.3)` | Glow shadow color |
| `--success` | `#00d68f` | Success state color |
| `--error` | `#ff4757` | Error state color |
| `--warning` | `#ffa502` | Warning state color |
| `--terminal-green` | `#00ff88` | Terminal stdout text |
| `--terminal-bg` | `#0d0d14` | Terminal panel background |

### Typography

| Font | Source | Usage |
|------|--------|-------|
| **Inter** (400–800) | Google Fonts | All UI text — headings, labels, buttons |
| **JetBrains Mono** (400–500) | Google Fonts | Terminal log panel (monospace) |

### Animations

| Animation | CSS Class | Duration | Usage |
|-----------|-----------|----------|-------|
| Pulsing glow | `.animate-pulse-glow` | 2s ease-in-out infinite | Running status badge |
| Slow spin | `.animate-spin-slow` | 2s linear infinite | Loading spinner SVG |

### Glassmorphism

The `.glass` utility class creates a frosted-glass effect:
```css
.glass {
  background: rgba(26, 26, 46, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(108, 92, 231, 0.15);
}
```
Used on the sticky header bar.

### Responsive Grid

The task card grid adapts to screen width using Tailwind breakpoints:

| Breakpoint | Columns | Screen |
|------------|---------|--------|
| Default | 2 columns | Mobile (< 640px) |
| `sm:` | 3 columns | Small (≥ 640px) |
| `md:` | 5 columns | Desktop (≥ 768px) |

### Custom Scrollbar

Styled for WebKit browsers (Chrome):
- **Track:** `--bg-secondary` (#12121a)
- **Thumb:** `--border-color` (#2a2a4a), 3px border radius
- **Thumb hover:** `--accent` (#6c5ce7)
- **Width:** 6px

---

## Backend — Server & Task Handlers

### Server Setup (`backend/server.js`)

The backend is a single-file Express + Socket.IO server:

```
Express App
├── Middleware: cors(), express.json()
├── Routes:
│   ├── POST /api/run-task     → triggers a task handler
│   └── GET  /api/health       → returns { status: "ok", uptime }
└── Socket.IO Server
    └── On "connection" → sends welcome message + idle status
```

### Core Functions

| Function | Purpose |
|----------|---------|
| `broadcastLog(type, text)` | Emits `task:log` to all connected Socket.IO clients |
| `broadcastStatus(status, message)` | Emits `task:status` to all connected clients |
| `runCommand(command, args, options)` | Spawns a child process, streams stdout/stderr via `broadcastLog`, returns a Promise |
| `runViaOpenCode(prompt, fallbackCmd, fallbackArgs)` | Tries OpenCode first; on failure, runs the fallback command |

### `runCommand()` Details

- Uses `child_process.spawn()` with `shell: true`
- Sets `FORCE_COLOR: '0'` to disable ANSI color codes in output
- Tracks the active process in a global `activeProcess` variable
- Streams `stdout` and `stderr` line-by-line via `broadcastLog()`
- Resolves on exit code 0, rejects on non-zero exit

### `runViaOpenCode()` Details

```javascript
async function runViaOpenCode(prompt, fallbackCmd, fallbackArgs) {
  try {
    await runCommand('opencode', [JSON.stringify(prompt)]);
  } catch (err) {
    broadcastLog('info', '● OpenCode unavailable or failed, using direct execution...');
    await runCommand(fallbackCmd, fallbackArgs);
  }
}
```

1. Attempts to run `opencode "prompt"` as a shell command
2. If that fails (OpenCode not installed, non-zero exit, etc.), logs an info message
3. Falls back to the direct command (e.g., `git pull`, `npm install`)

### Task Handler Examples

**`run-dev`:**
```javascript
'run-dev': async () => {
  broadcastStatus('running', 'Starting dev server...');
  try {
    await runViaOpenCode('Run npm run dev in the current project', 'npm', ['run', 'dev']);
    broadcastStatus('success', 'Dev server started');
  } catch (err) {
    broadcastStatus('error', `Failed: ${err.message}`);
  }
}
```

**`kill-port`:**
```javascript
'kill-port': async () => {
  broadcastStatus('running', 'Killing common ports...');
  for (const port of [3000, 5173, 8080]) {
    try {
      await runCommand('sh', ['-c', `lsof -ti :${port} | xargs kill -9 2>/dev/null || true`]);
      broadcastLog('stdout', `Port ${port} cleared`);
    } catch { /* port not in use */ }
  }
  broadcastStatus('success', 'Ports cleared');
}
```

---

## API Reference

### `POST /api/run-task`

Triggers a task execution. Returns immediately — actual output streams via WebSocket.

**Request:**
```json
{
  "task": "run-dev"
}
```

**Valid task IDs:** `run-dev`, `stop-dev`, `kill-port`, `git-pull`, `git-commit`, `git-push`, `install-deps`, `run-tests`, `open-logs`, `fix-build`

**Success Response (200):**
```json
{
  "ok": true,
  "task": "run-dev",
  "message": "Task \"run-dev\" started"
}
```

**Error — Missing task (400):**
```json
{
  "error": "Missing \"task\" in request body"
}
```

**Error — Unknown task (400):**
```json
{
  "error": "Unknown task: invalid-task"
}
```

---

### `GET /api/health`

Health check endpoint.

**Response (200):**
```json
{
  "status": "ok",
  "uptime": 123.456
}
```

---

## WebSocket Events

ClawDeck uses [Socket.IO](https://socket.io) for real-time communication.

### Connection

The frontend connects on component mount:
```javascript
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
})
```

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `task:log` | `{ type: "stdout" \| "stderr" \| "info", text: string }` | A single line of command output |
| `task:status` | `{ status: "idle" \| "running" \| "success" \| "error", message: string }` | Task execution status change |

### Log Type Colors

| Type | Color | Hex | Used For |
|------|-------|-----|----------|
| `stdout` | 🟢 Green | `#00ff88` | Standard command output |
| `stderr` | 🔴 Red | `#ff4757` | Error output |
| `info` | 🟣 Purple | `#6c5ce7` | System messages (connected, task started, status updates) |

### Connection Lifecycle

1. **On page load** → Socket connects, server sends welcome message + idle status
2. **On task trigger** → Logs stream in via `task:log` events, status set to `running`
3. **On task complete** → `task:status` with `success` or `error`, frontend re-enables buttons
4. **On page close** → Socket disconnects cleanly

---

## Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_DIR` | Parent of `backend/` directory | Working directory for all spawned commands |

**Example — point to a different project:**
```bash
PROJECT_DIR=/path/to/your/project node server.js
```

### Port Configuration

| Service | Default Port | Where to Change |
|---------|-------------|-----------------|
| Frontend (Vite) | `5173` | `frontend/vite.config.js` → `server.port` |
| Backend (Express + Socket.IO) | `3001` | `backend/server.js` → `PORT` constant |

> If you change the backend port, update the Vite proxy config and the Socket.IO connection URL in `App.jsx` to match.

### Vite Proxy Configuration

The frontend Vite config proxies API and WebSocket requests to the backend during development:

```javascript
// frontend/vite.config.js
server: {
  port: 5173,
  proxy: {
    '/api': 'http://localhost:3001',
    '/socket.io': {
      target: 'http://localhost:3001',
      ws: true,
    },
  },
}
```

This means:
- `fetch('/api/run-task')` in the browser → forwarded to `http://localhost:3001/api/run-task`
- WebSocket connections to `/socket.io` → forwarded to backend Socket.IO server

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **UI Framework** | React | 19.x | Component-based dashboard rendering |
| **Build Tool** | Vite | 8.x | Dev server with HMR, proxy, and bundling |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS via `@tailwindcss/vite` plugin |
| **UI Font** | Inter | — | Primary interface typeface (Google Fonts) |
| **Mono Font** | JetBrains Mono | — | Terminal log panel (Google Fonts) |
| **Server** | Express | 4.x | REST API for task triggering |
| **Realtime** | Socket.IO | 4.x | WebSocket-based log streaming |
| **Execution** | OpenCode CLI | — | AI-powered command execution (primary) |
| **Fallback** | child_process | (Node built-in) | Direct shell command spawning |
| **CORS** | cors | 2.x | Cross-origin request handling |

---

## Troubleshooting

### Frontend Issues

| Problem | Solution |
|---------|----------|
| **Blank page** | Check browser console for errors. Run `npm install` in `frontend/`. |
| **Port 5173 in use** | `lsof -ti :5173 \| xargs kill -9` |
| **Tailwind styles not applying** | Ensure `@import "tailwindcss"` is the first line of `src/index.css`. |
| **API calls returning 404** | Backend isn't running, or the Vite proxy config is wrong. |

### Backend Issues

| Problem | Solution |
|---------|----------|
| **Port 3001 in use** | `lsof -ti :3001 \| xargs kill -9` |
| **"Cannot find module" error** | Run `npm install` in `backend/`. |
| **DeprecationWarning about shell args** | Cosmetic Node.js warning — safe to ignore, doesn't affect functionality. |

### Runtime Issues

| Problem | Solution |
|---------|----------|
| **"Disconnected from server" in logs** | Backend crashed or isn't running. Restart with `node server.js`. |
| **Buttons greyed out permanently** | A task's status never resolved. Restart the backend to reset state. |
| **"Not a git repo" on git tasks** | The `PROJECT_DIR` isn't a git repository. Run `git init` or set `PROJECT_DIR` to a repo. |
| **OpenCode commands failing** | Expected if OpenCode isn't installed. Backend auto-falls back to direct commands. Look for `"using direct execution..."` in the logs. |
| **Logs not appearing** | Check that both servers are running and that the Vite proxy is configured. |

---

## Roadmap

- [ ] **OpenClaw mobile app** — Trigger tasks from your phone
- [ ] **Custom task editor** — Add/edit tasks from the dashboard UI
- [ ] **Task history** — View and replay past execution logs
- [ ] **Multiple project support** — Switch between project directories
- [ ] **Authentication** — Secure the dashboard for network access
- [ ] **Task chaining** — Run multiple tasks in sequence
- [ ] **Environment switcher** — Toggle between dev/staging/prod configs
- [ ] **Notifications** — Desktop notifications on task completion

---

## License

This project is for personal/internal use. No license specified.

---

<p align="center">
  Built with ⚡ by ClawDeck
</p>

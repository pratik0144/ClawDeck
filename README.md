# 🦀 ClawDeck

**AI-Powered Developer Dashboard — Local Chrome MVP & Mobile Companion**

ClawDeck is a responsive developer dashboard that lets you trigger common developer tasks with one click. It uses a **Hybrid AI-First architecture** — simple tasks run instantly via direct shell, while complex tasks are handled by a MiniMax AI agent through [OpenCode](https://opencode.ai). The dashboard features **QR-based Mobile Pairing** for native-like control from your phone, and a **GitHub Extension Bridge** to instantly download and run external repositories.

---

## 📸 Screenshots

<div align="center">
  <img src="assets/laptop-pairing.png" alt="Laptop Pairing View" width="800"/>
  <br/>
  <i>Laptop View: Secure QR Pairing</i>
  <br/><br/>
  <img src="assets/mobile-dashboard.png" alt="Mobile Dashboard View" width="350"/>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/mobile-terminal.png" alt="Mobile Terminal View" width="350"/>
  <br/>
  <i>Mobile View: Control Dashboard & Real-time Terminal Sync</i>
  <br/><br/>
  <a href="https://youtu.be/g6QFjMWBRlI" target="_blank">
    <img src="https://img.youtube.com/vi/g6QFjMWBRlI/maxresdefault.jpg" alt="ClawDeck Demo Video" width="800"/>
  </a>
  <br/>
  <i>Watch the 4-minute Full Demo Video</i>
</div>

---

## 🎬 Demo

| Kill Port (Direct Shell — instant) | Test AI (OpenCode Agent — ~6s) |
|---|---|
| `⚙️ $ lsof -ti :3000 \| xargs kill -9` | `🔥 OpenCode agent started` |
| `Port 3000 cleared` | `$ echo "Hello from MiniMax AI"` |
| `Port 5173 cleared` | `Hello from MiniMax AI` |
| `✅ Ports cleared` | `✅ Agent completed` |

---

## 📐 Architecture

```
┌──────────────────────────────────────────────┐
│        ClawDeck Frontend (Laptop & Mobile)   │
│   React + Vite + Tailwind CSS + QR Pairing   │
│              http://localhost:5173           │
│                                              │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌─────────┐   │
│   │Smart │ │ Run  │ │ Kill │ │ GitHub  │   │
│   │Task 🧠│ │ Dev ▶│ │ Port │ │ Bridge  │   │
│   └──┬───┘ └──┬───┘ └──┬───┘ └───┬─────┘   │
│      │        │        │         │           │
│      └────────┴────────┴─────────┘           │
│                    │                         │
│              Socket.IO + REST                │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│              ClawDeck Backend                │
│         Node.js + Express + Socket.IO        │
│              http://localhost:3001           │
│                                              │
│   ┌─────────────────┐  ┌──────────────────┐ │
│   │  Direct Shell    │  │  OpenCode Agent  │ │
│   │  (spawn)         │  │  (execSync)      │ │
│   │                  │  │                  │ │
│   │  • run-dev       │  │  • smart-task    │ │
│   │  • stop-dev      │  │  • git-commit    │ │
│   │  • kill-port     │  │  • fix-build     │ │
│   │  • download-repo │  │                  │ │
│   │  • git-push      │  │  Model:          │ │
│   │  • install-deps  │  │  minimax-m2.5    │ │
│   │  • run-tests     │  │  -free           │ │
│   │  • open-logs     │  │                  │ │
│   └─────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────┘
```

### Hybrid AI-First Model

| Layer | Tasks | Engine | Speed | Use When |
|-------|-------|--------|-------|----------|
| **Direct Shell** | run-dev, stop-dev, kill-port, git-pull, git-push, install-deps, run-tests, open-logs | `child_process.spawn()` | **Instant** | Deterministic, no reasoning needed |
| **AI Agent** | test-ai, git-commit, fix-build | `execSync` → OpenCode CLI | **~6 seconds** | Requires thinking, analysis, or generation |

> **Why `execSync` for AI?** OpenCode buffers all stdout when piped via `spawn()` (no PTY). `execSync` captures the full output reliably after process completion, then broadcasts it line-by-line to the UI.

---

## 🛠️ Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Frontend** | React | 19.x |
| **Build Tool** | Vite | 8.x |
| **Styling** | Tailwind CSS | 4.x |
| **Backend** | Express | 4.x |
| **Real-Time** | Socket.IO | 4.x |
| **Utilities** | Lucide React, qrcode.react, uuid | — |
| **AI Agent** | OpenCode CLI | Latest |
| **AI Model** | opencode/minimax-m2.5-free | — |

---

## 📁 Project Structure

```
samsung/
├── README.md
├── CHANGELOG.md
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   └── server.js            ← Hybrid task engine 
│
└── frontend/
    ├── package.json
    ├── package-lock.json
    ├── index.html
    ├── vite.config.js
    ├── eslint.config.js
    │
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    │
    └── src/
        ├── main.jsx          ← React entry point
        ├── App.jsx           ← Dashboard UI (282 lines)
        ├── App.css           ← Component styles
        ├── index.css         ← Global styles + Tailwind
        └── assets/
            ├── hero.png
            ├── react.svg
            └── vite.svg
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Install |
|-------------|---------|
| **Node.js** ≥ 18 | [nodejs.org](https://nodejs.org) |
| **npm** ≥ 9 | Comes with Node.js |
| **OpenCode CLI** | [opencode.ai](https://opencode.ai) |
| **Git** | [git-scm.com](https://git-scm.com) |

### Installation

```bash
# Clone / navigate to project
cd ~/Developer/samsung

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Running (macOS / Linux)

**Terminal 1 — Backend:**
```bash
cd ~/Developer/samsung/backend
node server.js
```

**Terminal 2 — Frontend:**
```bash
cd ~/Developer/samsung/frontend
npm run dev
```

**Open browser:** http://localhost:5173

### Running (Windows)

Same commands — use PowerShell or Command Prompt. Replace `~` with `%USERPROFILE%`.

### Single Command (Quick Start)

```bash
cd ~/Developer/samsung && \
  (cd backend && npm install && node server.js &) && \
  (cd frontend && npm install && npm run dev)
```

---

## 🎮 Task Reference

### 🧠 Smart Task Routing
You can type natural language into the **Smart Task** input. The backend dynamically heuristics text to decide:
- **Direct Shell**: "run dev", "kill port", "git pull", "install dep"
- **AI Agent**: Any other complex query is sent to OpenCode for reasoning.



### NON-AI Tasks (Direct Shell — Instant)

| Button | Action | Command |
|--------|--------|---------|
| ▶ **Run Dev Server** | Starts Vite dev server | `npm run dev` |
| ⏹ **Stop Dev Server** | Kills active process + clears ports | `kill` + `lsof -ti :PORT` |
| 🔌 **Kill Port** | Force-kills processes on 3000, 5173, 8080 | `lsof -ti :PORT \| xargs kill -9` |
| ⬇ **Git Pull** | Pulls latest from remote | `git pull` |
| ⬆ **Git Push** | Pushes to remote | `git push` |
| 📦 **Install Dependencies** | Installs npm packages | `npm install` |
| 🧪 **Run Tests** | Runs test suite | `npm test -- --passWithNoTests` |
| 📋 **Open Logs** | Shows recent git history | `git log --oneline -20` |

### AI Tasks (OpenCode Agent — ~6s)

| Button | What AI Does | Timeout |
|--------|-------------|---------|
| 🧠 **Test AI** | Runs `echo "Hello from MiniMax AI"` to verify connection | 15s |
| 📝 **Git Commit** | Analyzes staged changes, generates a conventional commit message, commits | 30s |
| 🔧 **Fix Build** | Runs build, reads errors, fixes source code, retries (up to 3 attempts) | 45s |

---

## 🔌 API Reference

### REST

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/run-task` | `{ "task": "test-ai" }` | Trigger a task |
| `POST` | `/api/smart-task` | `{ "input": "..." }` | Smart heuristic task routing |
| `POST` | `/api/download-repo`| `{ "repoUrl": "..." }` | Download & extract GitHub repo |
| `POST` | `/api/download-user-repos`| `{ "username": "..." }`| Download top 5 repos for a user |
| `GET` | `/api/system-stats`| — | Get CPU load and RAM usage |
| `GET` | `/api/session/create`| — | Create a new Mobile-Laptop session |
| `POST` | `/api/session/pair`| `{ "token": "..." }` | Pair a mobile device to laptop |
| `GET` | `/api/health` | — | Server health + model info |

### WebSocket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `task:log` | Server → Client | `{ type: "stdout"\|"stderr"\|"info", text: "..." }` | Live log line |
| `task:status` | Server → Client | `{ status: "idle"\|"running"\|"success"\|"error", message: "..." }` | Task state |
| `session:paired`| Server → Client | `{ token: "..." }` | Mobile has paired |
| `project:changed`| Server → Client | `{ path: "..." }` | Project directory changed |

### Log Types

| Type | Color | Used For |
|------|-------|----------|
| `stdout` | 🟢 Green | Command output |
| `stderr` | 🔴 Red | Errors |
| `info` | 🟣 Purple | System messages |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_DIR` | Parent of `backend/` | Working directory for all commands |
| `OPEN_TERMINAL` | `false` | Open macOS Terminal for visual demo |

```bash
# Example: point to a different project
PROJECT_DIR=/path/to/project node server.js

# Example: enable macOS Terminal popups
OPEN_TERMINAL=true node server.js
```

### Ports

| Service | Port | Change In |
|---------|------|-----------|
| Frontend (Vite) | 5173 | `frontend/vite.config.js` |
| Backend (Express) | 3001 | `backend/server.js` (line 11) |

---

## 🧠 AI Agent Details

### Model

**`opencode/minimax-m2.5-free`** — free-tier MiniMax model via OpenCode.

### CLI Command

```bash
opencode run "<prompt>" \
  --model opencode/minimax-m2.5-free \
  --dir ~/Developer/samsung \
  --dangerously-skip-permissions
```

### Prompt Format

All AI tasks use structured prompts:

```
You are an AI developer agent.

Task: <description>

- Step 1
- Step 2
- Show results
```

### Execution Flow

```
1. User clicks AI button
2. Backend calls execSync(opencode run ...)
3. OpenCode agent receives prompt
4. Agent executes commands in BUILD mode
5. Full output captured after process exits
6. Output broadcast line-by-line via Socket.IO
7. UI updates status to Success/Error
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "OpenCode not found" | Install: `curl -fsSL https://opencode.ai/install \| sh` |
| AI tasks timeout | Increase `AGENT_TIMEOUT` in `server.js` (default: 45s) |
| Port already in use | Click "Kill Port" or run `lsof -ti :3001 \| xargs kill -9` |
| Frontend not loading | Check Vite is running on port 5173 |
| WebSocket disconnect | Restart backend, check CORS settings |
| "Exit code 1" on git tasks | Ensure you're in a git repo with a remote configured |

---

## 📜 License

MIT

---

## 🤝 Credits

- **OpenCode** — AI agent CLI ([opencode.ai](https://opencode.ai))
- **MiniMax** — AI model provider
- **Vite** — Lightning-fast frontend tooling
- **Socket.IO** — Real-time bidirectional communication

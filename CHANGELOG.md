# Changelog

All notable changes to ClawDeck are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.3.0] — 2026-05-02

### 🧠 Hybrid AI-First Architecture

Complete backend rewrite to a clean hybrid model.

#### Added
- **`runWithAgent()`** — OpenCode AI execution engine using `execSync` for reliable output capture
- **`buildPrompt()`** — Structured prompt builder for AI tasks
- **Test AI button** (🧠) — Verifies MiniMax AI connectivity by running `echo "Hello from MiniMax AI"`
- **macOS Terminal support** — Optional `OPEN_TERMINAL=true` flag opens Terminal.app for visual demos
- **Health endpoint** — `GET /api/health` returns server status, model info, and uptime

#### Changed
- **AI model** → `opencode/minimax-m2.5-free` (confirmed working, ~6s response)
- **AI execution** → Switched from `spawn()` to `execSync()` (fixes OpenCode stdout buffering in pipe mode)
- **Task classification** — Clear split between NON-AI (8 tasks) and AI (3 tasks)
- **Prompt style** → Structured "You are an AI developer agent" format with step-by-step instructions
- **Timeout defaults** → 45s for AI, 30s for shell (configurable per-task)
- **Git Commit** → AI now analyzes `git diff --cached --stat` and generates conventional commit messages

#### Removed
- Auto-detect model fallback logic (was causing confusion)
- Fake/simulated AI responses
- Unnecessary shell fallbacks on AI tasks
- Hardcoded model override layers

#### Fixed
- **OpenCode hanging forever** — Root cause: `spawn()` buffers stdout when no PTY is attached. Fixed by using `execSync`.
- **Wrong model used at runtime** — Removed auto-fallback, hardcoded correct model
- **Double promise resolution** — Added `settled` flag guard on all async paths
- **Process zombies** — Two-stage kill: SIGTERM → 2s → SIGKILL

---

## [0.2.0] — 2026-05-02

### 🔧 Stability Fixes

#### Added
- **Timeout guards** on all task executions (AI + shell)
- **`killActive()` helper** — Clean process termination with SIGTERM/SIGKILL
- **`settled` flag** — Prevents multiple resolve/reject on promise chains
- **Agent status logging** — `🔥 Agent started`, `🤖 Model: ...` displayed in terminal panel

#### Changed
- **Model** → Switched from `ollama/minimax-m2.7:cloud` (requires paid subscription) to `opencode/minimax-m2.5-free`
- **Prompts** → Changed from vague ("Show useful logs") to deterministic ("Run: git log --oneline -20")
- **Task routing** → Separated direct-shell (fast) vs AI-agent (reasoning) strategies

#### Fixed
- OpenCode agent hanging indefinitely (no timeout existed)
- UI stuck in "Running" state forever
- Process not cleaned up after timeout
- Multiple concurrent OpenCode processes fighting for resources

---

## [0.1.0] — 2026-05-02

### 🚀 Initial MVP

#### Added
- **Frontend** — React + Vite + Tailwind CSS dashboard with 11 task buttons
- **Backend** — Node.js + Express + Socket.IO server
- **Live Terminal** — Real-time log streaming via WebSocket
- **Status Badge** — Visual indicator (Idle / Running / Success / Error)
- **Task Grid** — Mobile-optimized button layout with icons and color coding
- **10 task buttons**: Run Dev, Stop Dev, Kill Port, Git Pull, Git Commit, Git Push, Install Dependencies, Run Tests, Open Logs, Fix Build
- **OpenCode integration** — AI agent execution via CLI
- **WebSocket events** — `task:log` and `task:status` for real-time UI updates
- **CORS support** — Frontend and backend run on separate ports

#### Technical Details
- Frontend: React 19, Vite 8, Tailwind CSS 4
- Backend: Express 4, Socket.IO 4
- AI: OpenCode CLI with MiniMax model
- Ports: 5173 (frontend), 3001 (backend)

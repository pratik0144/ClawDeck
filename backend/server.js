const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');

// ═══════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════
const PORT = 3001;
const PROJECT_DIR = process.env.PROJECT_DIR || path.resolve(__dirname, '..');
const MODEL = 'opencode/minimax-m2.5-free';
const AGENT_TIMEOUT = 45000;
const OPEN_MAC_TERMINAL = process.env.OPEN_TERMINAL === 'true';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

let activeProcess = null;

// Detect OpenCode at startup
let opencodePath = null;
try {
  opencodePath = execSync('which opencode 2>/dev/null').toString().trim();
} catch { /* not installed */ }

// ═══════════════════════════════════════════════════
// Broadcast helpers
// ═══════════════════════════════════════════════════

const log = (type, text) => io.emit('task:log', { type, text });
const status = (s, msg) => io.emit('task:status', { status: s, message: msg });

function killActive() {
  if (activeProcess && !activeProcess.killed) {
    activeProcess.kill('SIGTERM');
    setTimeout(() => { if (activeProcess && !activeProcess.killed) activeProcess.kill('SIGKILL'); }, 2000);
  }
}

function openTerminal(cmd) {
  if (!OPEN_MAC_TERMINAL) return;
  try {
    spawn('osascript', ['-e',
      `tell application "Terminal"\n  activate\n  do script "cd ${PROJECT_DIR} && ${cmd}"\nend tell`
    ], { detached: true, stdio: 'ignore' }).unref();
  } catch { /* skip */ }
}

// ═══════════════════════════════════════════════════
// LAYER 1 — Direct Shell (fast, deterministic)
// ═══════════════════════════════════════════════════

function runShell(command, args = [], opts = {}) {
  const timeout = opts.timeout || 30000;
  const cwd = opts.cwd || PROJECT_DIR;

  return new Promise((resolve, reject) => {
    log('info', `⚙️ $ ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd, shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    activeProcess = child;
    let done = false;

    const timer = setTimeout(() => {
      if (!done) { done = true; killActive(); reject(new Error('Timed out')); }
    }, timeout);

    child.stdout.on('data', (d) =>
      d.toString().split('\n').forEach((l) => { if (l.trim()) log('stdout', l); })
    );
    child.stderr.on('data', (d) =>
      d.toString().split('\n').forEach((l) => { if (l.trim()) log('stderr', l); })
    );

    child.on('close', (code) => {
      if (done) return;
      done = true; clearTimeout(timer); activeProcess = null;
      code === 0 ? resolve() : reject(new Error(`Exit code ${code}`));
    });

    child.on('error', (err) => {
      if (done) return;
      done = true; clearTimeout(timer); activeProcess = null;
      reject(err);
    });
  });
}

// ═══════════════════════════════════════════════════
// LAYER 2 — OpenCode AI Agent (reasoning tasks)
//
// Uses execSync because OpenCode buffers all stdout
// when piped (no PTY). execSync captures reliably
// in ~6s, then broadcasts line by line.
// ═══════════════════════════════════════════════════

async function runWithAgent(prompt, opts = {}) {
  const timeout = opts.timeout || AGENT_TIMEOUT;

  if (!opencodePath) {
    log('stderr', '❌ OpenCode CLI not found — install from https://opencode.ai');
    throw new Error('OpenCode not installed');
  }

  const shortPrompt = prompt.split('\n').filter(l => l.trim()).slice(0, 2).join(' | ');

  console.log(`🔥 Agent | ${MODEL} | ${shortPrompt}`);
  log('info', '🔥 OpenCode agent started');
  log('info', `🤖 Model: ${MODEL}`);
  log('info', `📝 Prompt: ${shortPrompt}`);
  log('info', '─'.repeat(50));

  const escaped = prompt.replace(/"/g, '\\"');
  const cmd = `${opencodePath} run "${escaped}" --model ${MODEL} --dir ${PROJECT_DIR} --dangerously-skip-permissions 2>&1`;

  console.log(`   $ ${cmd.substring(0, 150)}...`);
  openTerminal(`opencode run "${shortPrompt}" --model ${MODEL} --dangerously-skip-permissions`);

  try {
    const output = execSync(cmd, {
      timeout,
      encoding: 'utf8',
      cwd: PROJECT_DIR,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TERM: 'dumb' },
    });

    // Broadcast each line
    for (const line of output.split('\n')) {
      const clean = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
      if (clean) log('stdout', clean);
    }

    log('info', '─'.repeat(50));
    log('info', '✅ Agent completed');

  } catch (err) {
    // Timeout
    if (err.killed) {
      log('info', `⏱️ Agent timeout (${timeout / 1000}s)`);
      throw new Error(`Agent timed out after ${timeout / 1000}s`);
    }

    // Non-zero exit — still broadcast any output
    if (err.stdout) {
      for (const line of err.stdout.split('\n')) {
        const clean = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
        if (clean) log('stdout', clean);
      }
    }

    log('info', '─'.repeat(50));
    log('info', `❌ Agent exited (code ${err.status || '?'})`);
    throw err;
  }
}

// ═══════════════════════════════════════════════════
// Task Handlers — Hybrid AI-First
//
// NON-AI: deterministic, instant, no reasoning needed
// AI:     requires thinking, analysis, or generation
// ═══════════════════════════════════════════════════

const tasks = {

  // ─── NON-AI (direct shell) ──────────────────────

  'run-dev': async () => {
    status('running', 'Starting dev server...');
    try {
      openTerminal('npm run dev');
      await runShell('npm', ['run', 'dev'], { timeout: 10000 });
      status('success', 'Dev server started');
    } catch (e) { status('error', e.message); }
  },

  'stop-dev': async () => {
    status('running', 'Stopping dev server...');
    try {
      if (activeProcess) killActive();
      for (const p of [3000, 5173, 8080]) {
        try { await runShell('sh', ['-c', `lsof -ti :${p} | xargs kill -9 2>/dev/null || true`], { timeout: 5000 }); } catch {}
        log('stdout', `Port ${p} cleared`);
      }
      status('success', 'Dev server stopped');
    } catch (e) { status('error', e.message); }
  },

  'kill-port': async () => {
    status('running', 'Killing ports 3000, 5173, 8080...');
    try {
      for (const p of [3000, 5173, 8080]) {
        try { await runShell('sh', ['-c', `lsof -ti :${p} | xargs kill -9 2>/dev/null || true`], { timeout: 5000 }); } catch {}
        log('stdout', `Port ${p} cleared`);
      }
      status('success', 'Ports cleared');
    } catch (e) { status('error', e.message); }
  },

  'git-pull': async () => {
    status('running', 'Pulling latest...');
    try {
      await runShell('git', ['pull'], { timeout: 15000 });
      status('success', 'Git pull complete');
    } catch (e) { status('error', e.message); }
  },

  'git-push': async () => {
    status('running', 'Pushing to remote...');
    try {
      await runShell('git', ['push'], { timeout: 15000 });
      status('success', 'Push complete');
    } catch (e) { status('error', e.message); }
  },

  'install-deps': async () => {
    status('running', 'Installing dependencies...');
    try {
      openTerminal('npm install');
      await runShell('npm', ['install'], { timeout: 60000 });
      status('success', 'Dependencies installed');
    } catch (e) { status('error', e.message); }
  },

  'run-tests': async () => {
    status('running', 'Running tests...');
    try {
      await runShell('npm', ['test', '--', '--passWithNoTests'], { timeout: 30000 });
      status('success', 'Tests complete');
    } catch (e) { status('error', e.message); }
  },

  'open-logs': async () => {
    status('running', 'Fetching logs...');
    try {
      try {
        await runShell('git', ['log', '--oneline', '-20'], { timeout: 10000 });
      } catch {
        log('info', 'Not a git repo — showing directory listing');
        await runShell('ls', ['-la'], { timeout: 5000 });
      }
      status('success', 'Logs retrieved');
    } catch (e) { status('error', e.message); }
  },

  // ─── AI (OpenCode agent — reasoning required) ───

  'test-ai': async () => {
    status('running', 'Testing MiniMax AI...');
    try {
      await runWithAgent(
        'You are an AI developer agent.\n\nTask: Print exactly this text: Hello from MiniMax AI\n\nRun: echo "Hello from MiniMax AI"',
        { timeout: 15000 }
      );
      status('success', 'MiniMax AI connected! 🎉');
    } catch (e) { status('error', `AI test failed: ${e.message}`); }
  },

  'git-commit': async () => {
    status('running', 'AI generating commit...');
    try {
      await runShell('git', ['add', '-A'], { timeout: 5000 });
      await runWithAgent(
        'You are an AI developer agent.\n\n'
        + 'Task: Create a git commit with a smart message.\n\n'
        + '- Run git diff --cached --stat to see what changed\n'
        + '- Generate a concise conventional commit message (feat:, fix:, chore:, etc.)\n'
        + '- Run git commit -m "<your message>"\n'
        + '- Show the commit result',
        { timeout: 30000 }
      );
      status('success', 'Changes committed');
    } catch (e) { status('error', e.message); }
  },

  'fix-build': async () => {
    status('running', 'AI fixing build...');
    try {
      await runWithAgent(
        'You are an AI developer agent.\n\n'
        + 'Task: Fix the build.\n\n'
        + '1. Run npm run build\n'
        + '2. If it fails, analyze the error output\n'
        + '3. Read the failing source files\n'
        + '4. Apply fixes to the code\n'
        + '5. Retry the build\n'
        + '6. Stop after success or 3 attempts\n\n'
        + 'Show what you changed and the final result.',
        { timeout: 45000 }
      );
      status('success', 'Build fix attempted');
    } catch (e) { status('error', e.message); }
  },
};

// ═══════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════

app.post('/api/run-task', (req, res) => {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: 'Missing "task"' });
  if (!tasks[task]) return res.status(400).json({ error: `Unknown task: ${task}` });

  tasks[task]().catch((err) => {
    log('stderr', `Unhandled: ${err.message}`);
    status('error', err.message);
  });

  res.json({ ok: true, task, message: `Task "${task}" started` });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), opencode: !!opencodePath, model: MODEL, dir: PROJECT_DIR });
});

// ═══════════════════════════════════════════════════
// WebSocket
// ═══════════════════════════════════════════════════

io.on('connection', (socket) => {
  console.log(`+ ${socket.id}`);
  socket.emit('task:log', { type: 'info', text: '● Welcome to ClawDeck' });
  socket.emit('task:log', { type: 'info', text: `🤖 OpenCode: ${opencodePath ? 'ready' : 'not found'}` });
  socket.emit('task:log', { type: 'info', text: `📦 AI Model: ${MODEL}` });
  socket.emit('task:status', { status: 'idle', message: 'Ready' });
  socket.on('disconnect', () => console.log(`- ${socket.id}`));
});

// ═══════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════

server.listen(PORT, () => {
  console.log(`\n  ⚡ ClawDeck Backend — http://localhost:${PORT}`);
  console.log(`  📁 ${PROJECT_DIR}`);
  console.log(`  🤖 ${MODEL} (${opencodePath ? 'ready' : 'NOT FOUND'})`);
  console.log(`  🔌 WebSocket ready\n`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// ═══════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════
const PORT = 3001;
let currentProjectDir = process.env.PROJECT_DIR || path.resolve(__dirname, '..');
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
  // If timeout is explicitly set to 0, it means run indefinitely. Otherwise default to 30s.
  const timeout = opts.timeout !== undefined ? opts.timeout : 30000;
  const cwd = opts.cwd || currentProjectDir;

  return new Promise((resolve, reject) => {
    log('info', `⚙️ $ ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd, shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    activeProcess = child;
    let done = false;
    let timer = null;

    if (timeout > 0) {
      timer = setTimeout(() => {
        if (!done) { done = true; killActive(); reject(new Error('Timed out')); }
      }, timeout);
    }

    child.stdout.on('data', (d) =>
      d.toString().split('\n').forEach((l) => { if (l.trim()) log('stdout', l); })
    );
    child.stderr.on('data', (d) =>
      d.toString().split('\n').forEach((l) => { if (l.trim()) log('stderr', l); })
    );

    child.on('close', (code) => {
      if (done) return;
      done = true; if(timer) clearTimeout(timer); activeProcess = null;
      code === 0 ? resolve() : reject(new Error(`Exit code ${code}`));
    });

    child.on('error', (err) => {
      if (done) return;
      done = true; if(timer) clearTimeout(timer); activeProcess = null;
      reject(err);
    });
  });
}

// ═══════════════════════════════════════════════════
// LAYER 2 — OpenCode AI Agent (reasoning tasks)
//
// Uses spawn() with forced structured prompt output
// and manual UI logs to ensure reliability.
// ═══════════════════════════════════════════════════

async function runWithAgent(userRequest, opts = {}) {
  const timeout = opts.timeout || AGENT_TIMEOUT;

  if (!opencodePath) {
    log('stderr', '❌ OpenCode CLI not found — install from https://opencode.ai');
    throw new Error('OpenCode not installed');
  }

  // Strict structured prompt
  const prompt = `You are an AI developer agent.

User request: ${userRequest}

Follow STRICT format:

[STEP] what you are doing
[COMMAND] command
[ERROR] if any
[FIX] what you changed
[SUCCESS] result

At end:
[SUMMARY]
- bullet points`;

  const shortPrompt = userRequest.split('\n')[0].substring(0, 50);

  console.log(`🔥 Agent | ${MODEL} | ${shortPrompt}`);
  
  // Manual UI Logs for better user experience
  log('info', '─'.repeat(50));
  log('info', '🤖 AI started...');
  log('info', `📝 Request: ${shortPrompt}`);
  log('info', '⚙️ Executing in background...');

  const cmdArgs = ['run', prompt, '--model', MODEL, '--dir', currentProjectDir, '--dangerously-skip-permissions'];
  
  openTerminal(`opencode run "${shortPrompt}" --model ${MODEL} --dangerously-skip-permissions`);

  return new Promise((resolve, reject) => {
    const child = spawn(opencodePath, cmdArgs, {
      cwd: currentProjectDir,
      stdio: ['ignore', 'pipe', 'pipe'], // Critical: ignore stdin so OpenCode doesn't hang
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    activeProcess = child;
    let done = false;
    let outputBuffer = '';

    const timer = setTimeout(() => {
      if (!done) { done = true; killActive(); reject(new Error(`Agent timed out after ${timeout / 1000}s`)); }
    }, timeout);

    child.stdout.on('data', (d) => {
      const text = d.toString();
      outputBuffer += text;
      text.split('\n').forEach((l) => { 
        if (l.trim()) log('stdout', l); 
        if (l.includes('[ERROR]')) log('info', '⚠️ Processing error...');
        if (l.includes('[FIX]')) log('info', '🔁 Applying fix...');
      });
    });

    child.stderr.on('data', (d) => {
      d.toString().split('\n').forEach((l) => { if (l.trim()) log('stderr', l); });
    });

    child.on('close', (code) => {
      if (done) return;
      done = true; clearTimeout(timer); activeProcess = null;
      
      log('info', '✅ Done');
      log('info', '─'.repeat(50));

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Agent exited (code ${code})`));
      }
    });

    child.on('error', (err) => {
      if (done) return;
      done = true; clearTimeout(timer); activeProcess = null;
      log('stderr', `❌ Spawn error: ${err.message}`);
      reject(err);
    });
  });
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
      // Run in background without awaiting, so UI isn't blocked forever
      runShell('npm', ['run', 'dev'], { timeout: 0 }).catch(e => {
        log('stderr', `Dev server exited: ${e.message}`);
      });
      // Resolve immediately
      setTimeout(() => status('success', 'Dev server running in background'), 1000);
    } catch (e) { status('error', e.message); }
  },

  'stop-dev': async () => {
    status('running', 'Stopping dev server...');
    try {
      if (activeProcess) killActive();
      const ports = [3000, 5174, 5175, 5176, 5177, 5178, 8080];
      for (const p of ports) {
        try { await runShell(`lsof -ti :${p} | xargs kill -9 2>/dev/null || true`, [], { timeout: 5000 }); } catch {}
        log('stdout', `Port ${p} cleared`);
      }
      status('success', 'Dev server stopped');
    } catch (e) { status('error', e.message); }
  },

  'kill-port': async () => {
    status('running', 'Killing ports 3000, 5174-5178, 8080...');
    try {
      const ports = [3000, 5174, 5175, 5176, 5177, 5178, 8080];
      for (const p of ports) {
        try { await runShell(`lsof -ti :${p} | xargs kill -9 2>/dev/null || true`, [], { timeout: 5000 }); } catch {}
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
      await runShell('CI=true npm', ['test', '--', '--passWithNoTests'], { timeout: 30000 });
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
        'Print exactly this text: Hello from MiniMax AI',
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
        'Create a git commit with a smart message. Run git diff --cached --stat to see what changed, generate a concise conventional commit message, run git commit -m "...", and show the result.',
        { timeout: 30000 }
      );
      status('success', 'Changes committed');
    } catch (e) { status('error', e.message); }
  },

  'fix-build': async () => {
    status('running', 'AI fixing build...');
    try {
      await runWithAgent(
        'Fix the build. Run npm run build. If it fails, analyze the error output, read the failing source files, apply fixes to the code, and retry the build. Stop after success or 3 attempts.',
        { timeout: 45000 }
      );
      status('success', 'Build fix attempted');
    } catch (e) { status('error', e.message); }
  },

  // ─── Websites ───────────────────────────────────
  
  'open-youtube': async () => {
    status('running', 'Opening YouTube...');
    try {
      await runShell('open', ['-a', '"Google Chrome"', 'https://youtube.com']);
      status('success', 'YouTube opened');
    } catch (e) { status('error', e.message); }
  },

  'open-twitter': async () => {
    status('running', 'Opening Twitter...');
    try {
      await runShell('open', ['-a', '"Google Chrome"', 'https://twitter.com']);
      status('success', 'Twitter opened');
    } catch (e) { status('error', e.message); }
  },

  'open-chatgpt': async () => {
    status('running', 'Opening ChatGPT...');
    try {
      await runShell('open', ['-a', '"Google Chrome"', 'https://chat.openai.com']);
      status('success', 'ChatGPT opened');
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

// Smart Task Routing
app.post('/api/smart-task', (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'Missing input' });

  const text = input.toLowerCase();

  // Basic routing heuristic
  let routedTask = null;
  if (text.includes('run dev')) routedTask = 'run-dev';
  else if (text.includes('kill port')) routedTask = 'kill-port';
  else if (text.includes('git pull')) routedTask = 'git-pull';
  else if (text.includes('install dep')) routedTask = 'install-deps';

  res.json({ ok: true, message: `Smart Task triggered`, routed: routedTask || 'agent' });

  if (routedTask) {
    log('info', `⚡ Smart Task routed to fast shell: ${routedTask}`);
    tasks[routedTask]().catch(err => {
      log('stderr', `Unhandled: ${err.message}`);
      status('error', err.message);
    });
  } else {
    log('info', `🧠 Smart Task routed to AI Agent`);
    status('running', 'AI Agent thinking...');
    runWithAgent(input).then(() => {
      status('success', 'Smart Task completed');
    }).catch(err => {
      log('stderr', `AI Error: ${err.message}`);
      status('error', err.message);
    });
  }
});

// Set Project
app.post('/api/set-project', (req, res) => {
  const { path: newPath } = req.body;
  if (!newPath || !fs.existsSync(newPath)) {
    return res.status(400).json({ error: 'Invalid or missing path' });
  }
  currentProjectDir = newPath;
  log('info', `📁 Project changed to: ${currentProjectDir}`);
  res.json({ success: true, path: currentProjectDir });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), opencode: !!opencodePath, model: MODEL, dir: currentProjectDir });
});

// System Stats
app.get('/api/system-stats', (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpuLoad = os.loadavg()[0];

  res.json({
    cpu_load_1m: cpuLoad.toFixed(2),
    ram_used_gb: (usedMem / 1024 ** 3).toFixed(2),
    ram_total_gb: (totalMem / 1024 ** 3).toFixed(2)
  });
});

// ── LAN IP for QR mobile connection ──
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

app.get('/api/ip', (req, res) => {
  res.json({ ip: getLocalIP() });
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
  const ip = getLocalIP();
  console.log(`\n  ⚡ ClawDeck Backend — http://localhost:${PORT}`);
  console.log(`  📱 LAN: http://${ip}:${PORT}`);
  console.log(`  📁 ${currentProjectDir}`);
  console.log(`  🤖 ${MODEL} (${opencodePath ? 'ready' : 'NOT FOUND'})`);
  console.log(`  🔌 WebSocket ready\n`);
});

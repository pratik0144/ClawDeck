const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');

// ── Config ──
const PORT = 3001;
const PROJECT_DIR = process.env.PROJECT_DIR || path.resolve(__dirname, '..');
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || 'opencode/minimax-m2.5-free';
const AGENT_TIMEOUT_MS = 60000;  // 60s for AI tasks
const SHELL_TIMEOUT_MS = 30000;  // 30s for direct shell

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Track active child processes
let activeProcess = null;

// ── Detect OpenCode CLI at startup ──
let opencodePath = null;
try {
  opencodePath = execSync('which opencode 2>/dev/null').toString().trim();
  console.log(`  ✅ OpenCode found: ${opencodePath}`);
} catch {
  console.log('  ⚠️  OpenCode not found — shell-only mode');
}

// ── Helpers ──

function broadcastLog(type, text) {
  io.emit('task:log', { type, text });
}

function broadcastStatus(status, message) {
  io.emit('task:status', { status, message });
}

/**
 * Kill the active process tree safely.
 */
function killActive(reason) {
  if (activeProcess && !activeProcess.killed) {
    broadcastLog('info', `⏱️  ${reason} — killing process`);
    activeProcess.kill('SIGTERM');
    setTimeout(() => {
      if (activeProcess && !activeProcess.killed) {
        activeProcess.kill('SIGKILL');
      }
    }, 2000);
  }
}

/**
 * Run a direct shell command with timeout and live streaming.
 */
function runShell(command, args = [], options = {}) {
  const timeoutMs = options.timeout || SHELL_TIMEOUT_MS;
  const cwd = options.cwd || PROJECT_DIR;

  return new Promise((resolve, reject) => {
    broadcastLog('info', `⚙️  $ ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    activeProcess = child;
    let settled = false;

    // Timeout guard
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        killActive(`Shell timeout (${timeoutMs / 1000}s)`);
        reject(new Error(`Shell command timed out after ${timeoutMs / 1000}s`));
      }
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      data.toString().split('\n').forEach((line) => {
        if (line.trim()) broadcastLog('stdout', line);
      });
    });

    child.stderr.on('data', (data) => {
      data.toString().split('\n').forEach((line) => {
        if (line.trim()) broadcastLog('stderr', line);
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeProcess = null;
      if (code === 0) resolve(code);
      else reject(new Error(`Exited with code ${code}`));
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeProcess = null;
      reject(err);
    });
  });
}

/**
 * Run a task using OpenCode AI agent with timeout.
 *
 * Invocation:
 *   opencode run "<prompt>" --model <model> --dir <dir> --dangerously-skip-permissions
 *
 * Falls back to shell command if OpenCode is not installed.
 */
function runWithAgent(prompt, fallbackCmd = null, fallbackArgs = [], options = {}) {
  const timeoutMs = options.timeout || AGENT_TIMEOUT_MS;

  // ── Fallback if OpenCode not installed ──
  if (!opencodePath) {
    broadcastLog('info', '⚠️  OpenCode not available — using shell fallback');
    if (fallbackCmd) return runShell(fallbackCmd, fallbackArgs, options);
    return Promise.reject(new Error('OpenCode not installed, no fallback'));
  }

  return new Promise((resolve, reject) => {
    console.log(`🔥 Using OpenCode with prompt: ${prompt}`);
    broadcastLog('info', '🔥 OpenCode agent started');
    broadcastLog('info', `🤖 Model: ${OPENCODE_MODEL}`);
    broadcastLog('info', `📝 Prompt: ${prompt}`);
    broadcastLog('info', '─'.repeat(50));

    const args = [
      'run',
      prompt,
      '--model', OPENCODE_MODEL,
      '--dir', PROJECT_DIR,
      '--dangerously-skip-permissions',
    ];

    const child = spawn(opencodePath, args, {
      cwd: PROJECT_DIR,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TERM: 'dumb' },
    });

    activeProcess = child;
    let settled = false;

    // ── Timeout guard — prevents hanging forever ──
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        broadcastLog('info', `⏱️  Agent timeout (${timeoutMs / 1000}s) — killing`);
        killActive('Agent timeout');

        // Try fallback
        if (fallbackCmd) {
          broadcastLog('info', '🔄 Running shell fallback...');
          runShell(fallbackCmd, fallbackArgs, options).then(resolve).catch(reject);
        } else {
          reject(new Error(`Agent timed out after ${timeoutMs / 1000}s`));
        }
      }
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      data.toString().split('\n').forEach((line) => {
        const clean = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
        if (clean) broadcastLog('stdout', clean);
      });
    });

    child.stderr.on('data', (data) => {
      data.toString().split('\n').forEach((line) => {
        const clean = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
        if (clean) broadcastLog('stderr', clean);
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeProcess = null;
      broadcastLog('info', '─'.repeat(50));

      if (code === 0) {
        broadcastLog('info', '✅ Agent completed successfully');
        resolve(code);
      } else {
        broadcastLog('info', `❌ Agent exited with code ${code}`);
        if (fallbackCmd) {
          broadcastLog('info', '🔄 Running shell fallback...');
          runShell(fallbackCmd, fallbackArgs, options).then(resolve).catch(reject);
        } else {
          reject(new Error(`Agent exited with code ${code}`));
        }
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeProcess = null;
      broadcastLog('stderr', `Spawn error: ${err.message}`);

      if (fallbackCmd) {
        broadcastLog('info', '🔄 Running shell fallback...');
        runShell(fallbackCmd, fallbackArgs, options).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

// ═══════════════════════════════════════════════════
// ── Task Definitions
// ═══════════════════════════════════════════════════
//
// Strategy:
//   DIRECT SHELL → fast, deterministic tasks (run-dev, kill-port, git-pull, etc.)
//   OPENCODE AI  → tasks that benefit from reasoning (git-commit, fix-build)
//
// Every task has a timeout. Nothing hangs.
// ═══════════════════════════════════════════════════

const taskHandlers = {

  // ─── DIRECT SHELL TASKS ─────────────────────────

  'run-dev': async () => {
    broadcastStatus('running', 'Starting dev server...');
    try {
      await runShell('npm', ['run', 'dev'], { timeout: 10000 });
      broadcastStatus('success', 'Dev server started');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  'stop-dev': async () => {
    broadcastStatus('running', 'Stopping dev server...');
    try {
      if (activeProcess) {
        killActive('User requested stop');
      }
      for (const port of [3000, 5173, 8080]) {
        try {
          await runShell('sh', ['-c', `lsof -ti :${port} | xargs kill -9 2>/dev/null || true`], { timeout: 5000 });
          broadcastLog('stdout', `Port ${port} cleared`);
        } catch {
          broadcastLog('info', `Port ${port} was free`);
        }
      }
      broadcastStatus('success', 'Dev server stopped');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  'kill-port': async () => {
    broadcastStatus('running', 'Killing ports 3000, 5173, 8080...');
    try {
      for (const port of [3000, 5173, 8080]) {
        try {
          await runShell('sh', ['-c', `lsof -ti :${port} | xargs kill -9 2>/dev/null || true`], { timeout: 5000 });
          broadcastLog('stdout', `Port ${port} cleared`);
        } catch {
          broadcastLog('info', `Port ${port} was free`);
        }
      }
      broadcastStatus('success', 'Ports cleared');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  'git-pull': async () => {
    broadcastStatus('running', 'Pulling latest changes...');
    try {
      await runShell('git', ['pull'], { timeout: 15000 });
      broadcastStatus('success', 'Git pull complete');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  'git-push': async () => {
    broadcastStatus('running', 'Pushing to remote...');
    try {
      await runShell('git', ['push'], { timeout: 15000 });
      broadcastStatus('success', 'Push complete');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  'install-deps': async () => {
    broadcastStatus('running', 'Installing dependencies...');
    try {
      await runShell('npm', ['install'], { timeout: 60000 });
      broadcastStatus('success', 'Dependencies installed');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  'run-tests': async () => {
    broadcastStatus('running', 'Running tests...');
    try {
      await runShell('npm', ['test', '--', '--passWithNoTests'], { timeout: 30000 });
      broadcastStatus('success', 'Tests complete');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  // ─── OPENCODE AI TASKS ──────────────────────────

  'open-logs': async () => {
    broadcastStatus('running', 'Fetching logs via OpenCode...');
    try {
      await runWithAgent(
        'Run: git log --oneline -20',
        'git', ['log', '--oneline', '-20'],
        { timeout: 20000 }
      );
      broadcastStatus('success', 'Logs retrieved');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  'git-commit': async () => {
    broadcastStatus('running', 'AI committing changes...');
    try {
      // Stage first via direct shell (fast, deterministic)
      await runShell('git', ['add', '-A'], { timeout: 5000 });
      // Then let AI analyze and commit with a good message
      await runWithAgent(
        'Run: git diff --cached --stat. Then create a concise conventional commit message and run git commit -m with it.',
        'git', ['commit', '-m', 'chore: auto commit via ClawDeck'],
        { timeout: 30000 }
      );
      broadcastStatus('success', 'Changes committed');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },

  'fix-build': async () => {
    broadcastStatus('running', 'AI fixing build...');
    try {
      await runWithAgent(
        'Run: npm run build. If it fails, read the error, fix the source files, and retry the build.',
        'npm', ['run', 'build'],
        { timeout: 60000 }
      );
      broadcastStatus('success', 'Build fix attempted');
    } catch (err) {
      broadcastStatus('error', `Failed: ${err.message}`);
    }
  },
};

// ── API Routes ──

app.post('/api/run-task', async (req, res) => {
  const { task } = req.body;

  if (!task) {
    return res.status(400).json({ error: 'Missing "task" in request body' });
  }

  const handler = taskHandlers[task];
  if (!handler) {
    return res.status(400).json({ error: `Unknown task: ${task}` });
  }

  // Fire-and-forget — results stream via WebSocket
  handler().catch((err) => {
    broadcastLog('stderr', `Unhandled error: ${err.message}`);
    broadcastStatus('error', err.message);
  });

  res.json({ ok: true, task, message: `Task "${task}" started` });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    opencode: opencodePath ? 'available' : 'not found',
    model: OPENCODE_MODEL,
    projectDir: PROJECT_DIR,
  });
});

// ── WebSocket ──
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit('task:log', { type: 'info', text: '● Welcome to ClawDeck' });
  socket.emit('task:log', {
    type: 'info',
    text: `🤖 Agent: OpenCode (${opencodePath ? 'ready' : 'not found — shell-only'})`,
  });
  socket.emit('task:log', {
    type: 'info',
    text: `📦 Model: ${OPENCODE_MODEL}`,
  });
  socket.emit('task:status', { status: 'idle', message: 'Ready' });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ── Start Server ──
server.listen(PORT, () => {
  console.log(`\n  ⚡ ClawDeck Backend running on http://localhost:${PORT}`);
  console.log(`  📁 Project directory: ${PROJECT_DIR}`);
  console.log(`  🤖 Model: ${OPENCODE_MODEL}`);
  console.log(`  🔌 WebSocket ready\n`);
});

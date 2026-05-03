const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

// ═══════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════
const PORT = 3001;
const PROJECTS_BASE_DIR = '/Users/pratikpotadar/Developer/projects';
let currentProjectDir = process.env.PROJECT_DIR || path.resolve(__dirname, '..');
const MODEL = 'opencode/minimax-m2.5-free';
const AGENT_TIMEOUT = 45000;
const OPEN_MAC_TERMINAL = process.env.OPEN_TERMINAL === 'true';

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend build for mobile LAN access
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

let activeProcess = null;

// ═══════════════════════════════════════════════════
// Session Management (QR Pairing)
// ═══════════════════════════════════════════════════
const sessions = new Map();

function createSession() {
  const token = uuidv4();
  const session = {
    token,
    createdAt: Date.now(),
    paired: false,
    laptopSocketId: null,
    mobileSocketId: null
  };
  sessions.set(token, session);
  return session;
}

function getSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  return session;
}

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

// ═══════════════════════════════════════════════════
// GitHub Repo Download
// ═══════════════════════════════════════════════════

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      // Handle GitHub redirects (302)
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function downloadAndExtractRepo(repoUrl, targetBaseDir) {
  // Parse GitHub URL
  const match = repoUrl.replace(/\.git$/, '').replace(/\/$/, '').match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');

  const [, username, repoName] = match;
  const baseDir = targetBaseDir || PROJECTS_BASE_DIR;

  // Ensure base dir exists
  fs.mkdirSync(baseDir, { recursive: true });

  const zipPath = path.join(baseDir, `${repoName}.zip`);
  const finalDir = path.join(baseDir, repoName);

  // Skip if already exists
  if (fs.existsSync(finalDir)) {
    log('info', `📁 ${repoName} already exists, skipping download`);
    return finalDir;
  }

  // Try main branch first, fallback to master
  let downloaded = false;
  for (const branch of ['main', 'master']) {
    const zipUrl = `https://github.com/${username}/${repoName}/archive/refs/heads/${branch}.zip`;
    log('info', `⬇️ Trying ${branch} branch...`);
    try {
      await downloadFile(zipUrl, zipPath);
      downloaded = true;
      log('info', `✅ Downloaded ${repoName} (${branch})`);
      break;
    } catch (e) {
      log('info', `⚠️ ${branch} branch not found, trying next...`);
    }
  }

  if (!downloaded) throw new Error(`Could not download ${repoName} from any branch`);

  // Extract ZIP
  log('info', `📦 Extracting ${repoName}...`);
  await new Promise((resolve, reject) => {
    const child = spawn('unzip', ['-o', zipPath, '-d', baseDir], { cwd: baseDir });
    child.stderr.on('data', d => log('stderr', d.toString().trim()));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`unzip exit ${code}`)));
    child.on('error', reject);
  });

  // Rename extracted folder (GitHub creates repo-branch/)
  for (const branch of ['main', 'master']) {
    const extracted = path.join(baseDir, `${repoName}-${branch}`);
    if (fs.existsSync(extracted)) {
      fs.renameSync(extracted, finalDir);
      log('info', `📁 Renamed to ${repoName}/`);
      break;
    }
  }

  // Cleanup ZIP
  try { fs.unlinkSync(zipPath); } catch {}

  return finalDir;
}

app.post('/api/download-repo', async (req, res) => {
  const { repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Missing repoUrl' });

  res.json({ ok: true, message: 'Download started' });

  try {
    status('running', 'Downloading repo...');
    log('info', '─'.repeat(50));
    log('info', `🔗 Repo: ${repoUrl}`);

    const finalDir = await downloadAndExtractRepo(repoUrl);

    // Auto-set as current project
    currentProjectDir = finalDir;
    log('info', `📁 Project set to: ${currentProjectDir}`);
    log('info', '─'.repeat(50));
    status('success', `Repo ready: ${path.basename(finalDir)}`);

    // Notify frontend to update project path
    io.emit('project:changed', { path: currentProjectDir });

  } catch (err) {
    log('stderr', `❌ Download failed: ${err.message}`);
    status('error', err.message);
  }
});

app.post('/api/download-user-repos', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  res.json({ ok: true, message: `Fetching repos for ${username}` });

  try {
    status('running', `Fetching repos for ${username}...`);
    log('info', '─'.repeat(50));
    log('info', `👤 GitHub user: ${username}`);

    // Fetch repo list from GitHub API
    const repos = await new Promise((resolve, reject) => {
      https.get(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, {
        headers: { 'User-Agent': 'ClawDeck' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`GitHub API: ${res.statusCode}`));
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    const topRepos = repos.slice(0, 5);
    log('info', `📋 Found ${repos.length} repos, downloading top ${topRepos.length}`);

    const userDir = path.join(PROJECTS_BASE_DIR, username);
    fs.mkdirSync(userDir, { recursive: true });

    for (let i = 0; i < topRepos.length; i++) {
      const repo = topRepos[i];
      log('info', `⬇️ Downloading repo ${i + 1}/${topRepos.length}: ${repo.name}`);
      try {
        await downloadAndExtractRepo(repo.html_url, userDir);
      } catch (e) {
        log('stderr', `⚠️ Failed ${repo.name}: ${e.message}`);
      }
    }

    // Set project to user directory
    currentProjectDir = userDir;
    log('info', `📁 Project set to: ${currentProjectDir}`);
    log('info', '─'.repeat(50));
    status('success', `${topRepos.length} repos downloaded for ${username}`);
    io.emit('project:changed', { path: currentProjectDir });

  } catch (err) {
    log('stderr', `❌ Failed: ${err.message}`);
    status('error', err.message);
  }
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
// Session API (QR Pairing)
// ═══════════════════════════════════════════════════

app.get('/api/session/create', (req, res) => {
  const session = createSession();
  const ip = getLocalIP();
  const qrUrl = `http://${ip}:${PORT}/?session=${session.token}`;
  console.log(`[Session] Created new session: ${session.token.substring(0, 8)}...`);
  res.json({
    token: session.token,
    qrUrl,
  });
});

app.get('/api/session/status/:token', (req, res) => {
  const token = req.params.token;
  const session = getSession(token);
  if (!session) {
    console.log(`[Session] Status check failed - invalid token: ${token ? token.substring(0, 8) + '...' : 'none'}`);
    return res.json({ valid: false, paired: false });
  }
  res.json({
    valid: true,
    paired: session.paired,
  });
});

app.post('/api/session/pair', (req, res) => {
  const { token } = req.body;
  const session = getSession(token);
  if (!session) {
    console.log(`[Session] Pair attempt failed - invalid token: ${token ? token.substring(0, 8) + '...' : 'none'}`);
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  console.log(`[Session] Pair successful: ${token.substring(0, 8)}...`);
  session.paired = true;

  // Notify laptop socket that mobile has paired
  if (session.laptopSocketId) {
    io.to(session.laptopSocketId).emit('session:paired', { token });
  }

  res.json({ ok: true, paired: true });
});

// ═══════════════════════════════════════════════════
// WebSocket
// ═══════════════════════════════════════════════════

io.on('connection', (socket) => {
  const role = socket.handshake.query.role; // 'laptop' or 'mobile'
  const sessionToken = socket.handshake.query.session;

  console.log(`+ ${socket.id} (role: ${role || 'unknown'}, session: ${sessionToken ? sessionToken.substring(0, 8) + '...' : 'none'})`);

  // Register socket with session
  if (sessionToken) {
    const session = getSession(sessionToken);
    if (session) {
      if (role === 'laptop') {
        session.laptopSocketId = socket.id;
      } else if (role === 'mobile') {
        session.mobileSocketId = socket.id;
        // Auto-pair on mobile connect
        if (!session.paired) {
          session.paired = true;
          if (session.laptopSocketId) {
            io.to(session.laptopSocketId).emit('session:paired', { token: sessionToken });
          }
        }
      }
    }
  }

  socket.emit('task:log', { type: 'info', text: '● Welcome to ClawDeck' });
  socket.emit('task:log', { type: 'info', text: `🤖 OpenCode: ${opencodePath ? 'ready' : 'not found'}` });
  socket.emit('task:log', { type: 'info', text: `📦 AI Model: ${MODEL}` });
  socket.emit('task:status', { status: 'idle', message: 'Ready' });

  socket.on('disconnect', () => {
    console.log(`- ${socket.id}`);
    // If a mobile disconnects, notify laptop
    if (sessionToken) {
      const session = sessions.get(sessionToken);
      if (session && role === 'mobile' && session.laptopSocketId) {
        session.paired = false;
        session.mobileSocketId = null;
        io.to(session.laptopSocketId).emit('session:disconnected', { token: sessionToken });
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// SPA Fallback (must be AFTER all API routes)
// ═══════════════════════════════════════════════════
if (fs.existsSync(FRONTEND_DIST)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// ═══════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n  ⚡ ClawDeck Backend — http://localhost:${PORT}`);
  console.log(`  📱 LAN: http://${ip}:${PORT}`);
  console.log(`  📁 ${currentProjectDir}`);
  console.log(`  🤖 ${MODEL} (${opencodePath ? 'ready' : 'NOT FOUND'})`);
  console.log(`  🔌 WebSocket ready\n`);
});

import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'

/* ── Task Definitions ── */
const TASKS = [
  { id: 'test-ai',     label: 'Test AI',              icon: '🧠', color: '#f368e0' },
  { id: 'run-dev',     label: 'Run Dev Server',       icon: '▶',  color: '#00d68f' },
  { id: 'stop-dev',    label: 'Stop Dev Server',      icon: '⏹',  color: '#ff4757' },
  { id: 'kill-port',   label: 'Kill Port',            icon: '🔌', color: '#ffa502' },
  { id: 'git-pull',    label: 'Git Pull',             icon: '⬇',  color: '#1e90ff' },
  { id: 'git-commit',  label: 'Git Commit',           icon: '📝', color: '#6c5ce7' },
  { id: 'git-push',    label: 'Git Push',             icon: '⬆',  color: '#00b894' },
  { id: 'install-deps',label: 'Install Dependencies', icon: '📦', color: '#e17055' },
  { id: 'run-tests',   label: 'Run Tests',            icon: '🧪', color: '#fdcb6e' },
  { id: 'open-logs',   label: 'Open Logs',            icon: '📋', color: '#74b9ff' },
  { id: 'fix-build',   label: 'Fix Build',            icon: '🔧', color: '#a29bfe' },
  { id: 'open-youtube',label: 'YouTube',              icon: '▶️', color: '#ff0000' },
  { id: 'open-twitter',label: 'Twitter',              icon: '🐦', color: '#1da1f2' },
  { id: 'open-chatgpt',label: 'ChatGPT',              icon: '🤖', color: '#10a37f' },
]

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const config = {
    idle:    { dot: 'bg-gray-500',   text: 'Idle',    glow: '' },
    running: { dot: 'bg-yellow-400', text: 'Running', glow: 'animate-pulse-glow' },
    success: { dot: 'bg-green-400',  text: 'Success', glow: '' },
    error:   { dot: 'bg-red-500',    text: 'Error',   glow: '' },
  }
  const c = config[status] || config.idle

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full glass ${c.glow}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
      <span className="text-sm font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        {c.text}
      </span>
    </div>
  )
}

/* ── QR Code Popup ── */
function QrConnect() {
  const [lanUrl, setLanUrl] = useState(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/ip')
      .then(r => r.json())
      .then(d => setLanUrl(`http://${d.ip}:5173`))
      .catch(() => setError(true))
  }, [])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium
                   transition-all duration-200 cursor-pointer
                   hover:border-purple-500/50"
        style={{
          background: 'var(--bg-card)',
          borderColor: open ? 'var(--accent)' : 'var(--border-color)',
          color: 'var(--text-secondary)',
          boxShadow: open ? '0 0 12px var(--accent-glow)' : 'none',
        }}
        title="Scan QR to connect from mobile"
      >
        <span className="text-base">📱</span>
        <span className="hidden sm:inline">Mobile</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-3 z-[100] rounded-2xl border p-5
                     flex flex-col items-center gap-3 shadow-2xl"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            minWidth: '220px',
          }}
        >
          <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Scan to connect from mobile
          </p>

          {error ? (
            <p className="text-xs" style={{ color: 'var(--error)' }}>Could not detect LAN IP</p>
          ) : !lanUrl ? (
            <div className="w-[160px] h-[160px] rounded-xl flex items-center justify-center"
                 style={{ background: 'var(--bg-card)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</span>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-xl" style={{ background: '#ffffff' }}>
                <QRCodeSVG
                  value={lanUrl}
                  size={140}
                  bgColor="#ffffff"
                  fgColor="#1a1a2e"
                  level="M"
                />
              </div>
              <code
                className="text-xs px-3 py-1.5 rounded-lg select-all"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--terminal-green)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {lanUrl}
              </code>
            </>
          )}

          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Same WiFi network required
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Task Card Button ── */
function TaskCard({ task, onClick, disabled }) {
  return (
    <button
      id={`task-${task.id}`}
      onClick={() => onClick(task.id)}
      disabled={disabled}
      className="group relative flex flex-col items-center justify-center gap-3 p-5 rounded-2xl
                 border transition-all duration-300 cursor-pointer select-none
                 hover:scale-[1.04] active:scale-[0.97]
                 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-color)',
        '--hover-glow': task.color,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = task.color
        e.currentTarget.style.boxShadow = `0 0 20px ${task.color}33, 0 4px 20px rgba(0,0,0,0.3)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-color)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <span className="text-3xl transition-transform duration-300 group-hover:scale-110">
        {task.icon}
      </span>
      <span className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
        {task.label}
      </span>
      {/* Subtle accent bar */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-0 rounded-full
                    transition-all duration-300 group-hover:w-3/4"
        style={{ background: task.color }}
      />
    </button>
  )
}

/* ── Log Panel ── */
function LogPanel({ logs, onClear, onStats }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          <span className="mr-2">⌘</span>Live Terminal
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onStats}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors duration-200 cursor-pointer
                       hover:border-blue-500/50 hover:text-blue-400"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            System Stats
          </button>
          <button
            onClick={onClear}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors duration-200 cursor-pointer
                       hover:border-red-500/50 hover:text-red-400"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="log-container" style={{ minHeight: '200px' }}>
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-32" style={{ color: 'var(--text-muted)' }}>
            <span className="text-sm">Waiting for task execution...</span>
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className={`log-line ${
                log.type === 'stderr' ? 'log-line-stderr' :
                log.type === 'info'   ? 'log-line-info'   :
                'log-line-stdout'
              }`}
            >
              {log.text}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}

/* ── Main App ── */
function App() {
  const [status, setStatus] = useState('idle')
  const [logs, setLogs] = useState([])
  const [activeTask, setActiveTask] = useState(null)
  
  const [projectPath, setProjectPath] = useState('')
  const [activeProject, setActiveProject] = useState('')
  const [smartInput, setSmartInput] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [githubUser, setGithubUser] = useState('')

  const socketRef = useRef(null)

  // Fetch initial project dir
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => {
      setProjectPath(d.dir)
      setActiveProject(d.dir)
    }).catch(console.error)
  }, [])

  // Connect to WebSocket
  useEffect(() => {
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      addLog('info', '● Connected to ClawDeck server')
    })

    socket.on('task:log', (data) => {
      addLog(data.type || 'stdout', data.text)
    })

    socket.on('task:status', (data) => {
      setStatus(data.status)
      if (data.status !== 'running') {
        setActiveTask(null)
      }
      if (data.message) {
        addLog('info', `● ${data.message}`)
      }
    })

    socket.on('disconnect', () => {
      addLog('info', '● Disconnected from server')
    })

    // Listen for project changes (from Chrome extension downloads)
    socket.on('project:changed', (data) => {
      if (data.path) {
        setProjectPath(data.path)
        setActiveProject(data.path)
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const addLog = useCallback((type, text) => {
    setLogs(prev => [...prev, { type, text, ts: Date.now() }])
  }, [])

  const runTask = useCallback(async (taskId) => {
    setStatus('running')
    setActiveTask(taskId)
    addLog('info', `● Starting task: ${taskId}`)

    try {
      const res = await fetch('/api/run-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskId }),
      })

      if (!res.ok) {
        const err = await res.json()
        addLog('stderr', `Error: ${err.error || 'Unknown error'}`)
        setStatus('error')
        setActiveTask(null)
      }
    } catch (err) {
      addLog('stderr', `Network error: ${err.message}`)
      setStatus('error')
      setActiveTask(null)
    }
  }, [addLog])

  const runSmartTask = useCallback(async () => {
    if (!smartInput.trim()) return;
    setStatus('running')
    setActiveTask('smart-task')
    addLog('info', `● Smart Task: "${smartInput}"`)

    try {
      const res = await fetch('/api/smart-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: smartInput }),
      })

      if (!res.ok) {
        const err = await res.json()
        addLog('stderr', `Error: ${err.error || 'Unknown error'}`)
        setStatus('error')
        setActiveTask(null)
      } else {
        setSmartInput('')
      }
    } catch (err) {
      addLog('stderr', `Network error: ${err.message}`)
      setStatus('error')
      setActiveTask(null)
    }
  }, [smartInput, addLog])

  const handleSetProject = async () => {
    try {
      const res = await fetch('/api/set-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath })
      })
      const data = await res.json()
      if (res.ok) {
        setActiveProject(data.path)
        addLog('success', `✅ Project changed to: ${data.path}`)
      } else {
        addLog('stderr', `❌ Failed to set project: ${data.error}`)
      }
    } catch (err) {
      addLog('stderr', `❌ Network error: ${err.message}`)
    }
  }

  const getSystemStats = async () => {
    try {
      addLog('info', '● Fetching System Stats...')
      const res = await fetch('/api/system-stats')
      const data = await res.json()
      if (res.ok) {
        addLog('stdout', `🖥️ CPU Load (1m): ${data.cpu_load_1m}`)
        addLog('stdout', `🧠 RAM Used: ${data.ram_used_gb} GB / ${data.ram_total_gb} GB`)
      }
    } catch (err) {
      addLog('stderr', `❌ Network error: ${err.message}`)
    }
  }

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const downloadRepo = async () => {
    if (!repoUrl.trim()) return
    setStatus('running')
    setActiveTask('download-repo')
    addLog('info', `● Downloading repo: ${repoUrl}`)
    try {
      const res = await fetch('/api/download-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      })
      if (!res.ok) {
        const err = await res.json()
        addLog('stderr', `Error: ${err.error}`)
        setStatus('error')
        setActiveTask(null)
      } else {
        setRepoUrl('')
      }
    } catch (err) {
      addLog('stderr', `Network error: ${err.message}`)
      setStatus('error')
      setActiveTask(null)
    }
  }

  const downloadUserRepos = async () => {
    if (!githubUser.trim()) return
    setStatus('running')
    setActiveTask('download-user-repos')
    addLog('info', `● Downloading repos for: ${githubUser}`)
    try {
      const res = await fetch('/api/download-user-repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: githubUser }),
      })
      if (!res.ok) {
        const err = await res.json()
        addLog('stderr', `Error: ${err.error}`)
        setStatus('error')
        setActiveTask(null)
      } else {
        setGithubUser('')
      }
    } catch (err) {
      addLog('stderr', `Network error: ${err.message}`)
      setStatus('error')
      setActiveTask(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Header ── */}
      <header className="glass sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black"
              style={{ background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)', color: '#fff' }}
            >
              C
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                ClawDeck
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Developer Dashboard
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-opacity-20 bg-black p-2 rounded-xl">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Project:</span>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              className="text-xs bg-transparent outline-none w-64 border-b pb-1 transition-colors focus:border-purple-500"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
              placeholder="/Users/..."
            />
            <button
              onClick={handleSetProject}
              className="text-xs px-3 py-1 rounded-lg border transition-colors hover:border-purple-500 hover:text-purple-400"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              Set
            </button>
          </div>

          <div className="flex items-center gap-3">
            <QrConnect />
            <StatusBadge status={status} />
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {/* Running indicator */}
        {activeTask && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{
              background: 'rgba(108, 92, 231, 0.08)',
              borderColor: 'rgba(108, 92, 231, 0.3)',
            }}
          >
            <svg className="animate-spin-slow w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#6c5ce7" strokeWidth="3" strokeDasharray="40 60" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
              Running: {TASKS.find(t => t.id === activeTask)?.label || activeTask}
            </span>
          </div>
        )}

        {/* Smart Task Input */}
        <section className="glass rounded-2xl p-4 flex gap-3 shadow-lg" style={{ borderColor: 'var(--border-color)' }}>
          <input
            type="text"
            value={smartInput}
            onChange={(e) => setSmartInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSmartTask()}
            placeholder="Ask anything... (e.g., run dev server, fix build, install deps)"
            className="flex-1 bg-transparent text-sm outline-none px-2"
            style={{ color: 'var(--text-primary)' }}
            disabled={status === 'running'}
          />
          <button
            onClick={runSmartTask}
            disabled={status === 'running' || !smartInput.trim()}
            className="px-6 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Run Smart Task 🧠
          </button>
        </section>

        {/* Task Grid */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
            Tasks
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {TASKS.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={runTask}
                disabled={status === 'running'}
              />
            ))}
          </div>
        </section>

        {/* GitHub Download Section */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
            GitHub
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Single Repo */}
            <div className="glass rounded-2xl p-4 flex gap-3 shadow-lg" style={{ borderColor: 'var(--border-color)' }}>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && downloadRepo()}
                placeholder="https://github.com/user/repo"
                className="flex-1 bg-transparent text-sm outline-none px-2"
                style={{ color: 'var(--text-primary)' }}
                disabled={status === 'running'}
              />
              <button
                onClick={downloadRepo}
                disabled={status === 'running' || !repoUrl.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:scale-105 active:scale-95"
                style={{ background: '#00b894', color: '#fff' }}
              >
                Download Repo ⬇️
              </button>
            </div>
            {/* User Repos */}
            <div className="glass rounded-2xl p-4 flex gap-3 shadow-lg" style={{ borderColor: 'var(--border-color)' }}>
              <input
                type="text"
                value={githubUser}
                onChange={(e) => setGithubUser(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && downloadUserRepos()}
                placeholder="GitHub username"
                className="flex-1 bg-transparent text-sm outline-none px-2"
                style={{ color: 'var(--text-primary)' }}
                disabled={status === 'running'}
              />
              <button
                onClick={downloadUserRepos}
                disabled={status === 'running' || !githubUser.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:scale-105 active:scale-95"
                style={{ background: '#6c5ce7', color: '#fff' }}
              >
                Download All Repos 👤
              </button>
            </div>
          </div>
        </section>

        {/* Log Panel */}
        <section className="flex-1">
          <LogPanel logs={logs} onClear={clearLogs} onStats={getSystemStats} />
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t py-4" style={{ borderColor: 'var(--border-color)' }}>
        <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          ClawDeck v0.1 · Local Chrome Dashboard
        </p>
      </footer>
    </div>
  )
}

export default App

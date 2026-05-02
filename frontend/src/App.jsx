import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
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
function LogPanel({ logs, onClear }) {
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
        <button
          onClick={onClear}
          className="text-xs px-3 py-1.5 rounded-lg border transition-colors duration-200 cursor-pointer
                     hover:border-red-500/50 hover:text-red-400"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          Clear
        </button>
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
  const socketRef = useRef(null)

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

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

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
          <StatusBadge status={status} />
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

        {/* Log Panel */}
        <section className="flex-1">
          <LogPanel logs={logs} onClear={clearLogs} />
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

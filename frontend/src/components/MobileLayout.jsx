import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Play, Square, Unplug,
  ArrowDownToLine, GitCommitHorizontal, ArrowUpFromLine,
  Package, FlaskConical, FileText, Wrench,
  Brain, Video, AtSign, MessageSquare,
  ChevronDown, ChevronUp, Trash2,
  Folder, Edit2, Sparkles, LayoutDashboard, TerminalSquare, X, Send, Smartphone, DownloadCloud
} from 'lucide-react'
import StatusBadge from './StatusBadge'

/* ── Mobile Task Definitions ── */
const ALL_TASKS = [
  { id: 'run-dev',     label: 'Run Dev',       IconComponent: Play,                 color: '#3B9B5E' },
  { id: 'stop-dev',    label: 'Stop Dev',      IconComponent: Square,               color: '#E5534B' },
  { id: 'kill-port',   label: 'Kill Port',     IconComponent: Unplug,               color: '#D4A72C' },
  { id: 'git-pull',    label: 'Git Pull',      IconComponent: ArrowDownToLine,      color: '#6B9FD4' },
  { id: 'git-commit',  label: 'Git Commit',    IconComponent: GitCommitHorizontal,  color: '#9B8CD4' },
  { id: 'git-push',    label: 'Git Push',      IconComponent: ArrowUpFromLine,      color: '#3B9B5E' },
  { id: 'install-deps',label: 'Install Deps',  IconComponent: Package,       color: '#C47A5A' },
  { id: 'run-tests',   label: 'Run Tests',     IconComponent: FlaskConical,  color: '#D4A72C' },
  { id: 'fix-build',   label: 'Fix Build',     IconComponent: Wrench,        color: '#9B8CD4' },
  { id: 'test-ai',     label: 'Test AI',       IconComponent: Brain,         color: '#CBA135' },
  { id: 'open-logs',   label: 'Open Logs',     IconComponent: FileText,      color: '#7A9AAF' },
  { id: 'open-youtube',label: 'YouTube',        IconComponent: Video,         color: '#E5534B' },
  { id: 'open-twitter',label: 'Twitter',        IconComponent: AtSign,        color: '#6B9FD4' },
  { id: 'open-chatgpt',label: 'ChatGPT',        IconComponent: MessageSquare, color: '#3B9B5E' },
]

export default function MobileLayout({ socketRef, sessionStatus }) {
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'terminal'
  const [status, setStatus] = useState('idle')
  const [logs, setLogs] = useState([])
  const [activeTask, setActiveTask] = useState(null)
  const logEndRef = useRef(null)

  // Modals & Project State
  const [projectPath, setProjectPath] = useState('Loading...')
  const [smartTaskModalOpen, setSmartTaskModalOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [downloadRepoModalOpen, setDownloadRepoModalOpen] = useState(false)
  const [smartTaskInput, setSmartTaskInput] = useState('')
  const [newProjectPathInput, setNewProjectPathInput] = useState('')
  const [repoUrlInput, setRepoUrlInput] = useState('')

  // Fetch initial project path
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => {
        if (d.dir) setProjectPath(d.dir)
      })
      .catch(console.error)
  }, [])

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const onLog = (data) => {
      setLogs(prev => [...prev.slice(-100), { type: data.type || 'stdout', text: data.text, ts: Date.now() }])
    }
    const onStatus = (data) => {
      setStatus(data.status)
      if (data.status !== 'running') setActiveTask(null)
    }
    const onProjectChanged = (data) => {
      if (data.path) setProjectPath(data.path)
    }

    socket.on('task:log', onLog)
    socket.on('task:status', onStatus)
    socket.on('project:changed', onProjectChanged)

    return () => {
      socket.off('task:log', onLog)
      socket.off('task:status', onStatus)
      socket.off('project:changed', onProjectChanged)
    }
  }, [socketRef, sessionStatus])

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === 'terminal') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, activeTab])

  const runTask = useCallback(async (taskId) => {
    setStatus('running')
    setActiveTask(taskId)
    try {
      const res = await fetch('/api/run-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskId }),
      })
      if (!res.ok) {
        setStatus('error')
        setActiveTask(null)
      }
    } catch {
      setStatus('error')
      setActiveTask(null)
    }
  }, [])

  const handleSmartTaskSubmit = async () => {
    if (!smartTaskInput.trim()) return
    const task = smartTaskInput.trim()
    setSmartTaskInput('')
    setSmartTaskModalOpen(false)
    setActiveTab('terminal')
    setStatus('running')
    setActiveTask('Ask AI')
    try {
      const res = await fetch('/api/smart-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: task }),
      })
      if (!res.ok) {
        setStatus('error')
        setActiveTask(null)
      }
    } catch (err) {
      console.error(err)
      setStatus('error')
      setActiveTask(null)
    }
  }

  const handleProjectSubmit = async () => {
    if (!newProjectPathInput.trim()) return
    const path = newProjectPathInput.trim()
    setProjectModalOpen(false)
    try {
      const res = await fetch('/api/set-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      const data = await res.json()
      if (data.success) {
        setProjectPath(data.path)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDownloadRepoSubmit = async () => {
    if (!repoUrlInput.trim()) return
    const url = repoUrlInput.trim()
    setDownloadRepoModalOpen(false)
    setActiveTab('terminal')
    setStatus('running')
    setActiveTask('Download Repo')
    try {
      await fetch('/api/download-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url }),
      })
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  const isRunning = status === 'running'
  
  // Format project path
  const pathParts = projectPath.split('/')
  const projectFolder = pathParts.pop() || projectPath
  const projectPrefix = pathParts.length > 0 ? pathParts.join('/') + '/' : ''

  return (
    <div className="mobile-layout">
      {/* ── Dashboard Tab ── */}
      <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none', flex: 1, overflowY: 'auto', paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        {/* Header */}
        <div className="mobile-header">
          <div className="flex-row gap-3">
            <div className="brand-icon" style={{ width: 30, height: 30, fontSize: '0.75rem', background: 'var(--accent)', color: '#111110' }}>C</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', lineHeight: 1.2 }}>ClawDeck</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Control Dashboard</span>
            </div>
          </div>
          <div className="flex-row gap-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.6875rem', color: 'var(--success)', background: 'var(--success-subtle)', padding: '4px 8px', borderRadius: '99px' }}>
              <Smartphone size={12} /> Mobile Connected
            </div>
            <StatusBadge status={status} />
          </div>
        </div>

        {/* Project Card */}
        <div className="project-card-mobile" style={{ marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem' }}>
              <Folder size={16} color="var(--accent)" />
              Current Project
            </div>
            <button 
              className="btn btn-ghost" 
              style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '99px', color: 'var(--accent)', borderColor: 'var(--border-strong)' }}
              onClick={() => {
                setNewProjectPathInput(projectPath)
                setProjectModalOpen(true)
              }}
            >
              <Edit2 size={12} /> Change
            </button>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', wordBreak: 'break-all' }}>
            {projectPrefix}<span style={{ color: 'var(--accent)', fontWeight: 600 }}>{projectFolder}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--success)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
            Project is active and ready
          </div>
        </div>

        {/* Running indicator */}
        {activeTask && (
          <div className="running-indicator" style={{ margin: 'var(--space-3) var(--space-5)', borderRadius: 'var(--radius-md)' }}>
            <svg className="running-spinner" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40 60" />
            </svg>
            <span style={{ fontSize: '0.75rem' }}>
              {ALL_TASKS.find(t => t.id === activeTask)?.label || activeTask}
            </span>
          </div>
        )}

        {/* Task Grid */}
        <div className="mobile-content" style={{ padding: '0 var(--space-5) var(--space-5) var(--space-5)' }}>
          <div className="mobile-task-grid">
            <button className="mobile-task-card" onClick={() => setSmartTaskModalOpen(true)} disabled={isRunning}>
              <div className="mobile-task-card-icon" style={{ background: `rgba(122, 90, 248, 0.1)`, color: '#7A5AF8' }}>
                <Sparkles size={18} />
              </div>
              <span className="mobile-task-card-label">Ask AI</span>
            </button>
            <button className="mobile-task-card" onClick={() => setDownloadRepoModalOpen(true)} disabled={isRunning}>
              <div className="mobile-task-card-icon" style={{ background: `rgba(229, 83, 75, 0.1)`, color: '#E5534B' }}>
                <DownloadCloud size={18} />
              </div>
              <span className="mobile-task-card-label">Download Repo</span>
            </button>
            {ALL_TASKS.map(task => {
              const Icon = task.IconComponent
              return (
                <button key={task.id} className="mobile-task-card" onClick={() => runTask(task.id)} disabled={isRunning}>
                  <div className="mobile-task-card-icon" style={{ background: `${task.color}14`, color: task.color }}>
                    <Icon size={18} />
                  </div>
                  <span className="mobile-task-card-label">{task.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Terminal Tab ── */}
      <div className="mobile-terminal-view" style={{ display: activeTab === 'terminal' ? 'flex' : 'none' }}>
        <div className="mobile-terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <span style={{ fontFamily: 'JetBrains Mono' }}>{'>_'}</span> Terminal ({logs.length})
          </div>
          <button onClick={() => setLogs([])} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'var(--error)', borderColor: 'var(--error-subtle)', background: 'var(--error-subtle)' }}>
            <Trash2 size={12} /> Clear
          </button>
        </div>
        
        <div className="mobile-terminal-logs" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
              No output yet
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{
                color: log.type === 'stderr' ? 'var(--terminal-error)' :
                       log.type === 'info'   ? 'var(--terminal-info)' :
                       'var(--terminal-command)',
                marginBottom: '4px',
                wordBreak: 'break-all'
              }}>
                {log.text}
              </div>
            ))
          )}
          <div ref={logEndRef} style={{ height: 1 }} />
        </div>
      </div>

      {/* ── Bottom Navigation Bar ── */}
      <div className="mobile-tab-bar">
        <button 
          className={`mobile-tab-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </button>
        <button 
          className={`mobile-tab-item ${activeTab === 'terminal' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          <TerminalSquare size={20} />
          <span>Terminal</span>
        </button>
      </div>

      {/* ── Smart Task Modal ── */}
      {smartTaskModalOpen && (
        <div className="mobile-modal-overlay" onClick={() => setSmartTaskModalOpen(false)}>
          <div className="mobile-modal-content" onClick={e => e.stopPropagation()}>
            <div className="mobile-modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Sparkles size={18} color="var(--accent)" /> Ask Anything
              </div>
              <button onClick={() => setSmartTaskModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              Ask AI to run commands, fix issues, analyze, and more.
            </p>
            <textarea
              autoFocus
              value={smartTaskInput}
              onChange={e => setSmartTaskInput(e.target.value)}
              placeholder="Ask anything... (run dev, fix build, install deps)"
              style={{
                width: '100%',
                height: 120,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                resize: 'none',
                marginBottom: 'var(--space-4)'
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSmartTaskModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: '#7A5AF8', color: '#FFF' }}
                onClick={handleSmartTaskSubmit}
                disabled={!smartTaskInput.trim()}
              >
                <Send size={16} /> Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Project Modal ── */}
      {projectModalOpen && (
        <div className="mobile-modal-overlay" onClick={() => setProjectModalOpen(false)}>
          <div className="mobile-modal-content" onClick={e => e.stopPropagation()}>
            <div className="mobile-modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Folder size={18} color="var(--accent)" /> Change Project
              </div>
              <button onClick={() => setProjectModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={newProjectPathInput}
              onChange={e => setNewProjectPathInput(e.target.value)}
              placeholder="/Users/username/projects/my-app"
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8125rem',
                marginBottom: 'var(--space-4)'
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setProjectModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={handleProjectSubmit}
                disabled={!newProjectPathInput.trim()}
              >
                Set Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Download Repo Modal ── */}
      {downloadRepoModalOpen && (
        <div className="mobile-modal-overlay" onClick={() => setDownloadRepoModalOpen(false)}>
          <div className="mobile-modal-content" onClick={e => e.stopPropagation()}>
            <div className="mobile-modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <DownloadCloud size={18} color="var(--error)" /> Download Repo
              </div>
              <button onClick={() => setDownloadRepoModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              value={repoUrlInput}
              onChange={e => setRepoUrlInput(e.target.value)}
              placeholder="https://github.com/user/repo"
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8125rem',
                marginBottom: 'var(--space-4)'
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDownloadRepoModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: 'var(--error)', color: '#FFF' }}
                onClick={handleDownloadRepoSubmit}
                disabled={!repoUrlInput.trim()}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

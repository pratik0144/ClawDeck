import { useState, useEffect, useCallback } from 'react'
import {
  Play, Square, Unplug,
  ArrowDownToLine, GitCommitHorizontal, ArrowUpFromLine,
  Package, FlaskConical, FileText, Wrench,
  Brain, Video, AtSign, MessageSquare, DownloadCloud
} from 'lucide-react'

import TopBar from './TopBar'
import TaskSection from './TaskSection'
import SmartTaskInput from './SmartTaskInput'
import LogPanel from './LogPanel'
import GitHubSection from './GitHubSection'

/* ── Task Definitions with icons ── */
const DEV_TASKS = [
  { id: 'run-dev',     label: 'Run Dev Server',  IconComponent: Play,    color: '#3B9B5E' },
  { id: 'stop-dev',    label: 'Stop Dev Server', IconComponent: Square,  color: '#E5534B' },
  { id: 'kill-port',   label: 'Kill Port',       IconComponent: Unplug,  color: '#D4A72C' },
]

const GIT_TASKS = [
  { id: 'git-pull',    label: 'Git Pull',        IconComponent: ArrowDownToLine,       color: '#6B9FD4' },
  { id: 'git-commit',  label: 'Git Commit',      IconComponent: GitCommitHorizontal,   color: '#9B8CD4' },
  { id: 'git-push',    label: 'Git Push',        IconComponent: ArrowUpFromLine,       color: '#3B9B5E' },
  { id: 'open-logs',   label: 'Open Logs',       IconComponent: FileText, color: '#7A9AAF' },
]

const AI_TASKS = [
  { id: 'test-ai',     label: 'Test AI',         IconComponent: Brain,   color: '#CBA135' },
  { id: 'fix-build',   label: 'Fix Build',       IconComponent: Wrench,  color: '#9B8CD4' },
]

const BUILD_TASKS = [
  { id: 'install-deps',label: 'Install Deps',    IconComponent: Package,      color: '#C47A5A' },
  { id: 'run-tests',   label: 'Run Tests',       IconComponent: FlaskConical, color: '#D4A72C' },
]

const WEB_TASKS = [
  { id: 'download-repo-prompt', label: 'Download Repo', IconComponent: DownloadCloud, color: '#E5534B' },
  { id: 'open-youtube',label: 'YouTube',         IconComponent: Video,          color: '#E5534B' },
  { id: 'open-twitter',label: 'Twitter',         IconComponent: AtSign,         color: '#6B9FD4' },
  { id: 'open-chatgpt',label: 'ChatGPT',         IconComponent: MessageSquare,  color: '#3B9B5E' },
]

const ALL_TASKS = [...DEV_TASKS, ...GIT_TASKS, ...AI_TASKS, ...BUILD_TASKS, ...WEB_TASKS]

export default function Dashboard({ socketRef, sessionStatus }) {
  const [status, setStatus] = useState('idle')
  const [logs, setLogs] = useState([])
  const [activeTask, setActiveTask] = useState(null)
  const [projectPath, setProjectPath] = useState('')
  const [activeProject, setActiveProject] = useState('')
  const [smartInput, setSmartInput] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [githubUser, setGithubUser] = useState('')

  // Fetch initial project dir
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => {
      setProjectPath(d.dir)
      setActiveProject(d.dir)
    }).catch(console.error)
  }, [])

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return

    const onConnect = () => addLog('info', '● Connected to ClawDeck server')
    const onLog = (data) => addLog(data.type || 'stdout', data.text)
    const onStatus = (data) => {
      setStatus(data.status)
      if (data.status !== 'running') setActiveTask(null)
      if (data.message) addLog('info', `● ${data.message}`)
    }
    const onDisconnect = () => addLog('info', '● Disconnected from server')
    const onProjectChanged = (data) => {
      if (data.path) {
        setProjectPath(data.path)
        setActiveProject(data.path)
      }
    }

    socket.on('connect', onConnect)
    socket.on('task:log', onLog)
    socket.on('task:status', onStatus)
    socket.on('disconnect', onDisconnect)
    socket.on('project:changed', onProjectChanged)

    return () => {
      socket.off('connect', onConnect)
      socket.off('task:log', onLog)
      socket.off('task:status', onStatus)
      socket.off('disconnect', onDisconnect)
      socket.off('project:changed', onProjectChanged)
    }
  }, [socketRef.current])

  const addLog = useCallback((type, text) => {
    setLogs(prev => [...prev, { type, text, ts: Date.now() }])
  }, [])

  const runTask = useCallback(async (taskId) => {
    if (taskId === 'download-repo-prompt') {
      const url = window.prompt("Enter GitHub Repo URL to download:");
      if (!url) return;
      setStatus('running');
      setActiveTask('download-repo');
      addLog('info', `● Downloading repo: ${url}`);
      try {
        const res = await fetch('/api/download-repo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl: url }),
        });
        if (!res.ok) {
          const err = await res.json();
          addLog('stderr', `Error: ${err.error}`);
          setStatus('error');
          setActiveTask(null);
        }
      } catch (err) {
        addLog('stderr', `Network error: ${err.message}`);
        setStatus('error');
        setActiveTask(null);
      }
      return;
    }

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
    if (!smartInput.trim()) return
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
        body: JSON.stringify({ path: projectPath }),
      })
      const data = await res.json()
      if (res.ok) {
        setActiveProject(data.path)
        addLog('info', `✅ Project changed to: ${data.path}`)
      } else {
        addLog('stderr', `❌ Failed to set project: ${data.error}`)
      }
    } catch (err) {
      addLog('stderr', `❌ Network error: ${err.message}`)
    }
  }

  const getSystemStats = async () => {
    try {
      addLog('info', '● Fetching System Stats…')
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

  const clearLogs = useCallback(() => setLogs([]), [])

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

  const isRunning = status === 'running'

  return (
    <div className="dashboard">
      <TopBar
        status={status}
        sessionStatus={sessionStatus}
        projectPath={projectPath}
        onProjectChange={setProjectPath}
        onProjectSet={handleSetProject}
      />

      <main className="dashboard-content">
        <div className="page-container flex-col gap-6">
          {/* Running indicator */}
          {activeTask && (
            <div className="running-indicator">
              <svg className="running-spinner" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40 60" />
              </svg>
              <span>
                Running: {ALL_TASKS.find(t => t.id === activeTask)?.label || activeTask}
              </span>
            </div>
          )}

          {/* Smart Task */}
          <SmartTaskInput
            value={smartInput}
            onChange={setSmartInput}
            onSubmit={runSmartTask}
            disabled={isRunning}
          />

          {/* Task Sections */}
          <TaskSection title="Dev Controls" tasks={DEV_TASKS} onTaskClick={runTask} disabled={isRunning} />
          <TaskSection title="Git Actions" tasks={GIT_TASKS} onTaskClick={runTask} disabled={isRunning} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            <TaskSection title="AI Actions" tasks={AI_TASKS} onTaskClick={runTask} disabled={isRunning} />
            <TaskSection title="Build & Test" tasks={BUILD_TASKS} onTaskClick={runTask} disabled={isRunning} />
          </div>

          <TaskSection title="Web Tools" tasks={WEB_TASKS} onTaskClick={runTask} disabled={isRunning} />

          {/* GitHub */}
          <GitHubSection
            repoUrl={repoUrl}
            onRepoUrlChange={setRepoUrl}
            onDownloadRepo={downloadRepo}
            githubUser={githubUser}
            onGithubUserChange={setGithubUser}
            onDownloadUserRepos={downloadUserRepos}
            disabled={isRunning}
          />

          {/* Terminal */}
          <LogPanel logs={logs} onClear={clearLogs} onStats={getSystemStats} />
        </div>
      </main>

      <footer className="app-footer">
        <div className="page-container">
          ClawDeck v0.2 · Local Developer Dashboard
        </div>
      </footer>
    </div>
  )
}

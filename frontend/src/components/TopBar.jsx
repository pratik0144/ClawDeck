import { Smartphone } from 'lucide-react'
import StatusBadge from './StatusBadge'

export default function TopBar({ status, sessionStatus, projectPath, onProjectChange, onProjectSet }) {
  const isPaired = sessionStatus === 'paired'

  return (
    <header className="top-bar">
      <div className="page-container">
        <div className="top-bar-inner">
          {/* Brand */}
          <div className="brand">
            <div className="brand-icon">C</div>
            <div className="brand-text">
              <h1>ClawDeck</h1>
              <p>Control Dashboard</p>
            </div>
          </div>

          {/* Project Path */}
          <div className="project-path">
            <input
              type="text"
              value={projectPath}
              onChange={(e) => onProjectChange(e.target.value)}
              placeholder="/path/to/project"
            />
            <button onClick={onProjectSet} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.6875rem' }}>
              Set
            </button>
          </div>

          {/* Right side: connection + status */}
          <div className="flex-row gap-3">
            {isPaired && (
              <span className="badge badge-success" style={{ gap: '6px' }}>
                <Smartphone size={12} />
                Mobile Connected
              </span>
            )}
            <StatusBadge status={status} />
          </div>
        </div>
      </div>
    </header>
  )
}

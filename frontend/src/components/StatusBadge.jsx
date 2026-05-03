export default function StatusBadge({ status }) {
  const config = {
    idle:         { dot: 'status-dot-idle',    label: 'Idle',         cls: 'badge-neutral' },
    running:      { dot: 'status-dot-warning', label: 'Running',      cls: 'badge-warning' },
    success:      { dot: 'status-dot-success', label: 'Success',      cls: 'badge-success' },
    error:        { dot: 'status-dot-error',   label: 'Error',        cls: 'badge-error' },
    creating:     { dot: 'status-dot-idle',    label: 'Creating…',    cls: 'badge-neutral' },
    waiting:      { dot: 'status-dot-warning', label: 'Waiting',      cls: 'badge-warning' },
    paired:       { dot: 'status-dot-success', label: 'Connected',    cls: 'badge-success' },
    expired:      { dot: 'status-dot-error',   label: 'Expired',      cls: 'badge-error' },
    disconnected: { dot: 'status-dot-error',   label: 'Disconnected', cls: 'badge-error' },
  }
  const c = config[status] || config.idle

  return (
    <span className={`badge ${c.cls}`}>
      <span
        className={`status-dot ${c.dot}`}
        style={status === 'running' || status === 'waiting' ? { animation: 'pulse-dot 1.5s ease-in-out infinite' } : {}}
      />
      {c.label}
    </span>
  )
}

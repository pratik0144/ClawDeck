import { useRef, useEffect } from 'react'
import { Terminal, Trash2, Cpu } from 'lucide-react'

export default function LogPanel({ logs, onClear, onStats }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <section className="animate-fade-in">
      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
        <div className="flex-row gap-2">
          <Terminal size={16} color="var(--text-muted)" />
          <h3 className="section-title" style={{ margin: 0 }}>Terminal</h3>
        </div>
        <div className="flex-row gap-2">
          <button onClick={onStats} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.6875rem' }}>
            <Cpu size={12} />
            Stats
          </button>
          <button onClick={onClear} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.6875rem' }}>
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>
      <div className="log-container" style={{ minHeight: 180 }}>
        {logs.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 120,
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
          }}>
            Waiting for task execution…
          </div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className={`log-line ${
                log.type === 'stderr'  ? 'log-line-stderr' :
                log.type === 'info'    ? 'log-line-info' :
                log.type === 'success' ? 'log-line-success' :
                'log-line-stdout'
              }`}
            >
              {log.text}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </section>
  )
}

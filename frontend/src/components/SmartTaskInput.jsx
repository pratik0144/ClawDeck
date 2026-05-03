import { Sparkles } from 'lucide-react'

export default function SmartTaskInput({ value, onChange, onSubmit, disabled }) {
  return (
    <div className="smart-input-bar">
      <Sparkles size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSubmit()}
        placeholder="Ask anything… run dev server, fix build, install deps"
        disabled={disabled}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className="btn btn-primary"
        style={{ padding: '8px 20px' }}
      >
        Run
      </button>
    </div>
  )
}

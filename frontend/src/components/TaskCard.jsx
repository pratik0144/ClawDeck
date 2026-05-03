export default function TaskCard({ task, onClick, disabled }) {
  const IconComponent = task.IconComponent

  return (
    <button
      id={`task-${task.id}`}
      onClick={() => onClick(task.id)}
      disabled={disabled}
      className="task-card"
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = task.color
        e.currentTarget.style.boxShadow = `0 0 16px ${task.color}18, 0 4px 16px rgba(0,0,0,0.3)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <div
        className="task-card-icon"
        style={{ background: `${task.color}14`, color: task.color }}
      >
        {IconComponent && <IconComponent size={20} />}
      </div>
      <span className="task-card-label">{task.label}</span>
    </button>
  )
}

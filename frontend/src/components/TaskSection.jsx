import TaskCard from './TaskCard'

export default function TaskSection({ title, tasks, onTaskClick, disabled }) {
  return (
    <section className="animate-fade-in">
      <h3 className="section-title">{title}</h3>
      <div className="task-grid">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  )
}

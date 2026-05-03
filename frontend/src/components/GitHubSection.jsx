import { Download, User } from 'lucide-react'

export default function GitHubSection({
  repoUrl, onRepoUrlChange, onDownloadRepo,
  githubUser, onGithubUserChange, onDownloadUserRepos,
  disabled,
}) {
  return (
    <section className="animate-fade-in">
      <h3 className="section-title">GitHub Downloads</h3>
      <div className="github-row">
        {/* Single repo */}
        <div className="github-input-card">
          <Download size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={repoUrl}
            onChange={e => onRepoUrlChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onDownloadRepo()}
            placeholder="https://github.com/user/repo"
            disabled={disabled}
          />
          <button
            onClick={onDownloadRepo}
            disabled={disabled || !repoUrl.trim()}
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.6875rem' }}
          >
            Clone
          </button>
        </div>

        {/* User repos */}
        <div className="github-input-card">
          <User size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={githubUser}
            onChange={e => onGithubUserChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onDownloadUserRepos()}
            placeholder="GitHub username"
            disabled={disabled}
          />
          <button
            onClick={onDownloadUserRepos}
            disabled={disabled || !githubUser.trim()}
            className="btn btn-ghost"
            style={{ padding: '6px 14px', fontSize: '0.6875rem' }}
          >
            All Repos
          </button>
        </div>
      </div>
    </section>
  )
}

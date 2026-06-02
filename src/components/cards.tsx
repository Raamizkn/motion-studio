import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudioTemplate, VideoProject } from '../types'
import { ScenePreview, ASPECT_RATIO } from './ScenePreview'
import { StatusBadge } from './shared'
import { Icon } from './Icon'
import { useStore } from '../store'

export function TemplateCard({ tpl, onUse }: { tpl: StudioTemplate; onUse: (t: StudioTemplate) => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onUse(tpl)}
      style={{
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform .18s var(--ease), border-color .18s',
        transform: hover ? 'translateY(-3px)' : 'none',
        borderColor: hover ? 'var(--border-strong)' : 'var(--border)',
      }}
    >
      <div style={{ position: 'relative' }}>
        <ScenePreview seed={tpl.seed} ratio={16 / 9} />
        {tpl.isNew && (
          <span className="badge new" style={{ position: 'absolute', top: 10, left: 10 }}>
            New
          </span>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 14,
            background: 'linear-gradient(to top, rgba(0,0,0,.55), transparent 45%)',
            opacity: hover ? 1 : 0,
            transition: 'opacity .18s',
          }}
        >
          <span className="btn primary sm">
            Use template <Icon name="arrowRight" size={14} />
          </span>
        </div>
      </div>
      <div style={{ padding: '11px 13px 13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{tpl.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tpl.aspect}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, display: 'flex', gap: 8 }}>
          <span>{tpl.durationSec}s</span>
          <span>·</span>
          <span style={{ textTransform: 'capitalize' }}>{tpl.category}</span>
        </div>
      </div>
    </div>
  )
}

export function ProjectCard({ project }: { project: VideoProject }) {
  const nav = useNavigate()
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState(false)
  const { renameProject, deleteProject, duplicateProject } = useStore()
  const ratio = ASPECT_RATIO[project.config.aspect]
  const dest =
    project.status === 'complete' || project.status === 'rendering'
      ? `/studio/projects/${project.id}/editor`
      : `/studio/projects/${project.id}/storyboard`

  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setMenu(false)
      }}
      style={{
        overflow: 'hidden',
        cursor: 'pointer',
        flex: '0 0 260px',
        transition: 'transform .18s var(--ease), border-color .18s',
        transform: hover ? 'translateY(-3px)' : 'none',
        borderColor: hover ? 'var(--border-strong)' : 'var(--border)',
        position: 'relative',
      }}
      onClick={() => nav(dest)}
    >
      <div style={{ position: 'relative', background: '#0a0a0c' }}>
        {project.thumbnail ? (
          <ScenePreview seed={project.thumbnail} ratio={16 / 9} />
        ) : (
          <div style={{ aspectRatio: '16/9' }} className="shimmer" />
        )}
        <button
          className="btn icon sm"
          onClick={(e) => {
            e.stopPropagation()
            setMenu((m) => !m)
          }}
          style={{ position: 'absolute', top: 8, right: 8, opacity: hover ? 1 : 0, transition: 'opacity .15s', background: 'rgba(0,0,0,.5)' }}
          aria-label="Project menu"
        >
          <Icon name="grip" size={15} />
        </button>
        {menu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ position: 'absolute', top: 40, right: 8, zIndex: 20, padding: 5, width: 150, background: 'var(--bg-elev)', boxShadow: 'var(--shadow-pop)' }}
          >
            {[
              { label: 'Rename', fn: () => { const n = prompt('Rename project', project.name); if (n) renameProject(project.id, n) } },
              { label: 'Duplicate', fn: () => duplicateProject(project.id) },
              { label: 'Delete', fn: () => deleteProject(project.id), danger: true },
            ].map((a) => (
              <button
                key={a.label}
                onClick={() => { a.fn(); setMenu(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, fontSize: 13, color: a.danger ? 'var(--red)' : 'var(--text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: '11px 13px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
          <StatusBadge status={project.status} />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 5, display: 'flex', gap: 7 }}>
          <span>{project.config.aspect}</span>
          <span>·</span>
          <span>{project.config.durationSec}s</span>
          <span>·</span>
          <span>{timeAgo(project.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function timeAgo(ts: number) {
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

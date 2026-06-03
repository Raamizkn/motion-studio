import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudioTemplate, VideoProject } from '../types'
import { ScenePreview, ASPECT_RATIO } from './ScenePreview'
import { StatusBadge } from './shared'
import { Icon } from './Icon'
import { useStore } from '../store'

// Bespoke editorial preview — matches the warm-paper / serif register the
// YC-style template actually produces, so the card reads true to the output.
function EditorialPreview() {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#F5F2EC', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, padding: '14% 12%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8A8575', marginBottom: 8 }}>Introducing</div>
        <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 700, fontSize: 26, lineHeight: 1.04, color: '#141414', letterSpacing: '-0.01em' }}>
          Built for the<br />people who <span style={{ color: '#3B5BDB' }}>make</span><br />things.
        </div>
        <div style={{ position: 'absolute', right: '8%', bottom: '8%', fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 700, fontSize: 40, color: 'rgba(20,20,20,0.07)' }}>2025</div>
      </div>
    </div>
  )
}

const THUMB_DIMS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 }, '9:16': { w: 1080, h: 1920 }, '1:1': { w: 1080, h: 1080 }, '4:5': { w: 1080, h: 1350 },
}
// Static thumbnail rendered from the real composition (seeked to a hold frame),
// so project previews match the actual output — never the old scene-graph seed.
function CompThumb({ html, aspect }: { html: string; aspect: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const iref = useRef<HTMLIFrameElement | null>(null)
  const [w, setW] = useState(0)
  const dim = THUMB_DIMS[aspect] || THUMB_DIMS['16:9']
  useEffect(() => {
    const el = ref.current; if (!el) return
    const m = () => setW(el.getBoundingClientRect().width)
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect()
  }, [])
  const onLoad = () => {
    const win = iref.current?.contentWindow as any
    let tries = 0
    const grab = () => {
      const tl = win?.__timelines?.main
      if (tl) { try { tl.pause(); tl.seek(Math.max(0, tl.duration() * 0.66)) } catch { /* */ } }
      else if (tries++ < 60) win?.setTimeout(grab, 40)
    }
    grab()
  }
  const scale = w ? w / dim.w : 0
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', aspectRatio: `${dim.w} / ${dim.h}`, overflow: 'hidden', background: '#0a0a0c', pointerEvents: 'none' }}>
      {scale > 0 && (
        <iframe ref={iref} srcDoc={html} onLoad={onLoad} title="" scrolling="no" tabIndex={-1}
          style={{ position: 'absolute', top: 0, left: 0, width: dim.w, height: dim.h, border: 'none', transformOrigin: 'top left', transform: `scale(${scale})` }} />
      )}
    </div>
  )
}

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
        {tpl.register === 'editorial' ? <EditorialPreview /> : <ScenePreview seed={tpl.seed} ratio={16 / 9} />}
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
  const dest = project.composedHtml
    ? `/studio/projects/${project.id}/editor`
    : project.status === 'complete' || project.status === 'rendering'
      ? `/studio/projects/${project.id}/editor`
      : `/studio/projects/${project.id}/generate`

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
        {project.composedHtml ? (
          <CompThumb html={project.composedHtml} aspect={project.config.aspect} />
        ) : project.thumbnail ? (
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

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../data'
import { TemplateCard, ProjectCard } from '../components/cards'
import { ScenePreview } from '../components/ScenePreview'
import { Icon } from '../components/Icon'
import type { StudioTemplate } from '../types'

const START_CARDS: { id: string; title: string; desc: string; seed: any; tab: string }[] = [
  {
    id: 'website',
    title: 'From a website',
    desc: 'Turn any URL into a branded motion video',
    tab: 'custom',
    seed: { kind: 'split', palette: ['#7c5cff', '#c44bff', '#4e7bff'], headline: 'yoursite.com', lines: ['Auto-branded'], accent: '#7c5cff' },
  },
  {
    id: 'prompt',
    title: 'From a prompt',
    desc: 'Describe it — AI writes the storyboard',
    tab: 'custom',
    seed: { kind: 'hero', palette: ['#2dd4bf', '#3b82f6', '#6366f1'], headline: 'Just *describe* it', lines: ['AI does the rest', 'New'], accent: '#2dd4bf' },
  },
  {
    id: 'template',
    title: 'Templates',
    desc: 'Start from a proven structure',
    tab: 'templates',
    seed: { kind: 'cards', palette: ['#ff6b6b', '#ff9f45', '#ffd93d'], headline: 'Templates', lines: ['SaaS', 'Social', 'Brand'], accent: '#ff6b6b' },
  },
  {
    id: 'scratch',
    title: 'From scratch',
    desc: 'Build any motion you want',
    tab: 'custom',
    seed: { kind: 'logo', palette: ['#c8f24e', '#3ad27f', '#2dd4bf'], headline: 'M', lines: ['Blank canvas'], accent: '#c8f24e' },
  },
]

export function Dashboard() {
  const nav = useNavigate()
  const projects = useStore((s) => s.projects)
  const [cat, setCat] = useState<string>('All')

  const filtered = cat === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat)

  const useTemplate = (t: StudioTemplate) => nav(`/studio/new?template=${t.id}`)

  return (
    <div style={{ padding: '28px 36px 60px', maxWidth: 1320, margin: '0 auto' }}>
      {/* Hero */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Motion <span style={{ color: 'var(--accent-2)' }}>Studio</span>
            </h1>
            <span className="badge new" style={{ height: 19 }}>New</span>
          </div>
          <p style={{ color: 'var(--text-2)', marginTop: 6, fontSize: 14.5 }}>
            Create motion-rich videos with AI. Powered by <strong style={{ color: 'var(--text)' }}>Kinetic</strong>.
          </p>
        </div>
        <button className="btn primary" onClick={() => nav('/studio/new')} style={{ height: 40 }}>
          <Icon name="plus" size={17} /> New Video
        </button>
      </div>

      {/* Start cards (Higgsfield-style) */}
      <h2 style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600, margin: '26px 0 13px' }}>How would you like to start?</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {START_CARDS.map((c, i) => (
          <div
            key={c.id}
            className="card fade-up start-card"
            style={{ overflow: 'hidden', cursor: 'pointer', animationDelay: `${i * 50}ms` }}
            onClick={() => nav(`/studio/new?tab=${c.tab}${c.id === 'template' ? '' : ''}`)}
          >
            <ScenePreview seed={c.seed} ratio={16 / 9} />
            <div style={{ padding: '12px 14px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14 }}>
                {c.title} <Icon name="arrowRight" size={15} style={{ color: 'var(--text-3)' }} />
              </div>
              <p style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 4 }}>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <style>{`.start-card{transition:transform .18s var(--ease),border-color .18s}
        .start-card:hover{transform:translateY(-3px);border-color:var(--border-strong)}`}</style>

      {/* Recent projects */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '36px 0 14px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Your projects</h2>
      </div>
      {projects.length === 0 ? (
        <div
          className="card"
          style={{ padding: '46px 20px', textAlign: 'center', display: 'grid', placeItems: 'center', gap: 14 }}
        >
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
            <Icon name="motion" size={28} style={{ color: 'var(--accent-2)' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>No projects yet</div>
            <p style={{ color: 'var(--text-3)', marginTop: 4 }}>Create your first video or start from a template below.</p>
          </div>
          <button className="btn primary" onClick={() => nav('/studio/new')}>
            <Icon name="plus" size={16} /> Create your first video
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      {/* Templates */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '40px 0 14px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>Start with a template</h2>
        <div style={{ display: 'flex', gap: 7 }}>
          {TEMPLATE_CATEGORIES.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {filtered.map((t) => (
          <TemplateCard key={t.id} tpl={t} onUse={useTemplate} />
        ))}
      </div>
    </div>
  )
}

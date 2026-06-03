import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { TEMPLATES, TEMPLATE_CATEGORIES, FLOW_CONFIGS } from '../data'
import type { FlowType } from '../data'
import { TemplateCard, ProjectCard } from '../components/cards'
import { ScenePreview } from '../components/ScenePreview'
import { Icon } from '../components/Icon'
import type { StudioTemplate } from '../types'

// ── Flow entry cards (start a fresh composition in a given register) ────────
const VM_CARDS: { id: FlowType; seed: any }[] = [
  {
    id: 'presentations',
    seed: { kind: 'hero', palette: ['#8a3ffc', '#a56eff', '#6929c4'], headline: 'Present', lines: ['Brand Motion'], accent: '#8a3ffc' },
  },
  {
    id: 'text-motion',
    seed: { kind: 'split', palette: ['#ff6b6b', '#ff9f45', '#ffd93d'], headline: 'Animate', lines: ['Text Motion'], accent: '#ff6b6b' },
  },
  {
    id: 'posters',
    seed: { kind: 'cards', palette: ['#ff5d8f', '#ff8fb1', '#c44bff'], headline: 'Poster', lines: ['Brand Visual'], accent: '#ff5d8f' },
  },
  {
    id: 'infographics',
    seed: { kind: 'logo', palette: ['#f59e0b', '#ef4444', '#8b5cf6'], headline: 'Data', lines: ['Infographic'], accent: '#f59e0b' },
  },
]

export function Dashboard() {
  const nav = useNavigate()
  const projects = useStore((s) => s.projects)
  const [cat, setCat] = useState<string>('All')
  const filtered = cat === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat)

  // Templates never auto-generate — selecting one opens the Assist config with
  // the template's settings prefilled, so the user can tweak before composing.
  const useTemplate = (t: StudioTemplate) => {
    nav(`/studio/create/text-motion?template=${encodeURIComponent(t.id)}`)
  }

  return (
    <div className="vm-dashboard">
      <style>{`
        .vm-dashboard {
          height: 100%;
          overflow-y: auto;
          background: var(--bg);
        }
        .vm-home-scroll {
          max-width: 1240px;
          margin: 0 auto;
          padding: 28px 32px 48px;
          display: flex;
          flex-direction: column;
          gap: 34px;
        }

        /* Hero */
        .vm-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 18px 0 2px;
        }
        .vm-hero-title {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 600;
          color: var(--text);
          letter-spacing: -0.01em;
          text-align: center;
        }
        .vm-hero-sub {
          font-family: var(--font-display);
          font-size: 16px;
          color: var(--text-3);
          text-align: center;
          max-width: 560px;
        }

        /* Flow entry cards */
        .vm-flow-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 14px;
        }
        .vm-tpl-card {
          display: flex;
          flex-direction: column;
          padding: 4px;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 14px;
          cursor: pointer;
          transition: border-color 0.15s, transform 0.15s;
          overflow: hidden;
        }
        .vm-tpl-card:hover { border-color: var(--border-strong); transform: translateY(-2px); }
        .vm-tpl-thumb { width: 100%; aspect-ratio: 3/4; border-radius: 10px; overflow: hidden; flex: none; }
        .vm-tpl-card.create-new .vm-tpl-thumb {
          background: var(--surface);
          display: grid;
          place-items: center;
        }
        .vm-tpl-info { padding: 8px 6px 6px; display: flex; flex-direction: column; gap: 2px; }
        .vm-tpl-row { display: flex; align-items: center; justify-content: space-between; }
        .vm-tpl-name { font-family: var(--font-display); font-size: 13px; font-weight: 600; color: var(--text); }
        .vm-tpl-desc { font-family: var(--font-display); font-size: 11px; color: var(--text-3); line-height: 1.4; margin-top: 2px; }

        /* Section headers */
        .vm-section-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .vm-section-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
        }
      `}</style>

      <div className="vm-home-scroll">
        {/* Hero */}
        <div className="vm-hero fade-up">
          <h1 className="vm-hero-title">Welcome to Vibe Motion</h1>
          <p className="vm-hero-sub">
            Explore curated templates from Imagine's studios or start creating from scratch.
          </p>
        </div>

        {/* Flow entry cards */}
        <div className="vm-flow-row fade-up" style={{ animationDelay: '50ms' }}>
          {VM_CARDS.map((c) => {
            const cfg = FLOW_CONFIGS[c.id]
            return (
              <div key={c.id} className="vm-tpl-card" onClick={() => nav(`/studio/create/${c.id}`)}>
                <div className="vm-tpl-thumb">
                  <ScenePreview seed={c.seed} ratio={3 / 4} />
                </div>
                <div className="vm-tpl-info">
                  <div className="vm-tpl-row">
                    <span className="vm-tpl-name">{cfg.title.split(' ')[0]}</span>
                    <Icon name="arrowRight" size={13} style={{ color: 'var(--text-4)' }} />
                  </div>
                  <div className="vm-tpl-desc">{cfg.subtitle}</div>
                </div>
              </div>
            )
          })}
          {/* Create New */}
          <div className="vm-tpl-card create-new" onClick={() => nav('/studio/create/create-new')}>
            <div className="vm-tpl-thumb">
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border-strong)', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
                <Icon name="plus" size={16} />
              </div>
            </div>
            <div className="vm-tpl-info">
              <div className="vm-tpl-row">
                <span className="vm-tpl-name">Create New</span>
                <Icon name="arrowRight" size={13} style={{ color: 'var(--text-4)' }} />
              </div>
              <div className="vm-tpl-desc">Start from scratch with AI</div>
            </div>
          </div>
        </div>

        {/* Your projects */}
        {projects.length > 0 && (
          <div className="fade-up" style={{ animationDelay: '80ms' }}>
            <div className="vm-section-row" style={{ marginBottom: 14 }}>
              <div className="vm-section-title">Your projects</div>
            </div>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6 }}>
              {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        )}

        {/* Full template library */}
        <div className="fade-up" style={{ animationDelay: '120ms' }}>
          <div className="vm-section-row" style={{ marginBottom: 14 }}>
            <div className="vm-section-title">Start with a template</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {TEMPLATE_CATEGORIES.map((c) => (
                <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {filtered.map((t) => <TemplateCard key={t.id} tpl={t} onUse={useTemplate} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

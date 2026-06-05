import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { TEMPLATES, TEMPLATE_CATEGORIES } from '../data'
import type { FlowType } from '../data'
import { TemplateCard, ProjectCard, TemplatePreview } from '../components/cards'
import { Icon } from '../components/Icon'
import type { StudioTemplate } from '../types'
import type { UseCase } from '../spec'
import { StudioModal } from '../components/grid/StudioModal'
import { ResultModal } from '../components/grid/ResultModal'

// ── Flow entry cards — each opens the Studio modal seeded to a use case ──────
type FlowCard = { id: FlowType; useCase: UseCase; register: 'infographic' | 'presentation' | 'bold' | 'poster'; title: string; kicker: string; desc: string; palette: string[] }
const VM_CARDS: FlowCard[] = [
  { id: 'infographics', useCase: 'saas_explainer', register: 'infographic', title: '+212% growth', kicker: 'Infographic', desc: 'Animate charts, data and visual storytelling', palette: ['#22c55e', '#3b82f6'] },
  { id: 'presentations', useCase: 'pitch', register: 'presentation', title: 'Q3 in review', kicker: 'Presentation', desc: 'Smooth, engaging slides and motion decks', palette: ['#3b82f6', '#8a3ffc'] },
  { id: 'text-motion', useCase: 'brand_manifesto', register: 'bold', title: 'Bring text to life', kicker: 'Visual Text', desc: 'Expressive kinetic titles, captions and type', palette: ['#ff6b6b', '#ff9f45'] },
  { id: 'posters', useCase: 'physical_ad', register: 'poster', title: 'The drop is here', kicker: 'Animated Poster', desc: 'Turn static posters into motion visuals', palette: ['#ec4899', '#8a3ffc'] },
]

export function Dashboard() {
  const nav = useNavigate()
  const { id: resultId } = useParams()
  const projects = useStore((s) => s.projects)
  const [cat, setCat] = useState<string>('All')
  const [studioOpen, setStudioOpen] = useState(false)
  const [studioUseCase, setStudioUseCase] = useState<UseCase | undefined>(undefined)
  const filtered = cat === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat)
  const openStudio = (useCase?: UseCase) => { setStudioUseCase(useCase); setStudioOpen(true) }
  // Result modal is opened by being on /studio/projects/:id/result
  const resultProject = resultId ? projects.find((p) => p.id === resultId) : null

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

        /* Flow entry cards — all the same size */
        .vm-flow-row {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }
        @media (max-width: 1000px) { .vm-flow-row { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 640px) { .vm-flow-row { grid-template-columns: repeat(2, 1fr); } }
        .vm-flow-card {
          display: flex; flex-direction: column; padding: 0; text-align: left;
          background: var(--bg-elev); border: 1px solid var(--border);
          border-radius: 16px; cursor: pointer; overflow: hidden;
          transition: border-color 0.15s, transform 0.15s, box-shadow .15s;
        }
        .vm-flow-card:hover { border-color: var(--border-strong); transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,.4); }
        .vm-flow-art { width: 100%; aspect-ratio: 4/5; overflow: hidden; flex: none; }
        .vm-flow-scratch { background: var(--surface); display: grid; place-items: center; }
        .vm-flow-plus { width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border-strong); display: grid; place-items: center; color: var(--text-3); }
        .vm-flow-info { padding: 11px 12px 13px; display: flex; flex-direction: column; gap: 3px; }
        .vm-flow-row-top { display: flex; align-items: center; justify-content: space-between; }
        .vm-flow-name { font-family: var(--font-display); font-size: 14px; font-weight: 650; color: var(--text); }
        .vm-flow-desc { font-family: var(--font-display); font-size: 11.5px; color: var(--text-3); line-height: 1.4; }

        /* project tile ⋮ menu */
        .tpl-menu-btn {
          position: absolute; top: 8px; right: 8px; z-index: 4; width: 28px; height: 28px;
          border-radius: 8px; border: none; background: rgba(0,0,0,.55); color: #fff;
          display: grid; place-items: center; cursor: pointer; transition: opacity .15s, background .15s;
        }
        .tpl-menu-btn:hover { background: rgba(0,0,0,.8); }
        .tpl-menu {
          position: absolute; top: 42px; right: 8px; z-index: 20; padding: 5px; width: 150px;
          background: var(--bg-elev); border: 1px solid var(--border-strong); border-radius: 12px; box-shadow: var(--shadow-pop);
        }

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

        /* ── Template mosaic — masonry columns, tiles at natural aspect ── */
        .vm-mosaic { column-count: 4; column-gap: 14px; }
        @media (max-width: 1100px) { .vm-mosaic { column-count: 3; } }
        @media (max-width: 760px) { .vm-mosaic { column-count: 2; } }
        .tpl-tile {
          display: block; width: 100%; margin: 0 0 14px; padding: 0; border: none;
          border-radius: 16px; overflow: hidden; position: relative; cursor: pointer;
          break-inside: avoid; background: #0a0a0c;
          box-shadow: 0 1px 0 var(--border);
          transition: transform .18s var(--ease), box-shadow .18s;
        }
        .tpl-tile:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,0,0,.45); }
        .tpl-tile-art { width: 100%; display: block; }
        .tpl-tile-overlay {
          position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column;
          justify-content: flex-end; gap: 10px; padding: 14px;
          background: linear-gradient(to top, rgba(0,0,0,.82) 8%, rgba(0,0,0,.35) 42%, transparent 70%);
          opacity: 0; transition: opacity .18s; text-align: left;
        }
        .tpl-tile:hover .tpl-tile-overlay { opacity: 1; }
        .tpl-tile-name { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: #fff; }
        .tpl-tile-desc { font-size: 11.5px; line-height: 1.4; color: rgba(255,255,255,.78); margin-top: 3px; }
        .tpl-tile-foot { display: flex; gap: 6px; font-size: 10.5px; color: rgba(255,255,255,.6); margin-top: 7px; }
        .tpl-tile-cta {
          display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
          background: #fff; color: #111; font-size: 12px; font-weight: 650;
          padding: 6px 12px; border-radius: 9999px;
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

        {/* Flow entry cards — same size, each previews its register's motion */}
        <div className="vm-flow-row fade-up" style={{ animationDelay: '50ms' }}>
          {VM_CARDS.map((c) => (
            <button key={c.id} className="vm-flow-card" onClick={() => openStudio(c.useCase)}>
              <div className="vm-flow-art">
                <TemplatePreview register={c.register} palette={c.palette} title={c.title} kicker={c.kicker} ratio={4 / 5} />
              </div>
              <div className="vm-flow-info">
                <div className="vm-flow-row-top"><span className="vm-flow-name">{c.kicker}</span><Icon name="arrowRight" size={14} style={{ color: 'var(--text-4)' }} /></div>
                <div className="vm-flow-desc">{c.desc}</div>
              </div>
            </button>
          ))}
          {/* From scratch */}
          <button className="vm-flow-card" onClick={() => openStudio(undefined)}>
            <div className="vm-flow-art vm-flow-scratch">
              <div className="vm-flow-plus"><Icon name="plus" size={20} /></div>
            </div>
            <div className="vm-flow-info">
              <div className="vm-flow-row-top"><span className="vm-flow-name">From scratch</span><Icon name="arrowRight" size={14} style={{ color: 'var(--text-4)' }} /></div>
              <div className="vm-flow-desc">Start with a blank canvas and build any motion you want</div>
            </div>
          </button>
        </div>

        {/* Your projects */}
        {projects.length > 0 && (
          <div className="fade-up" style={{ animationDelay: '80ms' }}>
            <div className="vm-section-row" style={{ marginBottom: 14 }}>
              <div className="vm-section-title">Your projects</div>
            </div>
            <div className="vm-mosaic">
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
          <div className="vm-mosaic">
            {filtered.map((t) => <TemplateCard key={t.id} tpl={t} onUse={useTemplate} />)}
          </div>
        </div>
      </div>

      <StudioModal open={studioOpen} onClose={() => setStudioOpen(false)} initialUseCase={studioUseCase} />
      {resultProject && <ResultModal project={resultProject} onClose={() => nav('/studio')} />}
    </div>
  )
}

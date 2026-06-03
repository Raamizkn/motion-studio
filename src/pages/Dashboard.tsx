import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { TEMPLATES, TEMPLATE_CATEGORIES, FLOW_CONFIGS } from '../data'
import type { FlowType } from '../data'
import { TemplateCard, ProjectCard } from '../components/cards'
import { ScenePreview } from '../components/ScenePreview'
import { Icon } from '../components/Icon'
import type { StudioTemplate } from '../types'

// ── Vibe Motion quick actions (left panel) ────────────────────────────────
const QUICK_ACTIONS: { id: FlowType; seed: any }[] = [
  {
    id: 'presentations',
    seed: { kind: 'hero', palette: ['#8a3ffc', '#a56eff', '#6929c4'], headline: 'Slides', lines: ['Brand Motion'], accent: '#8a3ffc' },
  },
  {
    id: 'text-motion',
    seed: { kind: 'split', palette: ['#ff6b6b', '#ff9f45', '#ffd93d'], headline: 'Title', lines: ['Motion'], accent: '#ff6b6b' },
  },
  {
    id: 'infographics',
    seed: { kind: 'cards', palette: ['#2dd4bf', '#3b82f6', '#6366f1'], headline: 'Data', lines: ['Visual'], accent: '#2dd4bf' },
  },
]

// ── Template cards (right hero area) ─────────────────────────────────────
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
  const [prompt, setPrompt] = useState('')
  const [activeFlow, setActiveFlow] = useState<FlowType>('text-motion')
  const [assistMode, setAssistMode] = useState(true)

  const filtered = cat === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat)
  const useTemplate = (t: StudioTemplate) => nav(`/studio/new?template=${t.id}`)

  const activeConfig = FLOW_CONFIGS[activeFlow]

  const handlePromptSubmit = () => {
    if (prompt.trim()) {
      nav(`/studio/create/${activeFlow}?prompt=${encodeURIComponent(prompt)}`)
    } else {
      nav(`/studio/create/${activeFlow}`)
    }
  }

  const handleSuggestionClick = (s: string) => {
    setPrompt(s)
    // small delay so user sees the prompt populate, then navigate
    setTimeout(() => {
      nav(`/studio/create/${activeFlow}?prompt=${encodeURIComponent(s)}`)
    }, 180)
  }

  const handleQuickActionClick = (id: FlowType) => {
    setActiveFlow(id)
    setPrompt('')
  }

  return (
    <div className="vm-dashboard">
      <style>{`
        .vm-dashboard {
          display: flex;
          height: 100%;
          overflow: hidden;
          background: var(--bg);
        }

        /* ── Left AI panel ── */
        .vm-agent-panel-wrap {
          width: 384px;
          flex: none;
          display: flex;
          align-items: stretch;
          padding: 16px 12px 16px 8px;
        }
        .vm-agent-panel {
          flex: 1;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }

        /* Panel header */
        .vm-panel-header {
          display: flex;
          align-items: center;
          padding: 14px 16px;
          gap: 8px;
          border-bottom: 1px solid var(--border);
          flex: none;
        }
        .vm-panel-title {
          flex: 1;
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
          letter-spacing: 0.01em;
        }
        .vm-panel-icon-btn {
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          border: 1px solid var(--border-strong);
          background: transparent;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--text-3);
          transition: background 0.14s, color 0.14s;
        }
        .vm-panel-icon-btn:hover { background: var(--surface-2); color: var(--text-2); }

        /* Panel body */
        .vm-panel-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 20px 16px 8px;
          gap: 16px;
          min-height: 0;
        }

        /* Welcome text */
        .vm-welcome-sub {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 400;
          color: var(--text-3);
          letter-spacing: 0.01em;
        }
        .vm-welcome-heading {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
          letter-spacing: 0.01em;
          margin-top: 2px;
        }

        /* Action cards */
        .vm-action-cards { display: flex; flex-direction: column; gap: 6px; flex: none; }
        .vm-action-card {
          display: flex;
          align-items: center;
          height: 74px;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.14s, background 0.14s;
        }
        .vm-action-card:hover { border-color: var(--border-strong); background: var(--surface); }
        .vm-action-card.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .vm-action-card-text {
          flex: 1;
          padding: 12px 0 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .vm-action-card-title {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          letter-spacing: 0.02em;
        }
        .vm-action-card.active .vm-action-card-title { color: var(--accent-2); }
        .vm-action-card-desc {
          font-family: var(--font-display);
          font-size: 11.5px;
          color: var(--text-3);
          line-height: 1.4;
        }
        .vm-action-card-thumb {
          width: 96px;
          height: 72px;
          flex: none;
          margin: 4px;
          border-radius: 8px;
          overflow: hidden;
        }

        /* Assist suggestions */
        .vm-assist-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .vm-assist-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--accent-2);
        }
        .vm-suggestion {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          cursor: pointer;
          font-size: 12.5px;
          color: var(--text-2);
          line-height: 1.45;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }
        .vm-suggestion:hover { background: var(--surface-2); border-color: var(--border-strong); color: var(--text); }
        .vm-suggestion-icon { color: var(--text-4); flex: none; margin-top: 1px; }

        /* Prompt area */
        .vm-panel-footer {
          padding: 12px 16px 16px;
          border-top: 1px solid var(--border);
          flex: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .vm-prompt-box {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 0.14s;
        }
        .vm-prompt-box:focus-within { border-color: var(--border-strong); }
        .vm-prompt-input {
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-display);
          font-size: 13.5px;
          font-weight: 400;
          color: var(--text);
          resize: none;
          width: 100%;
          min-height: 20px;
          max-height: 80px;
          line-height: 1.45;
        }
        .vm-prompt-input::placeholder { color: var(--text-4); }
        .vm-prompt-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .vm-prompt-left { display: flex; align-items: center; gap: 6px; }
        .vm-prompt-icon-btn {
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          background: var(--surface-2);
          border: none;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--text-2);
          transition: background 0.14s;
        }
        .vm-prompt-icon-btn:hover { background: var(--surface-3); }
        .vm-prompt-flow-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          height: 24px;
          padding: 0 10px;
          border-radius: 9999px;
          background: var(--accent-soft);
          border: 1px solid rgba(138,63,252,0.3);
          font-size: 11px;
          font-weight: 500;
          color: var(--accent-2);
          letter-spacing: 0.02em;
        }
        .vm-prompt-send {
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          background: var(--accent);
          border: none;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #fff;
          transition: filter 0.14s;
          flex: none;
        }
        .vm-prompt-send:hover { filter: brightness(1.12); }
        .vm-prompt-disclaimer {
          font-size: 11px;
          color: var(--text-4);
          text-align: center;
          letter-spacing: 0.02em;
        }

        /* ── Right content area ── */
        .vm-main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 16px 0 0;
        }
        .vm-main-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 8px 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        /* Hero */
        .vm-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 0 8px;
        }
        .vm-hero-title {
          font-family: var(--font-display);
          font-size: 30px;
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

        /* Template cards */
        .vm-card-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
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
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }
      `}</style>

      {/* ── Left AI panel ── */}
      <div className="vm-agent-panel-wrap">
        <div className="vm-agent-panel">
          {/* Header */}
          <div className="vm-panel-header">
            <span className="vm-panel-title">Vibe Motion</span>
            <button className="vm-panel-icon-btn" title="New session" onClick={() => { setPrompt(''); setActiveFlow('text-motion') }}>
              <Icon name="plus" size={16} />
            </button>
            <button className="vm-panel-icon-btn" title="History">
              <Icon name="assets" size={16} />
            </button>
            <button className="vm-panel-icon-btn" title="Collapse">
              <Icon name="chevDown" size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="vm-panel-body">
            <div>
              <div className="vm-welcome-sub">Welcome to Vibe Motion</div>
              <div className="vm-welcome-heading">Get started with quick actions</div>
            </div>

            {/* Quick action cards */}
            <div className="vm-action-cards">
              {QUICK_ACTIONS.map((qa) => {
                const cfg = FLOW_CONFIGS[qa.id]
                return (
                  <div
                    key={qa.id}
                    className={`vm-action-card${activeFlow === qa.id ? ' active' : ''}`}
                    onClick={() => handleQuickActionClick(qa.id)}
                  >
                    <div className="vm-action-card-text">
                      <div className="vm-action-card-title">{cfg.title}</div>
                      <div className="vm-action-card-desc">{cfg.subtitle}</div>
                    </div>
                    <div className="vm-action-card-thumb">
                      <ScenePreview seed={qa.seed} ratio={96 / 72} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Assist mode — contextual prompt suggestions */}
            {assistMode && (
              <div className="vm-assist-section">
                <div className="vm-assist-label">
                  <Icon name="sparkle" size={11} />
                  Assist · {activeConfig.title}
                </div>
                {activeConfig.assistSuggestions.slice(0, 3).map((s, i) => (
                  <div
                    key={i}
                    className="vm-suggestion"
                    onClick={() => handleSuggestionClick(s)}
                  >
                    <span className="vm-suggestion-icon"><Icon name="arrowRight" size={13} /></span>
                    <span>{s}</span>
                  </div>
                ))}
                <button
                  className="vm-suggestion"
                  style={{ justifyContent: 'center', color: 'var(--text-3)', background: 'transparent', fontSize: 12 }}
                  onClick={() => nav(`/studio/create/${activeFlow}`)}
                >
                  View all ideas <Icon name="arrowRight" size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Prompt footer */}
          <div className="vm-panel-footer">
            <div className="vm-prompt-box">
              <textarea
                className="vm-prompt-input"
                placeholder={activeConfig.promptPlaceholder}
                value={prompt}
                rows={1}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handlePromptSubmit()
                  }
                }}
              />
              <div className="vm-prompt-actions">
                <div className="vm-prompt-left">
                  <button className="vm-prompt-icon-btn" title="Attach media">
                    <Icon name="plus" size={15} />
                  </button>
                  <button className="vm-prompt-icon-btn" title="Upload image">
                    <Icon name="image" size={15} />
                  </button>
                  <div className="vm-prompt-flow-chip">
                    <Icon name="sparkle" size={10} />
                    {activeConfig.title.split(' ')[0]}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="vm-prompt-icon-btn" title="Settings" onClick={() => nav(`/studio/create/${activeFlow}`)}>
                    <Icon name="settings" size={15} />
                  </button>
                  <button className="vm-prompt-send" onClick={handlePromptSubmit}>
                    <Icon name="arrowRight" size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="vm-prompt-disclaimer">ImagineArt can make mistakes. Check important info.</div>
          </div>
        </div>
      </div>

      {/* ── Right main content ── */}
      <div className="vm-main-area">
        <div className="vm-main-scroll">
          {/* Hero */}
          <div className="vm-hero fade-up">
            <h1 className="vm-hero-title">Welcome to Vibe Motion</h1>
            <p className="vm-hero-sub">
              Explore curated templates from Imagine's studios or start creating from scratch.
            </p>
          </div>

          {/* Template card grid */}
          <div>
            <div className="vm-card-row fade-up" style={{ animationDelay: '50ms' }}>
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
          </div>

          {/* Recent projects */}
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
    </div>
  )
}

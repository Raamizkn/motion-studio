import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { FLOW_CONFIGS, PALETTES, defaultConfig } from '../data'
import type { FlowType } from '../data'
import { ScenePreview, ASPECT_RATIO } from '../components/ScenePreview'
import { Icon } from '../components/Icon'

const PALETTE_OPTIONS = [
  { key: 'violet', colors: PALETTES.violet },
  { key: 'ocean', colors: PALETTES.ocean },
  { key: 'sunset', colors: PALETTES.sunset },
  { key: 'lime', colors: PALETTES.lime },
  { key: 'rose', colors: PALETTES.rose },
  { key: 'mono', colors: PALETTES.mono },
]

export function FlowSetup() {
  const nav = useNavigate()
  const { flow } = useParams<{ flow: string }>()
  const [params] = useSearchParams()
  const createProject = useStore((s) => s.createProject)

  const flowId = (flow || 'create-new') as FlowType
  const config = FLOW_CONFIGS[flowId] || FLOW_CONFIGS['create-new']

  const initialPrompt = params.get('prompt') || ''
  const [prompt, setPrompt] = useState(initialPrompt)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    config.quickFields.forEach((f) => { if (f.defaultValue) defaults[f.id] = f.defaultValue })
    return defaults
  })
  const [palette, setPalette] = useState(config.palette)
  const [generating, setGenerating] = useState(false)

  // reset state when flow changes
  useEffect(() => {
    const defaults: Record<string, string> = {}
    config.quickFields.forEach((f) => { if (f.defaultValue) defaults[f.id] = f.defaultValue })
    setFieldValues(defaults)
    setPalette(config.palette)
  }, [flowId])

  const setField = (id: string, val: string) => setFieldValues((v) => ({ ...v, [id]: val }))

  const buildPrompt = () => {
    const parts: string[] = []
    if (prompt.trim()) parts.push(prompt.trim())
    config.quickFields.forEach((f) => {
      const val = fieldValues[f.id]
      if (val && val !== f.defaultValue) parts.push(`${f.label}: ${val}`)
    })
    if (parts.length === 0) return config.assistSuggestions[0]
    return parts.join('. ')
  }

  const onGenerate = () => {
    setGenerating(true)
    const finalPrompt = buildPrompt()
    const slidesField = fieldValues['slides']
    const durationSec = slidesField ? parseInt(slidesField) * 5 : config.durationSec
    const aspectOverride = (fieldValues['format'] as any) || config.aspect

    const project = createProject(
      prompt.trim() || config.title,
      defaultConfig({
        prompt: finalPrompt,
        palette,
        aspect: aspectOverride,
        durationSec,
        transition: config.transition,
        model: 'standard',
      }),
    )
    nav(`/studio/projects/${project.id}/storyboard?fresh=1&flow=${flowId}`)
  }

  const seed = {
    kind: 'hero' as const,
    palette,
    headline: prompt.trim() ? prompt.slice(0, 24) : config.title,
    lines: [config.subtitle],
    accent: palette[0],
  }

  return (
    <div className="flow-setup">
      <style>{`
        .flow-setup {
          display: flex;
          height: 100%;
          background: var(--bg);
          overflow: hidden;
        }

        /* ── Left form panel ── */
        .fs-form-panel {
          width: 480px;
          flex: none;
          height: 100%;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
          background: var(--bg-elev);
        }

        .fs-header {
          padding: 24px 24px 20px;
          border-bottom: 1px solid var(--border);
          flex: none;
        }
        .fs-back {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--text-3);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-bottom: 16px;
          transition: color 0.14s;
        }
        .fs-back:hover { color: var(--text-2); }

        .fs-title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 600;
          color: var(--text);
          letter-spacing: -0.01em;
        }
        .fs-subtitle {
          font-size: 13px;
          color: var(--text-3);
          margin-top: 4px;
        }

        .fs-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Field styles */
        .fs-field {}
        .fs-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-2);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .fs-textarea {
          width: 100%;
          min-height: 90px;
          resize: vertical;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 12px 14px;
          font-size: 14px;
          line-height: 1.5;
          color: var(--text);
          font-family: var(--font);
          outline: none;
          transition: border-color 0.14s;
        }
        .fs-textarea:focus { border-color: var(--border-strong); }
        .fs-textarea::placeholder { color: var(--text-4); }
        .fs-input {
          width: 100%;
          height: 42px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 0 14px;
          font-size: 14px;
          color: var(--text);
          font-family: var(--font);
          outline: none;
          transition: border-color 0.14s;
        }
        .fs-input:focus { border-color: var(--border-strong); }
        .fs-input::placeholder { color: var(--text-4); }

        .fs-radio-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .fs-radio {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 14px;
          border-radius: var(--r-pill);
          border: 1px solid var(--border);
          background: var(--surface);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-2);
          transition: all 0.14s;
        }
        .fs-radio:hover { border-color: var(--border-strong); color: var(--text); }
        .fs-radio.selected {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent-2);
        }

        /* Assist suggestions */
        .fs-assist {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          overflow: hidden;
        }
        .fs-assist-header {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-2);
          letter-spacing: 0.02em;
        }
        .fs-suggestion {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: var(--text-2);
          cursor: pointer;
          border-bottom: 1px solid var(--border-faint);
          transition: background 0.12s, color 0.12s;
          line-height: 1.4;
        }
        .fs-suggestion:last-child { border-bottom: none; }
        .fs-suggestion:hover { background: var(--surface-2); color: var(--text); }
        .fs-suggestion-arrow {
          color: var(--text-4);
          flex: none;
          margin-left: auto;
        }

        /* Palette */
        .fs-palette-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .fs-palette-swatch {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          cursor: pointer;
          border: 2px solid transparent;
          transition: border-color 0.14s, transform 0.14s;
          flex: none;
        }
        .fs-palette-swatch:hover { transform: scale(1.08); }
        .fs-palette-swatch.active { border-color: #fff; }

        /* Footer */
        .fs-footer {
          padding: 16px 24px 24px;
          border-top: 1px solid var(--border);
          flex: none;
        }
        .fs-generate-btn {
          width: 100%;
          height: 48px;
          background: var(--accent-grad);
          border: none;
          border-radius: var(--r-md);
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 18px var(--accent-glow);
          transition: filter 0.14s, transform 0.1s;
          letter-spacing: 0.02em;
        }
        .fs-generate-btn:hover { filter: brightness(1.1); }
        .fs-generate-btn:active { transform: translateY(1px); }
        .fs-generate-btn:disabled { opacity: 0.6; pointer-events: none; }

        /* ── Right preview ── */
        .fs-preview {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 40px;
          background: var(--bg);
        }
        .fs-preview-card {
          width: 100%;
          max-width: 600px;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
          border: 1px solid var(--border-strong);
        }
        .fs-preview-meta {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          max-width: 600px;
        }
        .fs-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 12px;
          font-size: 13px;
        }
        .fs-meta-label { color: var(--text-3); }
        .fs-meta-value { font-weight: 600; color: var(--text-2); text-transform: capitalize; }
      `}</style>

      {/* ── Left: form ── */}
      <div className="fs-form-panel">
        <div className="fs-header">
          <button className="fs-back" onClick={() => nav('/studio')}>
            <Icon name="arrowLeft" size={15} /> Back
          </button>
          <div className="fs-title">{config.title}</div>
          <div className="fs-subtitle">{config.subtitle}</div>
        </div>

        <div className="fs-body">
          {/* Main prompt */}
          <div className="fs-field">
            <label className="fs-label">Describe your {config.id === 'text-motion' ? 'animation' : config.id === 'infographics' ? 'infographic' : 'video'}</label>
            <textarea
              className="fs-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={config.promptPlaceholder}
              rows={4}
            />
          </div>

          {/* Flow-specific quick fields */}
          {config.quickFields.slice(1).map((field) => (
            <div key={field.id} className="fs-field">
              <label className="fs-label">{field.label}</label>
              {field.type === 'radio' && field.options && (
                <div className="fs-radio-group">
                  {field.options.map((opt) => (
                    <button
                      key={opt.value}
                      className={`fs-radio${fieldValues[field.id] === opt.value ? ' selected' : ''}`}
                      onClick={() => setField(field.id, opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {field.type === 'text' && (
                <input
                  className="fs-input"
                  value={fieldValues[field.id] || ''}
                  onChange={(e) => setField(field.id, e.target.value)}
                  placeholder={field.placeholder}
                />
              )}
              {field.type === 'textarea' && (
                <textarea
                  className="fs-textarea"
                  value={fieldValues[field.id] || ''}
                  onChange={(e) => setField(field.id, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                />
              )}
            </div>
          ))}

          {/* Color palette */}
          <div className="fs-field">
            <label className="fs-label">Color palette</label>
            <div className="fs-palette-row">
              {PALETTE_OPTIONS.map((p) => (
                <div
                  key={p.key}
                  className={`fs-palette-swatch${palette === p.colors ? ' active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }}
                  onClick={() => setPalette(p.colors)}
                  title={p.key}
                />
              ))}
            </div>
          </div>

          {/* Assist suggestions */}
          <div className="fs-field">
            <label className="fs-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="sparkle" size={12} style={{ color: 'var(--accent-2)' }} />
              Assist — prompt ideas
            </label>
            <div className="fs-assist">
              <div className="fs-assist-header">
                <Icon name="sparkle" size={13} />
                Tap a suggestion to use it
              </div>
              {config.assistSuggestions.map((s, i) => (
                <div key={i} className="fs-suggestion" onClick={() => setPrompt(s)}>
                  <span style={{ flex: 1 }}>{s}</span>
                  <span className="fs-suggestion-arrow"><Icon name="arrowRight" size={14} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fs-footer">
          <button
            className="fs-generate-btn"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating
              ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Generating storyboard…</>
              : <><Icon name="sparkle" size={17} /> Generate Storyboard</>
            }
          </button>
        </div>
      </div>

      {/* ── Right: live preview ── */}
      <div className="fs-preview">
        <div className="fs-preview-card">
          <ScenePreview seed={seed} ratio={ASPECT_RATIO[config.aspect]} />
        </div>

        <div className="fs-preview-meta">
          <div className="fs-meta-row">
            <span className="fs-meta-label">Format</span>
            <span className="fs-meta-value">{fieldValues['format'] || config.aspect} · {config.durationSec}s</span>
          </div>
          <div className="fs-meta-row">
            <span className="fs-meta-label">Transition</span>
            <span className="fs-meta-value">{config.transition}</span>
          </div>
          <div className="fs-meta-row">
            <span className="fs-meta-label">Engine</span>
            <span className="fs-meta-value">Kinetic Standard</span>
          </div>
        </div>
      </div>
    </div>
  )
}

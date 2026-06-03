import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { FLOW_CONFIGS, PALETTES, defaultConfig, BUILTIN_THEMES, TEMPLATES } from '../data'
import type { FlowType } from '../data'
import type { AspectRatio } from '../types'
import { ASPECT_RATIO } from '../components/ScenePreview'
import { TemplatePreview } from '../components/cards'
import { Icon } from '../components/Icon'
import { ThemePicker } from '../components/ThemeStudio'
import { narrationVoices } from '../ai'
import type { VoiceAvatar } from '../ai'

const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9 · Landscape' },
  { value: '9:16', label: '9:16 · Vertical' },
  { value: '1:1', label: '1:1 · Square' },
  { value: '4:5', label: '4:5 · Feed' },
]
const DURATIONS = [15, 30, 45, 60]
const VOICE_STYLES = [
  { value: 'warm', label: 'Warm narrator' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'calm', label: 'Calm & cinematic' },
  { value: 'confident', label: 'Confident promo' },
]

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

  // a template seeds the config the user then tweaks before generating
  const tpl = TEMPLATES.find((t) => t.id === params.get('template'))
  const initialPrompt = params.get('prompt') || tpl?.brief || (tpl ? `${tpl.name}. ${tpl.description}` : '')
  const [prompt, setPrompt] = useState(initialPrompt)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {}
    config.quickFields.forEach((f) => { if (f.defaultValue) defaults[f.id] = f.defaultValue })
    return defaults
  })
  const [palette, setPalette] = useState(tpl?.config.palette || config.palette)
  const [themeId, setThemeId] = useState<string>(tpl?.themeId || '')
  const [themePopOpen, setThemePopOpen] = useState(false)
  const userThemes = useStore((s) => s.userThemes)
  const [aspect, setAspect] = useState<AspectRatio>(tpl?.aspect || config.aspect)
  const [durationSec, setDurationSec] = useState<number>(tpl?.durationSec || config.durationSec)
  const [voiceover, setVoiceover] = useState(false)
  const [voiceStyle, setVoiceStyle] = useState('warm')
  const [voices, setVoices] = useState<VoiceAvatar[]>([])
  const [voiceId, setVoiceId] = useState('')
  const [previewVoice, setPreviewVoice] = useState<string | null>(null)
  const previewAudio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    let alive = true
    narrationVoices().then((c) => {
      if (!alive) return
      setVoices(c.voices)
      setVoiceId((cur) => cur || c.voices[0]?.id || c.defaultVoiceId)
    })
    return () => { alive = false; previewAudio.current?.pause() }
  }, [])

  const playPreview = (v: VoiceAvatar) => {
    if (!v.previewUrl) return
    const a = previewAudio.current || (previewAudio.current = new Audio())
    if (previewVoice === v.id) { a.pause(); setPreviewVoice(null); return }
    a.src = v.previewUrl
    a.onended = () => setPreviewVoice(null)
    a.play().then(() => setPreviewVoice(v.id)).catch(() => setPreviewVoice(null))
  }
  const [assets, setAssets] = useState<{ id: string; name: string; type: string; dataUrl: string }[]>([])
  const [generating, setGenerating] = useState(false)

  const ingestFiles = (files: File[]) => {
    files.forEach((f) => {
      const reader = new FileReader()
      reader.onload = () =>
        setAssets((a) => [...a, { id: Math.random().toString(36).slice(2), name: f.name, type: f.type, dataUrl: String(reader.result) }])
      reader.readAsDataURL(f)
    })
  }

  // reset state when the flow changes — but never clobber a template's prefill on mount
  const flowMounted = useRef(false)
  useEffect(() => {
    if (!flowMounted.current) { flowMounted.current = true; return }
    const defaults: Record<string, string> = {}
    config.quickFields.forEach((f) => { if (f.defaultValue) defaults[f.id] = f.defaultValue })
    setFieldValues(defaults)
    setPalette(config.palette)
    setAspect(config.aspect)
    setDurationSec(config.durationSec)
  }, [flowId])

  // when a theme is chosen, adopt its accent colors for the live preview
  useEffect(() => {
    const t = BUILTIN_THEMES.find((x) => x.id === themeId)
    if (t) {
      const c = t.colors
      setPalette([c.primary, c.secondary, c.tertiary || c.accent || c.secondary].filter(Boolean) as string[])
    }
  }, [themeId])

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

    const project = createProject(
      prompt.trim() || config.title,
      defaultConfig({
        prompt: finalPrompt,
        palette,
        aspect,
        durationSec,
        transition: config.transition,
        model: 'standard',
        flow: flowId,
        themeId: themeId || undefined,
        voiceover: voiceover ? { enabled: true, style: voiceStyle, voiceId: voiceId || undefined } : undefined,
        assets: assets.length ? assets : undefined,
        assetIds: assets.map((a) => a.id),
      }),
    )
    nav(`/studio/projects/${project.id}/generate`)
  }

  // pick the preview register: an explicit template wins, else map the chosen
  // theme's register string, else default to the dark product look.
  const themeReg = BUILTIN_THEMES.find((t) => t.id === themeId)?.register || ''
  const mapReg = (s: string): 'editorial' | 'product' | 'bold' | 'minimal' => {
    const t = s.toLowerCase()
    if (t.includes('editorial') || t.includes('institutional')) return 'editorial'
    if (t.includes('minimal') || t.includes('luxury')) return 'minimal'
    if (t.includes('playful') || t.includes('consumer') || t.includes('bold')) return 'bold'
    return 'product'
  }
  const previewRegister = (tpl?.register as any) || mapReg(themeReg)

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

        /* Voice avatar cards (not thin buttons) */
        .fs-sublabel {
          font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--text-4); margin: 14px 0 8px;
        }
        .fs-voice-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
        }
        .fs-voice-card {
          text-align: center; display: flex; flex-direction: column; align-items: center; gap: 7px;
          padding: 14px 10px 12px; border-radius: 16px;
          border: 1px solid var(--border); background: var(--surface);
          cursor: pointer; transition: border-color .14s, background .14s, transform .14s;
        }
        .fs-voice-card:hover { border-color: var(--border-strong); transform: translateY(-2px); }
        .fs-voice-card.selected { border-color: var(--accent); background: var(--accent-soft); box-shadow: 0 0 0 1px var(--accent) inset; }
        .fs-voice-orb {
          position: relative; width: 64px; height: 64px; border-radius: 50%; border: none; padding: 0;
          cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.35); transition: transform .14s;
          filter: saturate(1.05);
        }
        .fs-voice-orb:hover { transform: scale(1.06); }
        .fs-voice-play {
          position: absolute; inset: 0; display: grid; place-items: center; color: #fff;
          opacity: 0; transition: opacity .14s; background: rgba(0,0,0,.28); border-radius: 50%;
        }
        .fs-voice-orb:hover .fs-voice-play, .fs-voice-card.selected .fs-voice-play { opacity: 1; }
        .fs-voice-name { font-size: 13px; font-weight: 650; color: var(--text); }
        .fs-voice-desc { font-size: 10.5px; line-height: 1.35; color: var(--text-3); }
        .fs-wrap { flex-wrap: wrap; }

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

          {/* Theme — brand design system Claude composes from */}
          <div className="fs-field" style={{ position: 'relative' }}>
            <label className="fs-label">Theme</label>
            <div className="fs-radio-group">
              <button
                className={`fs-radio${themeId === '' ? ' selected' : ''}`}
                onClick={() => setThemeId('')}
              >
                Auto (from prompt)
              </button>
              {(() => {
                const sel = [...userThemes, ...BUILTIN_THEMES].find((t) => t.id === themeId)
                return sel ? (
                  <button className="fs-radio selected" onClick={() => setThemePopOpen((o) => !o)}>
                    <span style={{ display: 'inline-flex', gap: 3, marginRight: 2 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: sel.colors.primary, border: '1px solid rgba(255,255,255,.25)' }} />
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: sel.colors.secondary }} />
                      {sel.colors.accent && <span style={{ width: 9, height: 9, borderRadius: 3, background: sel.colors.accent }} />}
                    </span>
                    {sel.name}
                  </button>
                ) : null
              })()}
              <button className="fs-radio" onClick={() => setThemePopOpen((o) => !o)}>
                <Icon name="plus" size={13} /> Browse / Create theme
              </button>
            </div>
            {themePopOpen && (
              <div style={{ position: 'absolute', zIndex: 60, top: '100%', left: 0, marginTop: 8 }}>
                <ThemePicker selectedId={themeId} onSelect={setThemeId} onClose={() => setThemePopOpen(false)} />
              </div>
            )}
          </div>

          {/* Format / aspect ratio */}
          <div className="fs-field">
            <label className="fs-label">Format</label>
            <div className="fs-radio-group">
              {ASPECTS.map((a) => (
                <button
                  key={a.value}
                  className={`fs-radio${aspect === a.value ? ' selected' : ''}`}
                  onClick={() => setAspect(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="fs-field">
            <label className="fs-label">Duration</label>
            <div className="fs-radio-group">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  className={`fs-radio${durationSec === d ? ' selected' : ''}`}
                  onClick={() => setDurationSec(d)}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Voiceover */}
          <div className="fs-field">
            <label className="fs-label">Voiceover</label>
            <div className="fs-radio-group">
              <button className={`fs-radio${!voiceover ? ' selected' : ''}`} onClick={() => setVoiceover(false)}>
                None
              </button>
              <button className={`fs-radio${voiceover ? ' selected' : ''}`} onClick={() => setVoiceover(true)}>
                <Icon name="sparkle" size={13} /> Generate narration
              </button>
            </div>
            {voiceover && (
              <>
                {/* Voice avatars — pick who reads the narration; tap the orb to preview */}
                <div className="fs-sublabel">Voice</div>
                <div className="fs-voice-grid">
                  {voices.map((v) => {
                    const g = v.gradient || ['#8a3ffc', '#2dd4bf']
                    const playing = previewVoice === v.id
                    return (
                      <div
                        key={v.id}
                        className={`fs-voice-card${voiceId === v.id ? ' selected' : ''}`}
                        onClick={() => setVoiceId(v.id)}
                      >
                        <button
                          type="button"
                          className="fs-voice-orb"
                          style={{ background: `radial-gradient(circle at 32% 28%, ${g[0]}, ${g[1]} 78%)` }}
                          onClick={(e) => { e.stopPropagation(); playPreview(v) }}
                          aria-label={`Preview ${v.name}`}
                        >
                          <span className="fs-voice-play">
                            <Icon name={playing ? 'pause' : 'play'} size={18} />
                          </span>
                        </button>
                        <div className="fs-voice-name">{v.name}</div>
                        <div className="fs-voice-desc">{v.description}</div>
                      </div>
                    )
                  })}
                </div>
                {/* Delivery style — adjusts how the chosen voice reads */}
                <div className="fs-sublabel">Delivery</div>
                <div className="fs-radio-group fs-wrap">
                  {VOICE_STYLES.map((v) => (
                    <button
                      key={v.value}
                      className={`fs-radio${voiceStyle === v.value ? ' selected' : ''}`}
                      onClick={() => setVoiceStyle(v.value)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Media (optional) */}
          <div className="fs-field">
            <label className="fs-label">Media <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-4)' }}>(optional)</span></label>
            <label
              className="fs-input"
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-3)' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); ingestFiles(Array.from(e.dataTransfer.files)) }}
            >
              <Icon name="image" size={15} />
              {assets.length ? `${assets.length} file${assets.length === 1 ? '' : 's'} added` : 'Upload images to feature in the video'}
              <input type="file" multiple accept="image/*" hidden onChange={(e) => ingestFiles(Array.from(e.target.files || []))} />
            </label>
            {assets.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {assets.map((a) => (
                  <div key={a.id} style={{ position: 'relative' }}>
                    <img src={a.dataUrl} alt={a.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                    <button
                      onClick={() => setAssets((arr) => arr.filter((x) => x.id !== a.id))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 99, background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', color: 'var(--text-2)', display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 11 }}
                      aria-label="Remove"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Flow-specific quick fields (excluding format/duration we now own) */}
          {config.quickFields.slice(1).filter((f) => f.id !== 'format' && f.id !== 'slides').map((field) => (
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
              ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Starting…</>
              : <><Icon name="sparkle" size={17} /> Generate Video</>
            }
          </button>
        </div>
      </div>

      {/* ── Right: live preview ── */}
      <div className="fs-preview">
        <div className="fs-preview-card">
          <TemplatePreview register={previewRegister} palette={palette} kicker={config.title} title={prompt.trim() ? prompt.slice(0, 32) : config.subtitle} ratio={ASPECT_RATIO[aspect]} />
        </div>

        <div className="fs-preview-meta">
          <div className="fs-meta-row">
            <span className="fs-meta-label">Format</span>
            <span className="fs-meta-value">{aspect} · {durationSec}s</span>
          </div>
          <div className="fs-meta-row">
            <span className="fs-meta-label">Theme</span>
            <span className="fs-meta-value">{BUILTIN_THEMES.find((t) => t.id === themeId)?.name || 'Auto'}</span>
          </div>
          <div className="fs-meta-row">
            <span className="fs-meta-label">Voiceover</span>
            <span className="fs-meta-value">{voiceover ? voiceStyle : 'None'}</span>
          </div>
          <div className="fs-meta-row">
            <span className="fs-meta-label">Engine</span>
            <span className="fs-meta-value">Claude · Hyperframes</span>
          </div>
        </div>
      </div>
    </div>
  )
}

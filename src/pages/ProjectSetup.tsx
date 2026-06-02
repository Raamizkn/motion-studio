import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  MODELS,
  TRANSITIONS,
  PALETTES,
  scrapeWebsite,
  defaultConfig,
} from '../data'
import type { AspectRatio, VideoProjectConfig, TransitionKind, ModelTier } from '../types'
import { Icon } from '../components/Icon'
import { Segmented } from '../components/shared'
import { TemplateCard } from '../components/cards'
import { TransitionTile } from '../components/TransitionTile'
import { ScenePreview, ASPECT_RATIO } from '../components/ScenePreview'

const ASPECTS: { id: AspectRatio; w: number; h: number; label: string }[] = [
  { id: '16:9', w: 26, h: 15, label: 'Landscape' },
  { id: '9:16', w: 15, h: 26, label: 'Portrait' },
  { id: '1:1', w: 20, h: 20, label: 'Square' },
  { id: '4:5', w: 18, h: 22, label: 'Feed' },
]

export function ProjectSetup() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const createProject = useStore((s) => s.createProject)

  const [tab, setTab] = useState<'custom' | 'templates'>(params.get('tab') === 'templates' ? 'templates' : 'custom')
  const [cfg, setCfg] = useState<VideoProjectConfig>(() => defaultConfig())
  const [usingTpl, setUsingTpl] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeErr, setScrapeErr] = useState(false)
  const [assets, setAssets] = useState<{ id: string; name: string }[]>([])
  const [cat, setCat] = useState('All')

  const set = (patch: Partial<VideoProjectConfig>) => setCfg((c) => ({ ...c, ...patch }))

  // Prefill from ?template=
  useEffect(() => {
    const tid = params.get('template')
    if (!tid) return
    const t = TEMPLATES.find((x) => x.id === tid)
    if (!t) return
    setUsingTpl(t.id)
    setTab('custom')
    setCfg(
      defaultConfig({
        ...t.config,
        templateId: t.id,
        prompt: `${t.name}: ${t.description}`,
        palette: t.config.palette || PALETTES.violet,
      }),
    )
  }, [params])

  const onScrape = () => {
    if (!url.trim()) return
    setScraping(true)
    setScrapeErr(false)
    setTimeout(() => {
      if (url.includes(' ') || url.length < 4) {
        setScrapeErr(true)
        setScraping(false)
        return
      }
      const data = scrapeWebsite(url)
      set({ websiteUrl: url, brand: { ...data, colors: data.colors }, palette: data.colors, prompt: cfg.prompt || `A 30s brand video for ${data.title}` })
      setScraping(false)
    }, 1100)
  }

  const onGenerate = () => {
    const name = cfg.brand?.title ? `${cfg.brand.title} video` : cfg.prompt.slice(0, 32) || 'Untitled video'
    const project = createProject(name, { ...cfg, assetIds: assets.map((a) => a.id) })
    nav(`/studio/projects/${project.id}/storyboard?fresh=1`)
  }

  const filteredTpl = cat === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === cat)
  const model = MODELS.find((m) => m.id === cfg.model)!

  return (
    <div style={{ padding: '24px 36px 60px', maxWidth: 1240, margin: '0 auto' }}>
      <button className="btn ghost sm" onClick={() => nav('/studio')} style={{ marginBottom: 14 }}>
        <Icon name="arrowLeft" size={15} /> Back to Studio
      </button>

      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>New Video</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, margin: '18px 0 22px', borderBottom: '1px solid var(--border)' }}>
        {(['custom', 'templates'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 4px',
              marginRight: 22,
              fontSize: 14,
              fontWeight: 600,
              color: tab === t ? 'var(--text)' : 'var(--text-3)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t === 'custom' ? 'Custom Video' : 'Templates'}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <>
          <div style={{ display: 'flex', gap: 7, marginBottom: 18 }}>
            {TEMPLATE_CATEGORIES.map((c) => (
              <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {filteredTpl.map((t) => (
              <TemplateCard
                key={t.id}
                tpl={t}
                onUse={(tpl) => {
                  setUsingTpl(tpl.id)
                  setTab('custom')
                  setCfg(defaultConfig({ ...tpl.config, templateId: tpl.id, prompt: `${tpl.name}: ${tpl.description}`, palette: tpl.config.palette || PALETTES.violet }))
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>
          {/* LEFT — form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {usingTpl && (
              <div className="chip active" style={{ alignSelf: 'flex-start', height: 30 }}>
                Using template: {TEMPLATES.find((t) => t.id === usingTpl)?.name}
                <button onClick={() => { setUsingTpl(null); setCfg(defaultConfig()) }} aria-label="Clear template" style={{ display: 'flex' }}>
                  <Icon name="close" size={13} />
                </button>
              </div>
            )}

            {/* Prompt */}
            <div>
              <label style={lbl}>Describe your video</label>
              <textarea
                value={cfg.prompt}
                onChange={(e) => set({ prompt: e.target.value })}
                placeholder="e.g. A punchy 30-second launch video for our new AI note-taking app, upbeat and modern…"
                style={{
                  width: '100%',
                  minHeight: 110,
                  resize: 'vertical',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: 14,
                  fontSize: 14,
                  lineHeight: 1.5,
                  outline: 'none',
                }}
              />
              {/* URL attach */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '0 12px', height: 40 }}>
                    <Icon name="globe" size={16} style={{ color: 'var(--text-3)' }} />
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onScrape()}
                      placeholder="Attach a website to extract brand content…"
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13.5 }}
                    />
                  </div>
                  <button className="btn" onClick={onScrape} disabled={scraping}>
                    {scraping ? <span className="spinner" /> : <Icon name="arrowRight" size={15} />}
                  </button>
                </div>
                {scrapeErr && <p style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 7 }}>Couldn't scrape this URL — try a different one.</p>}
                {cfg.brand && (
                  <div className="card fade-up" style={{ marginTop: 10, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 64, height: 40, borderRadius: 8, background: `linear-gradient(135deg, ${cfg.brand.colors[0]}, ${cfg.brand.colors[1]})`, flex: 'none' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{cfg.brand.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{cfg.brand.description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {cfg.brand.colors.map((c) => (
                        <button key={c} onClick={() => set({ palette: [c, ...cfg.brand!.colors.filter((x) => x !== c)] })} title={c} style={{ width: 20, height: 20, borderRadius: 6, background: c, border: cfg.palette[0] === c ? '2px solid #fff' : '1px solid var(--border)' }} />
                      ))}
                    </div>
                    <span className="chip" style={{ background: 'var(--lime-soft)', color: 'var(--lime)', borderColor: 'transparent', cursor: 'default' }}>
                      <Icon name="check" size={13} /> Brand extracted
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Model selector */}
            <div>
              <label style={lbl}>Engine</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => set({ model: m.id })}
                    className="card"
                    style={{
                      padding: 13,
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderColor: cfg.model === m.id ? 'var(--accent)' : 'var(--border)',
                      background: cfg.model === m.id ? 'var(--accent-soft)' : 'var(--surface)',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                      <span className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>{m.tier}</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 5 }}>{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced settings */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <button
                onClick={() => setAdvanced((a) => !a)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '13px 15px', fontWeight: 600, fontSize: 13.5 }}
              >
                <Icon name="settings" size={16} style={{ color: 'var(--text-3)' }} />
                Advanced settings
                <Icon name="chevDown" size={16} style={{ marginLeft: 'auto', color: 'var(--text-3)', transform: advanced ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {advanced && (
                <div className="fade-up" style={{ padding: '0 15px 16px', display: 'flex', flexDirection: 'column', gap: 18, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  {/* Aspect */}
                  <Row label="Aspect ratio">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {ASPECTS.map((a) => (
                        <button key={a.id} onClick={() => set({ aspect: a.id })} title={a.label} style={{ display: 'grid', placeItems: 'center', gap: 6, padding: 8, borderRadius: 9, border: cfg.aspect === a.id ? '1px solid var(--accent)' : '1px solid var(--border)', background: cfg.aspect === a.id ? 'var(--accent-soft)' : 'var(--surface)', width: 56 }}>
                          <div style={{ width: a.w, height: a.h, borderRadius: 3, background: cfg.aspect === a.id ? 'var(--accent-2)' : 'var(--surface-3)' }} />
                          <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{a.id}</span>
                        </button>
                      ))}
                    </div>
                  </Row>
                  <Row label="Duration">
                    <Segmented
                      value={String(cfg.durationSec)}
                      onChange={(v) => set({ durationSec: Number(v) })}
                      options={[10, 15, 30, 60].map((d) => ({ value: String(d), label: `${d}s` }))}
                    />
                  </Row>
                  <Row label="Frame rate">
                    <Segmented value={String(cfg.fps)} onChange={(v) => set({ fps: Number(v) as 24 | 30 | 60 })} options={[24, 30, 60].map((f) => ({ value: String(f), label: `${f}fps` }))} />
                  </Row>
                  <Row label="Quality">
                    <Segmented value={cfg.quality} onChange={(v) => set({ quality: v })} options={[{ value: 'draft', label: 'Draft' }, { value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }, { value: 'cinema', label: 'Cinema' }] as any} />
                  </Row>
                  <Row label="Transition">
                    <div style={{ display: 'flex', gap: 9 }}>
                      {TRANSITIONS.map((t) => (
                        <TransitionTile key={t.id} kind={t.id as TransitionKind} label={t.label} active={cfg.transition === t.id} onClick={() => set({ transition: t.id as TransitionKind })} />
                      ))}
                    </div>
                  </Row>
                </div>
              )}
            </div>

            {/* Asset upload */}
            <div>
              <label style={lbl}>Brand assets</label>
              <label
                style={{ display: 'grid', placeItems: 'center', gap: 6, padding: '22px', border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--r-md)', cursor: 'pointer', color: 'var(--text-3)', background: 'var(--surface)' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const files = Array.from(e.dataTransfer.files)
                  setAssets((a) => [...a, ...files.map((f) => ({ id: Math.random().toString(36), name: f.name }))])
                }}
              >
                <Icon name="upload" size={22} />
                <span style={{ fontSize: 13 }}>Drop brand assets — logos, images, clips, SVGs</span>
                <input type="file" multiple hidden onChange={(e) => setAssets((a) => [...a, ...Array.from(e.target.files || []).map((f) => ({ id: Math.random().toString(36), name: f.name }))])} />
              </label>
              {assets.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {assets.map((a) => (
                    <span key={a.id} className="chip" style={{ cursor: 'default' }}>
                      <Icon name="image" size={13} /> {a.name.slice(0, 18)}
                      <button onClick={() => setAssets((x) => x.filter((y) => y.id !== a.id))} aria-label="Remove" style={{ display: 'flex' }}>
                        <Icon name="close" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button className="btn primary" onClick={onGenerate} disabled={!cfg.prompt.trim()} style={{ height: 46, fontSize: 14.5, justifyContent: 'center' }}>
              <Icon name="sparkle" size={17} /> Generate Storyboard
            </button>
          </div>

          {/* RIGHT — live summary */}
          <SummaryPanel cfg={cfg} model={model} assets={assets.length} />
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 9 }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
      {children}
    </div>
  )
}

function SummaryPanel({ cfg, model, assets }: { cfg: VideoProjectConfig; model: { name: string; render: string }; assets: number }) {
  const seed = useMemo(
    () => ({ kind: 'hero' as const, palette: cfg.palette, headline: cfg.brand?.title ? `*${cfg.brand.title}*` : 'Your *video*', lines: ['Live preview', 'New'], accent: cfg.palette[0] }),
    [cfg.palette, cfg.brand],
  )
  return (
    <div className="card" style={{ padding: 16, position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Live preview</div>
      <ScenePreview seed={seed} ratio={ASPECT_RATIO[cfg.aspect]} rounded={12} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13 }}>
        <Stat k="Engine" v={model.name} />
        <Stat k="Format" v={cfg.aspect} />
        <Stat k="Duration" v={`${cfg.durationSec}s`} />
        <Stat k="Quality" v={cfg.quality} />
        <Stat k="Transition" v={cfg.transition} />
        <Stat k="Assets" v={String(assets)} />
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        <Stat k="Est. render" v={model.render} accent />
      </div>
    </div>
  )
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-3)' }}>{k}</span>
      <span style={{ fontWeight: 600, textTransform: 'capitalize', color: accent ? 'var(--accent-2)' : 'var(--text)' }}>{v}</span>
    </div>
  )
}

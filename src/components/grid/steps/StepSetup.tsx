import { useRef, useState } from 'react'
import type { Draft } from '../wizard'
import { ingestProductFiles, themeToBrand, registerForBrand } from '../wizard'
import type { UseCase, GridAspect } from '../../../spec'
import { USE_CASES } from '../../../spec'
import { Icon } from '../../Icon'
import { TemplatePreview } from '../../cards'
import { ThemeModal } from '../../ThemeStudio'
import { useStore } from '../../../store'
import { BUILTIN_THEMES } from '../../../data'

type PReg = 'editorial' | 'product' | 'bold' | 'minimal' | 'infographic' | 'poster' | 'presentation'

// graphic sample per style (use case) for its card thumbnail
const STYLE_GFX: Record<UseCase, { register: PReg; title: string; kicker: string; palette: string[] }> = {
  saas_explainer: { register: 'product', title: 'Ship faster', kicker: 'SaaS', palette: ['#8a3ffc', '#4e7bff'] },
  physical_ad: { register: 'poster', title: 'The drop is here', kicker: 'Ad', palette: ['#ec4899', '#8a3ffc'] },
  pitch: { register: 'presentation', title: 'Q3 in review', kicker: 'Pitch', palette: ['#3b82f6', '#8a3ffc'] },
  app_launch: { register: 'product', title: 'Your day, organized', kicker: 'App', palette: ['#2dd4bf', '#3b82f6'] },
  brand_manifesto: { register: 'bold', title: 'We believe', kicker: 'Brand', palette: ['#ff6b6b', '#ff9f45'] },
}

const ASPECTS: { value: GridAspect; label: string }[] = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
]
const DURATIONS = [8, 10, 15, 20, 30]

export function StepSetup({ draft, update, onPickStyle }: { draft: Draft; update: (patch: Partial<Draft>) => void; onPickStyle: (u: UseCase) => void }) {
  const userThemes = useStore((s) => s.userThemes)
  const allThemes = [...userThemes, ...BUILTIN_THEMES]
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    const images = await ingestProductFiles(files, draft.product.images)
    update({ product: { ...draft.product, images, assetIds: images.map((i) => i.id) } })
    setBusy(false)
  }
  const removeImage = (id: string) => {
    const images = draft.product.images.filter((i) => i.id !== id)
    update({ product: { ...draft.product, images, assetIds: images.map((i) => i.id) } })
  }

  const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
        {hint && <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26 }}>
      <style>{`
        .st-cardgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 12px; }
        .st-card { position: relative; padding: 0; border-radius: 14px; overflow: hidden; border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; transition: border-color .14s, transform .12s; text-align: left; }
        .st-card:hover { border-color: var(--border-strong); transform: translateY(-2px); }
        .st-card.sel { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .st-card-cap { padding: 9px 11px; }
        .st-card-name { font-size: 13px; font-weight: 650; color: var(--text); }
        .st-card-sub { font-size: 11px; color: var(--text-3); margin-top: 1px; }
        .st-card-check { position: absolute; top: 8px; right: 8px; z-index: 3; width: 22px; height: 22px; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .st-pill { padding: 9px 15px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 13px; font-weight: 600; cursor: pointer; transition: all .13s; }
        .st-pill:hover { border-color: var(--border-strong); color: var(--text); }
        .st-pill.sel { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-2); }
        .st-thumb { position: relative; width: 70px; height: 70px; border-radius: 11px; overflow: hidden; border: 1px solid var(--border-strong); flex: none; }
        .st-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .st-thumb-x { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; border-radius: 999px; background: rgba(0,0,0,.7); color: #fff; display: grid; place-items: center; border: none; cursor: pointer; }
        .st-step { width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); display: grid; place-items: center; cursor: pointer; }
        .st-step:disabled { opacity: .4; cursor: default; }
        .st-input { width: 100%; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px; padding: 11px 13px; color: var(--text); font-size: 13.5px; font-family: var(--font); resize: vertical; outline: none; }
      `}</style>

      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>Create a video</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6 }}>Pick a style and theme, add your product, set the canvas — then generate the storyboard.</p>
      </div>

      {/* Style */}
      <Section title="Style">
        <div className="st-cardgrid">
          {USE_CASES.map((u) => {
            const g = STYLE_GFX[u.id]
            const sel = draft.useCase === u.id
            return (
              <button key={u.id} className={`st-card${sel ? ' sel' : ''}`} onClick={() => onPickStyle(u.id)}>
                {sel && <span className="st-card-check"><Icon name="check" size={12} /></span>}
                <TemplatePreview register={g.register} palette={g.palette} title={g.title} kicker={g.kicker} ratio={1.5} />
                <div className="st-card-cap">
                  <div className="st-card-name">{u.title}</div>
                  <div className="st-card-sub">{u.suggestedAspect} · {u.model}</div>
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      {/* Theme */}
      <Section title="Theme">
        <div className="st-cardgrid">
          <button className="st-card" onClick={() => setCreateOpen(true)} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ aspectRatio: '1.5', display: 'grid', placeItems: 'center', background: 'var(--surface-2)' }}>
              <span style={{ width: 34, height: 34, borderRadius: 999, border: '1px solid var(--border-strong)', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}><Icon name="plus" size={16} /></span>
            </div>
            <div className="st-card-cap"><div className="st-card-name">Create New</div><div className="st-card-sub">Custom brand kit</div></div>
          </button>
          {allThemes.map((t) => {
            const c = t.colors
            const sel = draft.brandThemeId === t.id
            return (
              <button key={t.id} className={`st-card${sel ? ' sel' : ''}`} onClick={() => update({ brandThemeId: t.id, brand: themeToBrand(t) })}>
                {sel && <span className="st-card-check"><Icon name="check" size={12} /></span>}
                <TemplatePreview register={registerForBrand(themeToBrand(t))} palette={[c.secondary, c.accent || c.primary, c.surface]} title={t.name} kicker={t.titleFont} ratio={1.5} />
                <div className="st-card-cap"><div className="st-card-name">{t.name}</div><div className="st-card-sub">{t.titleFont} · {t.register}</div></div>
              </button>
            )
          })}
        </div>
      </Section>

      {/* Product */}
      <Section title="Product" hint={`${draft.product.images.length}/4 images`}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {draft.product.images.map((im) => (
            <div key={im.id} className="st-thumb">
              <img src={im.dataUrl} alt={im.name} />
              <button className="st-thumb-x" onClick={() => removeImage(im.id)} aria-label="Remove"><Icon name="close" size={11} /></button>
            </div>
          ))}
          {draft.product.images.length < 4 && (
            <button onClick={() => fileRef.current?.click()} style={{ width: 70, height: 70, borderRadius: 11, border: '1.5px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-3)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              {busy ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Icon name="upload" size={18} />}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(Array.from(e.target.files || []))} />
        </div>
        <textarea className="st-input" rows={2} placeholder="Optional — what is the product? Anything the model should preserve…" value={draft.product.description || ''} onChange={(e) => update({ product: { ...draft.product, description: e.target.value } })} />
      </Section>

      {/* Frames / Duration / Canvas */}
      <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
        <Section title="Frames">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="st-step" disabled={draft.frameCount <= 2} onClick={() => update({ frameCount: Math.max(2, draft.frameCount - 1) })}><Icon name="close" size={13} style={{ transform: 'rotate(45deg)' }} /></button>
            <span style={{ minWidth: 30, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: 'var(--text)' }}>{draft.frameCount}</span>
            <button className="st-step" disabled={draft.frameCount >= 12} onClick={() => update({ frameCount: Math.min(12, draft.frameCount + 1) })}><Icon name="plus" size={14} /></button>
          </div>
        </Section>
        <Section title="Duration">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DURATIONS.map((d) => <button key={d} className={`st-pill${draft.durationSec === d ? ' sel' : ''}`} onClick={() => update({ durationSec: d })}>{d}s</button>)}
          </div>
        </Section>
        <Section title="Canvas">
          <div style={{ display: 'flex', gap: 8 }}>
            {ASPECTS.map((a) => <button key={a.value} className={`st-pill${draft.aspect === a.value ? ' sel' : ''}`} onClick={() => update({ aspect: a.value })}>{a.label}</button>)}
          </div>
        </Section>
      </div>

      {createOpen && (
        <ThemeModal onClose={() => setCreateOpen(false)} onSaved={(t) => { setCreateOpen(false); update({ brandThemeId: t.id, brand: themeToBrand(t) }) }} />
      )}
    </div>
  )
}

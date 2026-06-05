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

const STYLE_GFX: Record<UseCase, { register: PReg; title: string; kicker: string; palette: string[] }> = {
  saas_explainer: { register: 'product', title: 'Ship faster', kicker: 'SaaS', palette: ['#8a3ffc', '#4e7bff'] },
  physical_ad: { register: 'poster', title: 'The drop is here', kicker: 'Ad', palette: ['#ec4899', '#8a3ffc'] },
  pitch: { register: 'presentation', title: 'Q3 in review', kicker: 'Pitch', palette: ['#3b82f6', '#8a3ffc'] },
  app_launch: { register: 'product', title: 'Your day, organized', kicker: 'App', palette: ['#2dd4bf', '#3b82f6'] },
  brand_manifesto: { register: 'bold', title: 'We believe', kicker: 'Brand', palette: ['#ff6b6b', '#ff9f45'] },
}

const RATIO: Record<GridAspect, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 }
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

  return (
    <div style={{ height: '100%', display: 'flex', gap: 28, minHeight: 0 }}>
      <style>{`
        .st-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-3); }
        .st-cardrow { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .st-themerow { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
        .st-card { position: relative; padding: 0; border-radius: 12px; overflow: hidden; border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; transition: border-color .14s, transform .12s; text-align: left; }
        .st-card:hover { border-color: var(--border-strong); transform: translateY(-2px); }
        .st-card.sel { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .st-card-cap { padding: 7px 9px 8px; }
        .st-card-name { font-size: 12.5px; font-weight: 650; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .st-card-sub { font-size: 10.5px; color: var(--text-3); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .st-card-check { position: absolute; top: 7px; right: 7px; z-index: 3; width: 20px; height: 20px; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .st-prompt { width: 100%; background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: 14px; padding: 14px 16px; color: var(--text); font-size: 15px; line-height: 1.5; font-family: var(--font); resize: none; outline: none; transition: border-color .14s; }
        .st-prompt:focus { border-color: var(--accent); }
        .st-thumb { position: relative; width: 52px; height: 52px; border-radius: 9px; overflow: hidden; border: 1px solid var(--border-strong); flex: none; }
        .st-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .st-thumb-x { position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; border-radius: 999px; background: rgba(0,0,0,.7); color: #fff; display: grid; place-items: center; border: none; cursor: pointer; }
        .st-add { width: 52px; height: 52px; border-radius: 9px; border: 1.5px dashed var(--border-strong); background: var(--surface); color: var(--text-3); display: grid; place-items: center; cursor: pointer; flex: none; }
        /* right config column */
        .st-cfg { width: 280px; flex: none; border-left: 1px solid var(--border); padding-left: 26px; display: flex; flex-direction: column; gap: 24px; }
        .st-step { width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); display: grid; place-items: center; cursor: pointer; }
        .st-step:disabled { opacity: .4; cursor: default; }
        .st-pill { padding: 8px 0; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 13px; font-weight: 600; cursor: pointer; transition: all .13s; text-align: center; }
        .st-pill:hover { border-color: var(--border-strong); color: var(--text); }
        .st-pill.sel { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-2); }
        .st-aspect { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 12px 0 9px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; transition: all .13s; }
        .st-aspect:hover { border-color: var(--border-strong); }
        .st-aspect.sel { border-color: var(--accent); background: var(--accent-soft); }
        .st-aspect-box { display: grid; place-items: center; height: 40px; }
        .st-aspect-name { font-size: 11.5px; font-weight: 600; color: var(--text-2); }
        .st-aspect.sel .st-aspect-name { color: var(--accent-2); }
      `}</style>

      {/* ── LEFT: prompt + style + theme ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18, overflow: 'hidden' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 600, color: 'var(--text)' }}>Create a video</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Describe it, pick a style and theme — then generate the storyboard.</p>
        </div>

        {/* Prominent prompt + product images */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            className="st-prompt"
            rows={3}
            placeholder="Describe your video — the product, the story, the vibe…"
            value={draft.product.description || ''}
            onChange={(e) => update({ product: { ...draft.product, description: e.target.value } })}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="st-label" style={{ marginRight: 2 }}>Product</span>
            {draft.product.images.map((im) => (
              <div key={im.id} className="st-thumb"><img src={im.dataUrl} alt={im.name} /><button className="st-thumb-x" onClick={() => removeImage(im.id)} aria-label="Remove"><Icon name="close" size={10} /></button></div>
            ))}
            {draft.product.images.length < 4 && (
              <button className="st-add" onClick={() => fileRef.current?.click()}>{busy ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <Icon name="upload" size={16} />}</button>
            )}
            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{draft.product.images.length}/4 reference images</span>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(Array.from(e.target.files || []))} />
          </div>
        </div>

        {/* Style */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span className="st-label">Style</span>
          <div className="st-cardrow">
            {USE_CASES.map((u) => {
              const g = STYLE_GFX[u.id]
              const sel = draft.useCase === u.id
              return (
                <button key={u.id} className={`st-card${sel ? ' sel' : ''}`} onClick={() => onPickStyle(u.id)}>
                  {sel && <span className="st-card-check"><Icon name="check" size={11} /></span>}
                  <TemplatePreview register={g.register} palette={g.palette} title={g.title} kicker={g.kicker} ratio={1.6} />
                  <div className="st-card-cap"><div className="st-card-name">{u.title}</div><div className="st-card-sub">{u.suggestedAspect} · {u.model}</div></div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Theme */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span className="st-label">Theme</span>
          <div className="st-themerow">
            <button className="st-card" onClick={() => setCreateOpen(true)} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '1.6', display: 'grid', placeItems: 'center', background: 'var(--surface-2)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border-strong)', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}><Icon name="plus" size={15} /></span>
              </div>
              <div className="st-card-cap"><div className="st-card-name">Create New</div><div className="st-card-sub">Custom kit</div></div>
            </button>
            {allThemes.map((t) => {
              const c = t.colors
              const sel = draft.brandThemeId === t.id
              return (
                <button key={t.id} className={`st-card${sel ? ' sel' : ''}`} onClick={() => update({ brandThemeId: t.id, brand: themeToBrand(t) })}>
                  {sel && <span className="st-card-check"><Icon name="check" size={11} /></span>}
                  <TemplatePreview register={registerForBrand(themeToBrand(t))} palette={[c.secondary, c.accent || c.primary, c.surface]} title={t.name} kicker={t.titleFont} ratio={1.6} />
                  <div className="st-card-cap"><div className="st-card-name">{t.name}</div><div className="st-card-sub">{t.titleFont}</div></div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT: config column (no scroll) ── */}
      <div className="st-cfg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="st-label">Frames</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="st-step" disabled={draft.frameCount <= 2} onClick={() => update({ frameCount: Math.max(2, draft.frameCount - 1) })}><Icon name="close" size={13} style={{ transform: 'rotate(45deg)' }} /></button>
            <span style={{ minWidth: 30, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>{draft.frameCount}</span>
            <button className="st-step" disabled={draft.frameCount >= 12} onClick={() => update({ frameCount: Math.min(12, draft.frameCount + 1) })}><Icon name="plus" size={14} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="st-label">Duration</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {DURATIONS.map((d) => <button key={d} className={`st-pill${draft.durationSec === d ? ' sel' : ''}`} onClick={() => update({ durationSec: d })}>{d}s</button>)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="st-label">Canvas</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(Object.keys(RATIO) as GridAspect[]).map((a) => {
              const r = RATIO[a]
              const sel = draft.aspect === a
              const bw = r >= 1 ? 34 : 34 * r
              const bh = r >= 1 ? 34 / r : 34
              return (
                <button key={a} className={`st-aspect${sel ? ' sel' : ''}`} onClick={() => update({ aspect: a })}>
                  <div className="st-aspect-box"><div style={{ width: bw, height: bh, borderRadius: 3, background: sel ? 'var(--accent)' : 'var(--surface-3)', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-strong)'}` }} /></div>
                  <span className="st-aspect-name">{a}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {createOpen && (
        <ThemeModal onClose={() => setCreateOpen(false)} onSaved={(t) => { setCreateOpen(false); update({ brandThemeId: t.id, brand: themeToBrand(t) }) }} />
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import type { Draft } from '../wizard'
import { ingestProductFiles, themeToBrand, registerForBrand, importThemeFromUrlStub, importProductFromUrlStub } from '../wizard'
import type { UseCase, GridAspect } from '../../../spec'
import { USE_CASES } from '../../../spec'
import { computeGrid } from '../../../engine/gridGeometry'
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
// Frame counts that tile into a perfect near-square grid (no empty slot). The
// grid LABEL (cols×rows) adapts to the chosen canvas via computeGrid.
const FRAME_COUNTS = [4, 6, 9, 12]

export function StepSetup({ draft, update, onPickStyle }: { draft: Draft; update: (patch: Partial<Draft>) => void; onPickStyle: (u: UseCase) => void }) {
  const userThemes = useStore((s) => s.userThemes)
  const addTheme = useStore((s) => s.addTheme)
  const allThemes = [...userThemes, ...BUILTIN_THEMES]
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [prodOpen, setProdOpen] = useState(false)
  const [brandUrl, setBrandUrl] = useState('')
  const [productUrl, setProductUrl] = useState('')

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
  const importBrand = () => {
    if (!brandUrl.trim()) return
    const stub = importThemeFromUrlStub(brandUrl.trim())
    const t = addTheme({ ...stub, register: 'imported / custom brand', styleNotes: `Imported from ${brandUrl.trim()}` })
    update({ brandThemeId: t.id, brand: themeToBrand(t) })
    setBrandUrl('')
  }
  const importProduct = () => {
    if (!productUrl.trim() || draft.product.images.length >= 4) return
    const img = importProductFromUrlStub(productUrl.trim())
    const images = [...draft.product.images, img]
    update({ product: { ...draft.product, images, assetIds: images.map((i) => i.id) } })
    setProductUrl('')
  }

  const cfgPill = (active: boolean) => `st-pill${active ? ' sel' : ''}`

  return (
    <div style={{ height: '100%', display: 'flex', gap: 28, minHeight: 0 }}>
      <style>{`
        .st-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-3); }
        .st-h { font-family: var(--font-display); font-size: 14px; font-weight: 650; color: var(--text); }
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

        /* compact product trigger + popover */
        .st-prod-btn { display: inline-flex; align-items: center; gap: 9px; padding: 8px 12px 8px 8px; border-radius: 11px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; }
        .st-prod-btn:hover { border-color: var(--accent); }
        .st-mini { width: 26px; height: 26px; border-radius: 7px; object-fit: cover; border: 1px solid var(--border-strong); }
        .st-pop { position: absolute; z-index: 60; top: calc(100% + 8px); left: 0; width: 460px; background: var(--bg-elev); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: var(--shadow-pop); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .st-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .st-slot { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; border: 1.5px dashed var(--border-strong); background: var(--surface-2); display: grid; place-items: center; cursor: pointer; transition: border-color .14s; }
        .st-slot:hover { border-color: var(--accent); }
        .st-slot.has { border-style: solid; border-color: var(--border-strong); background: #0a0a0c; }
        .st-slot img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .st-slot-x { position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: 999px; background: rgba(0,0,0,.7); color: #fff; display: grid; place-items: center; border: none; cursor: pointer; }
        .st-url-row { display: flex; gap: 6px; }
        .st-url-input { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 9px; padding: 9px 11px; color: var(--text); font-size: 12.5px; font-family: var(--font); outline: none; }
        .st-url-input:focus { border-color: var(--accent); }
        .st-url-btn { padding: 0 14px; border-radius: 9px; border: none; background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .st-url-btn:disabled { opacity: .45; cursor: default; }

        .st-cfg { width: 280px; flex: none; border-left: 1px solid var(--border); padding-left: 26px; display: flex; flex-direction: column; gap: 24px; }
        .st-pill { padding: 8px 0; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 13px; font-weight: 600; cursor: pointer; transition: all .13s; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
        .st-pill small { font-size: 10px; color: var(--text-4); font-weight: 500; }
        .st-pill:hover { border-color: var(--border-strong); color: var(--text); }
        .st-pill.sel { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-2); }
        .st-pill.sel small { color: var(--accent-2); opacity: .75; }
        .st-aspect { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 12px 0 9px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; transition: all .13s; }
        .st-aspect:hover { border-color: var(--border-strong); }
        .st-aspect.sel { border-color: var(--accent); background: var(--accent-soft); }
        .st-aspect-box { display: grid; place-items: center; height: 40px; }
        .st-aspect-name { font-size: 11.5px; font-weight: 600; color: var(--text-2); }
        .st-aspect.sel .st-aspect-name { color: var(--accent-2); }
      `}</style>

      {/* ── LEFT (no scroll) ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18, overflow: 'visible' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 600, color: 'var(--text)' }}>Create a video</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Add your product, describe it, pick a style and theme — then generate the storyboard.</p>
        </div>

        {/* Prompt */}
        <textarea
          className="st-prompt"
          rows={3}
          placeholder="Describe your video — the product, the story, the vibe…"
          value={draft.product.description || ''}
          onChange={(e) => update({ product: { ...draft.product, description: e.target.value } })}
        />

        {/* Product — compact trigger + popover (no layout shift, no scroll) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <span className="st-h" style={{ width: 64 }}>Product</span>
          <button className="st-prod-btn" onClick={() => setProdOpen((o) => !o)}>
            <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent-soft)', color: 'var(--accent-2)', display: 'grid', placeItems: 'center' }}><Icon name="plus" size={14} /></span>
            {draft.product.images.length ? `${draft.product.images.length} reference${draft.product.images.length > 1 ? 's' : ''}` : 'Add product'}
            <Icon name="chevDown" size={13} style={{ color: 'var(--text-3)' }} />
          </button>
          {/* inline thumbnails */}
          {draft.product.images.slice(0, 4).map((im) => <img key={im.id} className="st-mini" src={im.dataUrl} alt={im.name} />)}

          {prodOpen && (
            <>
              <div onClick={() => setProdOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 55 }} />
              <div className="st-pop" style={{ left: 76 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Product references <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>· {draft.product.images.length}/4</span></div>
                <div className="st-slots">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const im = draft.product.images[i]
                    if (im) return (
                      <div key={im.id} className="st-slot has"><img src={im.dataUrl} alt={im.name} /><button className="st-slot-x" onClick={() => removeImage(im.id)} aria-label="Remove"><Icon name="close" size={11} /></button></div>
                    )
                    return <button key={`e${i}`} className="st-slot" onClick={() => fileRef.current?.click()}>{busy && i === draft.product.images.length ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Icon name="upload" size={17} style={{ color: 'var(--text-3)' }} />}</button>
                  })}
                  <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(Array.from(e.target.files || []))} />
                </div>
                <div className="st-url-row">
                  <input className="st-url-input" placeholder="Paste a product URL — www.your-product.com" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') importProduct() }} />
                  <button className="st-url-btn" onClick={importProduct} disabled={!productUrl.trim() || draft.product.images.length >= 4}>Import</button>
                </div>
                <button className="st-url-btn" disabled style={{ background: 'var(--surface-2)', color: 'var(--text-2)', padding: '9px 0', border: '1px solid var(--border-strong)' }} title="Wired later"><Icon name="apps" size={12} /> Select from catalog</button>
              </div>
            </>
          )}
        </div>

        {/* Style */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span className="st-h">Style</span>
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

        {/* Theme + brand URL import */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span className="st-h">Theme</span>
            <div className="st-url-row" style={{ maxWidth: 340, flex: 1 }}>
              <input className="st-url-input" placeholder="Or paste a brand URL — e.g. www.brand.com" value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') importBrand() }} />
              <button className="st-url-btn" onClick={importBrand} disabled={!brandUrl.trim()}>Import</button>
            </div>
          </div>
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

      {/* ── RIGHT: Canvas → Frames → Duration ── */}
      <div className="st-cfg">
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="st-label">Frames</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {FRAME_COUNTS.map((n) => {
              const g = computeGrid(n, draft.aspect)
              return (
                <button key={n} className={cfgPill(draft.frameCount === n)} onClick={() => update({ frameCount: n })}>
                  {n}<small>{g.cols}×{g.rows}</small>
                </button>
              )
            })}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.4 }}>Grid is computed for your canvas — wide cells stack, tall cells sit side by side.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="st-label">Duration</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {DURATIONS.map((d) => <button key={d} className={cfgPill(draft.durationSec === d)} onClick={() => update({ durationSec: d })}>{d}s</button>)}
          </div>
        </div>
      </div>

      {createOpen && (
        <ThemeModal onClose={() => setCreateOpen(false)} onSaved={(t) => { setCreateOpen(false); update({ brandThemeId: t.id, brand: themeToBrand(t) }) }} />
      )}
    </div>
  )
}

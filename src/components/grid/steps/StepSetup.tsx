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

  const images = draft.product.images
  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    const next = await ingestProductFiles(files, images)
    update({ product: { ...draft.product, images: next, assetIds: next.map((i) => i.id) } })
    setBusy(false)
  }
  const removeImage = (id: string) => {
    const next = images.filter((i) => i.id !== id)
    update({ product: { ...draft.product, images: next, assetIds: next.map((i) => i.id) } })
  }
  const importBrand = () => {
    if (!brandUrl.trim()) return
    const stub = importThemeFromUrlStub(brandUrl.trim())
    const t = addTheme({ ...stub, register: 'imported / custom brand', styleNotes: `Imported from ${brandUrl.trim()}` })
    update({ brandThemeId: t.id, brand: themeToBrand(t) })
    setBrandUrl('')
  }
  const importProduct = () => {
    if (!productUrl.trim() || images.length >= 4) return
    const img = importProductFromUrlStub(productUrl.trim())
    const next = [...images, img]
    update({ product: { ...draft.product, images: next, assetIds: next.map((i) => i.id) } })
    setProductUrl('')
  }

  const pill = (active: boolean) => `st-pill${active ? ' sel' : ''}`
  // stacked-card transforms (front → back)
  const stackT = (depth: number) => depth === 0 ? 'translate(-50%,-50%) rotate(0deg)' : depth === 1 ? 'translate(-42%,-52%) rotate(8deg)' : 'translate(-58%,-48%) rotate(-8deg)'

  return (
    <div style={{ height: '100%', display: 'flex', gap: 28, minHeight: 0 }}>
      <style>{`
        .st-h { font-family: var(--font-display); font-size: 14px; font-weight: 650; color: var(--text); }
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

        .st-prompt { width: 100%; flex: 1; min-height: 0; background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: 14px; padding: 14px 16px; color: var(--text); font-size: 15px; line-height: 1.5; font-family: var(--font); resize: none; outline: none; transition: border-color .14s; }
        .st-prompt:focus { border-color: var(--accent); }

        /* Product upload area (right column) */
        .st-prodbox { position: relative; width: 100%; aspect-ratio: 3 / 2; border-radius: 14px; border: 1.5px dashed var(--border-strong); background: var(--surface); cursor: pointer; overflow: hidden; transition: border-color .14s; }
        .st-prodbox:hover { border-color: var(--accent); }
        .st-prodbox.has { border-style: solid; }
        .st-prod-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-3); }
        .st-stackcard { position: absolute; top: 50%; left: 50%; width: 46%; aspect-ratio: 3/4; border-radius: 12px; overflow: hidden; border: 2px solid var(--bg-elev); box-shadow: 0 8px 22px rgba(0,0,0,.45); }
        .st-stackcard img { width: 100%; height: 100%; object-fit: cover; }
        .st-prod-count { position: absolute; bottom: 10px; right: 10px; z-index: 6; min-width: 24px; height: 24px; padding: 0 8px; border-radius: 999px; background: rgba(10,10,12,.78); backdrop-filter: blur(4px); color: #fff; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
        .st-prod-edit { position: absolute; top: 10px; right: 10px; z-index: 6; padding: 5px 10px; border-radius: 999px; background: rgba(10,10,12,.7); color: #fff; font-size: 11px; font-weight: 600; opacity: 0; transition: opacity .14s; }
        .st-prodbox:hover .st-prod-edit { opacity: 1; }

        .st-cfg { width: 296px; flex: none; border-left: 1px solid var(--border); padding-left: 26px; display: flex; flex-direction: column; gap: 20px; }
        .st-pill { padding: 8px 0; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: 13px; font-weight: 600; cursor: pointer; transition: all .13s; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
        .st-pill small { font-size: 10px; color: var(--text-4); font-weight: 500; }
        .st-pill:hover { border-color: var(--border-strong); color: var(--text); }
        .st-pill.sel { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-2); }
        .st-pill.sel small { color: var(--accent-2); opacity: .75; }
        .st-aspect { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 11px 0 8px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--surface); cursor: pointer; transition: all .13s; }
        .st-aspect:hover { border-color: var(--border-strong); }
        .st-aspect.sel { border-color: var(--accent); background: var(--accent-soft); }
        .st-aspect-box { display: grid; place-items: center; height: 36px; }
        .st-aspect-name { font-size: 11.5px; font-weight: 600; color: var(--text-2); }
        .st-aspect.sel .st-aspect-name { color: var(--accent-2); }

        /* Product manage popup */
        .st-pm-overlay { position: fixed; inset: 0; z-index: 320; background: rgba(0,0,0,.55); backdrop-filter: blur(4px); display: grid; place-items: center; }
        .st-pm { width: 520px; max-width: 92vw; background: var(--bg-elev); border: 1px solid var(--border-strong); border-radius: 18px; box-shadow: var(--shadow-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px; animation: scaleIn .2s var(--ease); }
        .st-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .st-slot { position: relative; aspect-ratio: 1; border-radius: 11px; overflow: hidden; border: 1.5px dashed var(--border-strong); background: var(--surface-2); display: grid; place-items: center; cursor: pointer; transition: border-color .14s; }
        .st-slot:hover { border-color: var(--accent); }
        .st-slot.has { border-style: solid; border-color: var(--border-strong); background: #0a0a0c; }
        .st-slot img { width: 100%; height: 100%; object-fit: cover; }
        .st-slot-x { position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: 999px; background: rgba(0,0,0,.7); color: #fff; display: grid; place-items: center; border: none; cursor: pointer; }
        .st-url-row { display: flex; gap: 6px; }
        .st-url-input { flex: 1; min-width: 0; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 9px; padding: 9px 11px; color: var(--text); font-size: 12.5px; font-family: var(--font); outline: none; }
        .st-url-input:focus { border-color: var(--accent); }
        .st-url-btn { padding: 0 14px; border-radius: 9px; border: none; background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .st-url-btn:disabled { opacity: .45; cursor: default; }
      `}</style>

      {/* ── LEFT: prompt + style + theme ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18, overflow: 'visible' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 600, color: 'var(--text)' }}>Create a video</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Add your product, describe it, pick a style and theme — then generate the storyboard.</p>
        </div>

        <textarea
          className="st-prompt"
          style={{ maxHeight: 120 }}
          placeholder="Describe your video — the product, the story, the vibe…"
          value={draft.product.description || ''}
          onChange={(e) => update({ product: { ...draft.product, description: e.target.value } })}
        />

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

      {/* ── RIGHT: Product → Canvas → Frames → Duration ── */}
      <div className="st-cfg">
        {/* Product */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="st-label">Product</span>
          <div className={`st-prodbox${images.length ? ' has' : ''}`} onClick={() => setProdOpen(true)}>
            {images.length === 0 ? (
              <div className="st-prod-empty">
                <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--accent-soft)', color: 'var(--accent-2)', display: 'grid', placeItems: 'center' }}><Icon name="upload" size={19} /></span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Add product images</span>
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Upload or paste a URL</span>
              </div>
            ) : (
              <>
                {[2, 1, 0].map((depth) => {
                  const im = images[depth]
                  if (!im) return null
                  return <div key={im.id} className="st-stackcard" style={{ transform: stackT(depth), zIndex: 5 - depth }}><img src={im.dataUrl} alt={im.name} /></div>
                })}
                <span className="st-prod-count"><Icon name="image" size={12} /> {images.length}</span>
                <span className="st-prod-edit">Manage</span>
              </>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span className="st-label">Canvas</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {(Object.keys(RATIO) as GridAspect[]).map((a) => {
              const r = RATIO[a]
              const sel = draft.aspect === a
              const bw = r >= 1 ? 32 : 32 * r
              const bh = r >= 1 ? 32 / r : 32
              return (
                <button key={a} className={`st-aspect${sel ? ' sel' : ''}`} onClick={() => update({ aspect: a })}>
                  <div className="st-aspect-box"><div style={{ width: bw, height: bh, borderRadius: 3, background: sel ? 'var(--accent)' : 'var(--surface-3)', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-strong)'}` }} /></div>
                  <span className="st-aspect-name">{a}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Frames */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span className="st-label">Frames</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {FRAME_COUNTS.map((n) => {
              const g = computeGrid(n, draft.aspect)
              return <button key={n} className={pill(draft.frameCount === n)} onClick={() => update({ frameCount: n })}>{n}<small>{g.cols}×{g.rows}</small></button>
            })}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.4 }}>Grid is computed for your canvas — wide cells stack, tall cells sit side by side.</span>
        </div>

        {/* Duration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <span className="st-label">Duration</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {DURATIONS.map((d) => <button key={d} className={pill(draft.durationSec === d)} onClick={() => update({ durationSec: d })}>{d}s</button>)}
          </div>
        </div>
      </div>

      {/* Product manage popup */}
      {prodOpen && (
        <div className="st-pm-overlay" onMouseDown={() => setProdOpen(false)}>
          <div className="st-pm" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>Product references <span style={{ color: 'var(--text-4)', fontWeight: 400, fontSize: 13 }}>· {images.length}/4</span></span>
              <button onClick={() => setProdOpen(false)} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={15} /></button>
            </div>
            <div className="st-slots">
              {Array.from({ length: 4 }).map((_, i) => {
                const im = images[i]
                if (im) return <div key={im.id} className="st-slot has"><img src={im.dataUrl} alt={im.name} /><button className="st-slot-x" onClick={() => removeImage(im.id)} aria-label="Remove"><Icon name="close" size={11} /></button></div>
                return <button key={`e${i}`} className="st-slot" onClick={() => fileRef.current?.click()}>{busy && i === images.length ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Icon name="upload" size={18} style={{ color: 'var(--text-3)' }} />}</button>
              })}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(Array.from(e.target.files || []))} />
            </div>
            <div className="st-url-row">
              <input className="st-url-input" placeholder="Paste a product URL — www.your-product.com" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') importProduct() }} />
              <button className="st-url-btn" onClick={importProduct} disabled={!productUrl.trim() || images.length >= 4}>Import</button>
            </div>
            <button className="st-url-btn" disabled style={{ background: 'var(--surface-2)', color: 'var(--text-2)', padding: '10px 0', border: '1px solid var(--border-strong)' }} title="Wired later"><Icon name="apps" size={12} /> Select from catalog</button>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setProdOpen(false)} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Done</button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <ThemeModal onClose={() => setCreateOpen(false)} onSaved={(t) => { setCreateOpen(false); update({ brandThemeId: t.id, brand: themeToBrand(t) }) }} />
      )}
    </div>
  )
}

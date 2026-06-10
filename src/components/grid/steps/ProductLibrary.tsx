import { useRef, useState } from 'react'
import type { Draft } from '../wizard'
import { downscaleImage, importProductFromUrlStub } from '../wizard'
import { Icon } from '../../Icon'

type ProductImg = { id: string; name: string; dataUrl: string }

function h32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

// Deterministic dark product-ish thumbnail (mock library — no real assets).
function sampleThumb(name: string): string {
  const seed = h32(name)
  const PAL = [['#8a3ffc', '#4e7bff'], ['#ec4899', '#f97316'], ['#22c55e', '#14b8a6'], ['#06b6d4', '#6366f1'], ['#f43f5e', '#fb7185'], ['#a855f7', '#6366f1']]
  const [a, b] = PAL[seed % PAL.length]
  const rot = (seed >> 4) % 30 - 15
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient><radialGradient id='bg' cx='50%' cy='35%' r='80%'><stop offset='0' stop-color='#1c1c1f'/><stop offset='1' stop-color='#0a0a0c'/></radialGradient></defs><rect width='240' height='240' fill='url(%23bg)'/><g transform='rotate(${rot} 120 120)'><rect x='74' y='62' width='92' height='128' rx='18' fill='url(%23g)'/><rect x='90' y='150' width='60' height='10' rx='5' fill='rgba(255,255,255,.35)'/></g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/%2523/g, '%23')}`
}

const SAMPLE: { handle: string; name: string }[] = [
  { handle: '@roye', name: 'Facial Tonic' },
  { handle: '@Bella', name: 'Vintage Camera' },
  { handle: '@nick-adams', name: 'Steel Tumbler' },
  { handle: '@nick-adams', name: 'Sunglasses' },
  { handle: '@studio', name: 'Studio Headphones' },
  { handle: '@lab', name: 'Film Camera' },
  { handle: '@atelier', name: 'Canvas Jacket' },
  { handle: '@home', name: 'Scented Candle' },
]
const SAMPLE_PRODUCTS: ProductImg[] = SAMPLE.map((s) => ({ id: `sample_${h32(s.name).toString(36)}`, name: s.name, dataUrl: sampleThumb(s.name) }))

// "Enter a link to your product or create manually" — the full product library.
export function SelectProductModal({ open, draft, update, onClose }: { open: boolean; draft: Draft; update: (patch: Partial<Draft>) => void; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState<'all' | 'saved'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const images = draft.product.images
  const isSel = (id: string) => images.some((i) => i.id === id)
  const setImages = (next: ProductImg[]) => update({ product: { ...draft.product, images: next.slice(0, 4), assetIds: next.slice(0, 4).map((i) => i.id) } })
  const toggle = (p: ProductImg) => setImages(isSel(p.id) ? images.filter((i) => i.id !== p.id) : [...images, p])
  const importUrl = () => { if (!url.trim()) return; setImages([...images, importProductFromUrlStub(url.trim())]); setUrl('') }
  const uploadFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    const read = await Promise.all(files.slice(0, 4).map((f) => new Promise<ProductImg | null>((res) => {
      const r = new FileReader(); r.onload = async () => res({ id: `up_${h32(f.name + String(r.result).length).toString(36)}`, name: f.name, dataUrl: await downscaleImage(String(r.result)) }); r.onerror = () => res(null); r.readAsDataURL(f)
    })))
    setImages([...images, ...read.filter(Boolean) as ProductImg[]])
    setBusy(false)
  }

  const lib = tab === 'saved' ? SAMPLE_PRODUCTS.filter((p) => isSel(p.id)) : SAMPLE_PRODUCTS

  return (
    <div className="pl-overlay" onMouseDown={onClose}>
      <style>{`
        .pl-overlay { position: fixed; inset: 0; z-index: 340; background: rgba(0,0,0,.6); backdrop-filter: blur(6px); display: grid; place-items: center; animation: fadeUp .16s ease; }
        .pl-modal { box-sizing: border-box; width: 1040px; max-width: 94vw; height: 720px; max-height: 88vh; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 28px; box-shadow: var(--shadow-lg); padding: 24px; display: flex; flex-direction: column; gap: 24px; animation: scaleIn .2s var(--ease); }
        .pl-head { display: flex; align-items: flex-start; gap: 16px; }
        .pl-title { font-family: var(--font-display); font-weight: 600; font-size: 24px; line-height: 1.33; color: var(--text); margin: 0; }
        .pl-sub { font-size: 14px; color: var(--text-3); margin: 4px 0 0; }
        .pl-x { flex: none; width: 32px; height: 32px; border-radius: 12px; border: none; background: var(--surface-2); color: var(--text-2); cursor: pointer; display: grid; place-items: center; }

        .pl-row { display: flex; align-items: center; gap: 8px; }
        .pl-input { width: 250px; display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 16px; background: var(--surface); transition: border-color .14s; }
        .pl-input:focus-within { border-color: var(--accent); }
        .pl-input input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: var(--text); font-size: 16px; font-family: var(--font); }
        .pl-or { font-size: 16px; color: var(--text-3); }
        .pl-manual { height: 40px; padding: 0 16px; border-radius: 16px; border: none; background: var(--surface-3); color: var(--text); font-size: 16px; font-weight: 500; cursor: pointer; }
        .pl-manual:hover { background: var(--surface-2); }

        .pl-tabs { display: flex; gap: 8px; }
        .pl-tab { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 12px; border: 1px solid transparent; background: transparent; color: var(--text-3); font-size: 14px; font-weight: 500; cursor: pointer; }
        .pl-tab.on { background: var(--surface-3); color: var(--text); }
        .pl-tab:not(.on) { border-color: var(--border-strong); }

        .pl-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); gap: 6px; align-content: start; }
        .pl-card { display: flex; flex-direction: column; gap: 4px; padding: 4px; border: none; background: none; cursor: pointer; }
        .pl-art { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 2px solid transparent; transition: border-color .14s, transform .12s; background: #0a0a0c; }
        .pl-card:hover .pl-art { transform: translateY(-2px); }
        .pl-card.sel .pl-art { border-color: var(--accent); }
        .pl-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pl-check { position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; border-radius: 6px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .pl-cap { font-size: 12px; color: var(--text-3); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; }
        .pl-create { aspect-ratio: 1; border: 1.5px dashed var(--border-strong); border-radius: 16px; background: var(--surface); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: border-color .14s; }
        .pl-create:hover { border-color: var(--accent); }
        .pl-create-ico { width: 32px; height: 32px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--border-strong); display: grid; place-items: center; color: var(--text-3); box-shadow: inset 0 0 4px rgba(0,0,0,.25); }

        .pl-foot { display: flex; justify-content: flex-end; }
        .pl-btn { height: 40px; padding: 0 18px; border-radius: 16px; border: none; font-size: 16px; font-weight: 500; cursor: pointer; font-family: var(--font-display); }
        .pl-btn.primary { background: #fff; color: #0a0a0c; }
        .pl-btn.primary:disabled { background: var(--surface-3); color: var(--text-4); cursor: default; }
      `}</style>

      <div className="pl-modal" onMouseDown={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="pl-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="pl-title">Enter a link to your product or create manually</h2>
            <p className="pl-sub">Add a link or upload images to use your product across generations.</p>
          </div>
          <button className="pl-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        {/* url + create manually */}
        <div className="pl-row">
          <label className="pl-input">
            <Icon name="link" size={18} style={{ color: 'var(--text-4)' }} />
            <input placeholder="www.yourproduct.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') importUrl() }} />
          </label>
          <span className="pl-or">or</span>
          <button className="pl-manual" onClick={() => setCreateOpen(true)}>Create Manually</button>
        </div>

        {/* tabs */}
        <div className="pl-tabs">
          <button className={`pl-tab${tab === 'all' ? ' on' : ''}`} onClick={() => setTab('all')}>All</button>
          <button className={`pl-tab${tab === 'saved' ? ' on' : ''}`} onClick={() => setTab('saved')}><Icon name="layers" size={15} /> Saved</button>
        </div>

        {/* library grid */}
        <div className="pl-grid">
          {tab === 'all' && (
            <button className="pl-card" onClick={() => fileRef.current?.click()}>
              <div className="pl-create">
                {busy ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <span className="pl-create-ico"><Icon name="plus" size={18} /></span>}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)' }}>Upload</span>
              </div>
              <span className="pl-cap">Create Product</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => uploadFiles(Array.from(e.target.files || []))} />
          {lib.map((p) => (
            <button key={p.id} className={`pl-card${isSel(p.id) ? ' sel' : ''}`} onClick={() => toggle(p)}>
              <div className="pl-art">
                {isSel(p.id) && <span className="pl-check"><Icon name="check" size={12} /></span>}
                <img src={p.dataUrl} alt={p.name} />
              </div>
              <span className="pl-cap">{SAMPLE.find((s) => `sample_${h32(s.name).toString(36)}` === p.id)?.handle || p.name}</span>
            </button>
          ))}
          {!lib.length && <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--text-4)', fontSize: 14 }}>No saved products yet.</div>}
        </div>

        {/* footer */}
        <div className="pl-foot">
          <button className="pl-btn primary" disabled={!images.length} onClick={onClose}>Continue</button>
        </div>
      </div>

      {createOpen && <CreateProductModal draft={draft} update={update} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false) }} />}
    </div>
  )
}

// "Create New Product" — manual product entry (images + name + description).
function CreateProductModal({ draft, update, onClose, onCreated }: { draft: Draft; update: (patch: Partial<Draft>) => void; onClose: () => void; onCreated: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [imgs, setImgs] = useState<ProductImg[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    const read = await Promise.all(files.slice(0, 10 - imgs.length).map((f) => new Promise<ProductImg | null>((res) => {
      const r = new FileReader(); r.onload = async () => res({ id: `cp_${Math.round(String(r.result).length)}_${files.indexOf(f)}`, name: f.name, dataUrl: await downscaleImage(String(r.result)) }); r.onerror = () => res(null); r.readAsDataURL(f)
    })))
    setImgs([...imgs, ...read.filter(Boolean) as ProductImg[]])
    setBusy(false)
  }
  const create = () => {
    const built = imgs.length ? imgs : [{ id: `cp_${h32(name || 'product').toString(36)}`, name: name || 'Product', dataUrl: sampleThumb(name || desc || 'Product') }]
    const tagged = built.map((b) => ({ ...b, name: name?.trim() || b.name }))
    const existing = draft.product.images
    const next = [...existing, ...tagged].slice(0, 4)
    update({ product: { ...draft.product, images: next, assetIds: next.map((i) => i.id), description: draft.product.description || desc } })
    onCreated()
  }

  return (
    <div className="cp-overlay" onMouseDown={onClose}>
      <style>{`
        .cp-overlay { position: fixed; inset: 0; z-index: 350; background: rgba(0,0,0,.5); backdrop-filter: blur(4px); display: grid; place-items: center; }
        .cp-modal { box-sizing: border-box; width: 680px; max-width: 92vw; background: var(--bg-elev); border: 1px solid var(--border-strong); border-radius: 24px; box-shadow: var(--shadow-lg); padding: 24px; display: flex; flex-direction: column; gap: 20px; animation: scaleIn .2s var(--ease); }
        .cp-label { font-size: 12px; font-weight: 600; letter-spacing: .02em; color: var(--text-3); display: block; margin-bottom: 8px; }
        .cp-slots { display: flex; gap: 10px; flex-wrap: wrap; }
        .cp-slot { width: 96px; height: 96px; border-radius: 12px; overflow: hidden; border: 1.5px dashed var(--border-strong); background: var(--surface-2); display: grid; place-items: center; cursor: pointer; position: relative; }
        .cp-slot.has { border-style: solid; background: #0a0a0c; }
        .cp-slot img { width: 100%; height: 100%; object-fit: cover; }
        .cp-input { width: 100%; height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border: 1px solid var(--border-strong); border-radius: 16px; background: var(--surface); }
        .cp-input:focus-within { border-color: var(--accent); }
        .cp-input span { color: var(--text-4); font-size: 15px; }
        .cp-input input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 15px; font-family: var(--font); }
        .cp-textarea { width: 100%; min-height: 96px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 12px 14px; color: var(--text); font-size: 14px; line-height: 1.5; font-family: var(--font); resize: none; outline: none; }
        .cp-textarea:focus { border-color: var(--accent); }
        .cp-foot { display: flex; justify-content: flex-end; gap: 8px; }
        .cp-btn { height: 40px; padding: 0 18px; border-radius: 16px; border: none; font-size: 15px; font-weight: 500; cursor: pointer; font-family: var(--font-display); }
        .cp-btn.ghost { background: var(--surface-3); color: var(--text); }
        .cp-btn.primary { background: #fff; color: #0a0a0c; }
      `}</style>
      <div className="cp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, color: 'var(--text)', margin: 0 }}>Create New Product</h3>
            <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '4px 0 0' }}>Add images, a name and a description for your product.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 12, border: 'none', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={16} /></button>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="cp-label">Product Images</span><span style={{ fontSize: 12, color: 'var(--text-4)' }}>{imgs.length}/10</span></div>
          <div className="cp-slots">
            <button className="cp-slot" onClick={() => fileRef.current?.click()}>{busy ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Icon name="plus" size={20} style={{ color: 'var(--text-3)' }} />}</button>
            {imgs.map((im) => <div key={im.id} className="cp-slot has"><img src={im.dataUrl} alt={im.name} /></div>)}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => add(Array.from(e.target.files || []))} />
          </div>
        </div>

        <div>
          <span className="cp-label">Name</span>
          <label className="cp-input"><span>@</span><input placeholder="product-name" value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>

        <div>
          <span className="cp-label">Description</span>
          <textarea className="cp-textarea" placeholder="Describe your new style → cinematic 35mm film, vintage, soft orange, and earth tones, misty light creating a serene, ethereal glow" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="cp-foot">
          <button className="cp-btn ghost" onClick={onClose}>Cancel</button>
          <button className="cp-btn primary" onClick={create}>Create Product</button>
        </div>
      </div>
    </div>
  )
}

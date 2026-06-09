import { useRef, useState } from 'react'
import type { Draft } from '../wizard'
import { ingestProductFiles, importProductFromUrlStub } from '../wizard'
import type { UseCase } from '../../../spec'
import { USE_CASES } from '../../../spec'
import { Icon } from '../../Icon'

// Real sample clips that play inside the Style cards.
const STYLE_VIDEO: Record<UseCase, string> = {
  saas_explainer: '/styles/saas-madison.mp4',
  physical_ad: '/styles/product-lipstick.mp4',
  pitch: '/styles/saas-spotify.mp4',
  app_launch: '/styles/product-mouse.mp4',
  brand_manifesto: '/styles/product-cutoutstyle.mp4',
}

// Step 1 — "Motion Studio": add the product (URL or upload), describe the ad,
// and pick a style. Theme + canvas come on the next step.
export function StepProduct({ draft, update, onPickStyle }: { draft: Draft; update: (patch: Partial<Draft>) => void; onPickStyle: (u: UseCase) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [prodOpen, setProdOpen] = useState(false)
  const [url, setUrl] = useState('')

  const images = draft.product.images
  const setImages = (next: Draft['product']['images']) => update({ product: { ...draft.product, images: next, assetIds: next.map((i) => i.id) } })
  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true)
    const next = await ingestProductFiles(files, images)
    setImages(next)
    setBusy(false)
  }
  const removeImage = (id: string) => setImages(images.filter((i) => i.id !== id))
  const importUrl = () => {
    if (!url.trim() || images.length >= 4) return
    setImages([...images, importProductFromUrlStub(url.trim())])
    setUrl('')
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        .mp-urlrow { display: flex; align-items: center; gap: 12px; }
        .mp-url { flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: 12px; padding: 0 14px; height: 46px; transition: border-color .14s; }
        .mp-url:focus-within { border-color: var(--accent); }
        .mp-url input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: var(--text); font-size: 14px; font-family: var(--font); }
        .mp-or { font-size: 12.5px; color: var(--text-4); }
        .mp-select { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 18px; border-radius: 12px; border: none; background: var(--surface-3); color: var(--text); font-size: 13.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .mp-select:hover { background: var(--surface-2); }
        .mp-select .av { display: flex; }
        .mp-select .av img { width: 24px; height: 24px; border-radius: 6px; object-fit: cover; border: 1.5px solid var(--surface-3); margin-left: -8px; }
        .mp-select .av img:first-child { margin-left: 0; }

        .mp-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-3); margin-bottom: 9px; display: block; }
        .mp-prompt { width: 100%; min-height: 110px; background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: 14px; padding: 14px 16px; color: var(--text); font-size: 15px; line-height: 1.5; font-family: var(--font); resize: none; outline: none; transition: border-color .14s; }
        .mp-prompt:focus { border-color: var(--accent); }

        .mp-styles { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
        .mp-style { position: relative; flex: none; width: 168px; padding: 0; border-radius: 14px; overflow: hidden; border: 2px solid var(--border); background: var(--surface); cursor: pointer; transition: border-color .14s, transform .12s; text-align: left; }
        .mp-style:hover { transform: translateY(-2px); border-color: var(--border-strong); }
        .mp-style.sel { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .mp-style-check { position: absolute; top: 8px; right: 8px; z-index: 3; width: 20px; height: 20px; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .mp-style-cap { padding: 8px 10px 9px; font-size: 12.5px; font-weight: 600; color: var(--text); }

        .mp-overlay { position: fixed; inset: 0; z-index: 320; background: rgba(0,0,0,.55); backdrop-filter: blur(4px); display: grid; place-items: center; }
        .mp-pop { width: 520px; max-width: 92vw; background: var(--bg-elev); border: 1px solid var(--border-strong); border-radius: 18px; box-shadow: var(--shadow-lg); padding: 22px; display: flex; flex-direction: column; gap: 16px; animation: scaleIn .2s var(--ease); }
        .mp-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .mp-slot { position: relative; aspect-ratio: 1; border-radius: 11px; overflow: hidden; border: 1.5px dashed var(--border-strong); background: var(--surface-2); display: grid; place-items: center; cursor: pointer; transition: border-color .14s; }
        .mp-slot:hover { border-color: var(--accent); }
        .mp-slot.has { border-style: solid; border-color: var(--border-strong); background: #0a0a0c; }
        .mp-slot img { width: 100%; height: 100%; object-fit: cover; }
        .mp-slot-x { position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: 999px; background: rgba(0,0,0,.7); color: #fff; display: grid; place-items: center; border: none; cursor: pointer; }
      `}</style>

      {/* product source row */}
      <div className="mp-urlrow">
        <label className="mp-url">
          <Icon name="link" size={15} style={{ color: 'var(--text-4)' }} />
          <input placeholder="www.yourproduct.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') importUrl() }} />
          {url.trim() && <button onClick={importUrl} aria-label="Import" style={{ border: 'none', background: 'none', color: 'var(--accent-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="arrowRight" size={16} /></button>}
        </label>
        <span className="mp-or">or</span>
        <button className="mp-select" onClick={() => setProdOpen(true)}>
          {images.length > 0 && <span className="av">{images.slice(0, 3).map((im) => <img key={im.id} src={im.dataUrl} alt={im.name} />)}</span>}
          {images.length > 0 ? `${images.length} selected` : 'Select Product'}
        </button>
      </div>

      {/* prompt */}
      <div>
        <span className="mp-label">Enter Prompt</span>
        <textarea
          className="mp-prompt"
          placeholder="Describe your video, the product, the story, the vibe…"
          value={draft.product.description || ''}
          onChange={(e) => update({ product: { ...draft.product, description: e.target.value } })}
        />
      </div>

      {/* style */}
      <div>
        <span className="mp-label">Style</span>
        <div className="mp-styles">
          {USE_CASES.map((u) => {
            const on = draft.useCase === u.id
            return (
              <button key={u.id} className={`mp-style${on ? ' sel' : ''}`} onClick={() => onPickStyle(u.id)}>
                {on && <span className="mp-style-check"><Icon name="check" size={11} /></span>}
                <div style={{ aspectRatio: '1.5', background: '#0a0a0c', overflow: 'hidden' }}>
                  <video src={STYLE_VIDEO[u.id]} muted loop autoPlay playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <div className="mp-style-cap">{u.title}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* select-product popup */}
      {prodOpen && (
        <div className="mp-overlay" onMouseDown={() => setProdOpen(false)}>
          <div className="mp-pop" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>Select product <span style={{ color: 'var(--text-4)', fontWeight: 400, fontSize: 13 }}>· {images.length}/4</span></span>
              <button onClick={() => setProdOpen(false)} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={15} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: -6 }}>Upload images to use your product across every frame.</p>
            <div className="mp-slots">
              {Array.from({ length: 4 }).map((_, i) => {
                const im = images[i]
                if (im) return <div key={im.id} className="mp-slot has"><img src={im.dataUrl} alt={im.name} /><button className="mp-slot-x" onClick={() => removeImage(im.id)} aria-label="Remove"><Icon name="close" size={11} /></button></div>
                return <button key={`e${i}`} className="mp-slot" onClick={() => fileRef.current?.click()}>{busy && i === images.length ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Icon name="upload" size={18} style={{ color: 'var(--text-3)' }} />}</button>
              })}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(Array.from(e.target.files || []))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setProdOpen(false)} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#fff', color: '#0a0a0c', fontSize: 13.5, fontWeight: 650, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

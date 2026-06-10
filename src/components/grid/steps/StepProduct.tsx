import { useState } from 'react'
import type { Draft } from '../wizard'
import { importProductFromUrlStub } from '../wizard'
import type { UseCase } from '../../../spec'
import { USE_CASES } from '../../../spec'
import { Icon } from '../../Icon'
import { SelectProductModal } from './ProductLibrary'

// Real sample clips that play inside the Style cards.
const STYLE_VIDEO: Record<UseCase, string> = {
  saas_explainer: '/styles/saas-madison.mp4',
  physical_ad: '/styles/product-lipstick.mp4',
  pitch: '/styles/saas-spotify.mp4',
  app_launch: '/styles/product-mouse.mp4',
  brand_manifesto: '/styles/product-cutoutstyle.mp4',
}

// Step 1 — "Motion Studio": add the product (URL or Select Product library),
// describe the ad, and pick a style. Theme + canvas come on the next step.
export function StepProduct({ draft, update, onPickStyle }: { draft: Draft; update: (patch: Partial<Draft>) => void; onPickStyle: (u: UseCase) => void }) {
  const [prodOpen, setProdOpen] = useState(false)
  const [url, setUrl] = useState('')

  const images = draft.product.images
  const importUrl = () => {
    if (!url.trim() || images.length >= 4) return
    const next = [...images, importProductFromUrlStub(url.trim())]
    update({ product: { ...draft.product, images: next, assetIds: next.map((i) => i.id) } })
    setUrl('')
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        .mp-urlrow { display: flex; align-items: center; gap: 12px; }
        .mp-url { flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: 16px; padding: 0 14px; height: 46px; transition: border-color .14s; }
        .mp-url:focus-within { border-color: var(--accent); }
        .mp-url input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: var(--text); font-size: 15px; font-family: var(--font); }
        .mp-or { font-size: 14px; color: var(--text-3); }
        .mp-select { display: inline-flex; align-items: center; gap: 8px; height: 46px; padding: 0 18px; border-radius: 16px; border: none; background: var(--surface-3); color: var(--text); font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; font-family: var(--font-display); }
        .mp-select:hover { background: var(--surface-2); }
        .mp-select .av { display: flex; }
        .mp-select .av img { width: 24px; height: 24px; border-radius: 6px; object-fit: cover; border: 1.5px solid var(--surface-3); margin-left: -8px; }
        .mp-select .av img:first-child { margin-left: 0; }

        .mp-label { font-size: 12px; font-weight: 600; letter-spacing: .02em; color: var(--text-3); margin-bottom: 9px; display: block; }
        .mp-prompt { width: 100%; min-height: 110px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 20px; padding: 14px 16px; color: var(--text); font-size: 15px; line-height: 1.5; font-family: var(--font); resize: none; outline: none; transition: border-color .14s; }
        .mp-prompt:focus { border-color: var(--accent); }

        .mp-styles { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
        .mp-style { position: relative; flex: none; width: 168px; padding: 0; border-radius: 14px; overflow: hidden; border: 2px solid var(--border); background: var(--surface); cursor: pointer; transition: border-color .14s, transform .12s; text-align: left; }
        .mp-style:hover { transform: translateY(-2px); border-color: var(--border-strong); }
        .mp-style.sel { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .mp-style-check { position: absolute; top: 8px; right: 8px; z-index: 3; width: 20px; height: 20px; border-radius: 6px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .mp-style-cap { padding: 8px 10px 9px; font-size: 12.5px; font-weight: 600; color: var(--text); }
      `}</style>

      {/* product source row */}
      <div className="mp-urlrow">
        <label className="mp-url">
          <Icon name="link" size={16} style={{ color: 'var(--text-4)' }} />
          <input placeholder="www.yourproduct.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') importUrl() }} />
          {url.trim() && <button onClick={importUrl} aria-label="Import" style={{ border: 'none', background: 'none', color: 'var(--accent-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="arrowRight" size={16} /></button>}
        </label>
        <span className="mp-or">or</span>
        <button className="mp-select" onClick={() => setProdOpen(true)}>
          {images.length > 0 ? (
            <><span className="av">{images.slice(0, 3).map((im) => <img key={im.id} src={im.dataUrl} alt={im.name} />)}</span>{images.length} selected</>
          ) : 'Select Product'}
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

      <SelectProductModal open={prodOpen} draft={draft} update={update} onClose={() => setProdOpen(false)} />
    </div>
  )
}

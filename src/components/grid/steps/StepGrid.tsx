import { useEffect, useRef, useState } from 'react'
import type { GenSpec } from '../../../spec'
import { stubFrameVisual } from '../../../engine/stub'
import { TemplatePreview } from '../../cards'
import { Icon } from '../../Icon'

const RATIO: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 }

// Fit a ratio box inside its measured container (so the hero frame fills the
// available space without overflowing — works for wide and tall aspects alike).
function useFit(ratio: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      let w = width, h = w / ratio
      if (h > height) { h = height; w = h * ratio }
      setBox({ w: Math.round(w), h: Math.round(h) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ratio])
  return { ref, box }
}

// Storyboard review as a sliding gallery that fills the modal: a large hero
// frame with side nav, a per-frame control bar (reroll + prompt-to-reroll), and
// a filmstrip of captioned thumbnails. No grid, no side preview.
export function StepStoryboard({
  spec,
  gridNonce,
  frameNonces,
  activeIndex,
  onActiveIndex,
  onRegenerate,
  onPromptReroll,
  onRerollAll,
}: {
  spec: GenSpec
  gridNonce: number
  frameNonces: Record<string, number>
  activeIndex: number
  onActiveIndex: (i: number) => void
  onRegenerate: (id: string) => void
  onPromptReroll: (id: string, text: string) => void
  onRerollAll: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const frames = spec.frames
  const n = frames.length
  const idx = Math.max(0, Math.min(n - 1, activeIndex))
  const active = frames[idx]
  const ratio = RATIO[spec.canvas.aspect] || 16 / 9
  const { ref, box } = useFit(ratio)
  const go = (d: number) => onActiveIndex((idx + d + n) % n)
  const vis = active ? stubFrameVisual(active, spec.brand, spec, gridNonce, frameNonces[active.id] || 0) : null
  const submitPrompt = () => { if (active && prompt.trim()) { onPromptReroll(active.id, prompt.trim()); setPrompt('') } }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .gal-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
        .gal-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 46px; height: 46px; border-radius: 999px; border: 1px solid var(--border-strong); background: rgba(10,10,12,.72); backdrop-filter: blur(6px); color: #fff; display: grid; place-items: center; cursor: pointer; z-index: 6; transition: background .14s, transform .12s; }
        .gal-nav:hover { background: var(--accent); transform: translateY(-50%) scale(1.06); }
        .gal-badge { position: absolute; top: 14px; left: 14px; z-index: 5; display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px; background: rgba(10,10,12,.66); backdrop-filter: blur(6px); }
        .gal-badge b { font-family: var(--font-mono); font-size: 12px; color: #fff; }
        .gal-badge span { font-size: 12px; color: rgba(255,255,255,.7); }
        .gal-frame-reroll { position: absolute; top: 12px; right: 12px; z-index: 5; display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px; border: none; background: rgba(10,10,12,.72); backdrop-filter: blur(6px); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; opacity: 0; transition: opacity .14s, background .14s; }
        .gal-frame-wrap:hover .gal-frame-reroll { opacity: 1; }
        .gal-frame-reroll:hover { background: var(--accent); }
        .gal-allbtn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 11px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; }
        .gal-allbtn:hover { border-color: var(--accent); }
        .gal-bar { display: flex; gap: 10px; align-items: center; }
        .gal-input { flex: 1; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px; padding: 12px 14px; color: var(--text); font-size: 13.5px; font-family: var(--font); outline: none; transition: border-color .14s; }
        .gal-input:focus { border-color: var(--accent); }
        .gal-btn { display: inline-flex; align-items: center; gap: 7px; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); white-space: nowrap; }
        .gal-btn:hover { border-color: var(--accent); }
        .gal-btn.primary { border: none; background: var(--accent); color: #fff; }
        .gal-btn.primary:disabled { opacity: .45; cursor: default; }
        .gal-strip { display: flex; gap: 10px; overflow-x: auto; padding: 2px 2px 6px; }
        .gal-thumb { position: relative; flex: none; display: flex; flex-direction: column; gap: 6px; cursor: pointer; background: none; border: none; padding: 0; }
        .gal-thumb-art { position: relative; border-radius: 9px; overflow: hidden; border: 2px solid transparent; transition: border-color .14s, transform .12s; }
        .gal-thumb:hover .gal-thumb-art { transform: translateY(-2px); }
        .gal-thumb.sel .gal-thumb-art { border-color: var(--accent); }
        .gal-thumb-num { position: absolute; top: 5px; left: 5px; z-index: 3; min-width: 17px; height: 17px; padding: 0 5px; border-radius: 999px; background: rgba(10,10,12,.7); color: #fff; font-size: 10px; font-family: var(--font-mono); display: grid; place-items: center; }
        .gal-thumb-cap { font-size: 11px; color: var(--text-3); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; padding-left: 2px; }
        .gal-thumb.sel .gal-thumb-cap { color: var(--text); font-weight: 600; }
      `}</style>

      {/* Header + reroll-all */}
      <div className="gal-head">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>Storyboard</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 5 }}>{n} frames the model returned · hover a frame to reroll it, or reroll from a prompt.</p>
        </div>
        <button className="gal-allbtn" onClick={onRerollAll}><Icon name="refresh" size={15} /> Reroll all</button>
      </div>

      {/* Hero frame — grows to fill; per-frame reroll appears on hover */}
      <div ref={ref} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'grid', placeItems: 'center' }}>
        {n > 1 && <button className="gal-nav" style={{ left: 6 }} onClick={() => go(-1)} aria-label="Previous"><Icon name="chevLeft" size={22} /></button>}
        {active && vis && box.w > 0 && (
          <div className="gal-frame-wrap" style={{ position: 'relative', width: box.w, height: box.h, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', background: '#0a0a0c' }}>
            <span className="gal-badge"><b>{idx + 1}/{n}</b><span>{active.role}</span></span>
            <button className="gal-frame-reroll" onClick={() => onRegenerate(active.id)}><Icon name="refresh" size={14} /> Reroll</button>
            <TemplatePreview register={vis.register} palette={vis.palette} title={vis.title} kicker={vis.kicker} ratio={ratio} />
          </div>
        )}
        {n > 1 && <button className="gal-nav" style={{ right: 6 }} onClick={() => go(1)} aria-label="Next"><Icon name="chevRight" size={22} /></button>}
      </div>

      {/* Prompt reroll for the active frame */}
      {active && (
        <div className="gal-bar">
          <input
            className="gal-input"
            placeholder={`Reroll frame ${idx + 1} from a prompt — e.g. "swap background to deep navy, tighter crop"`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitPrompt() }}
          />
          <button className="gal-btn primary" disabled={!prompt.trim()} onClick={submitPrompt}><Icon name="sparkle" size={15} /> Reroll from prompt</button>
        </div>
      )}

      {/* Filmstrip */}
      <div className="gal-strip">
        {frames.map((f, i) => {
          const tv = stubFrameVisual(f, spec.brand, spec, gridNonce, frameNonces[f.id] || 0)
          const w = ratio >= 1 ? 150 : 70
          return (
            <button key={f.id} className={`gal-thumb${i === idx ? ' sel' : ''}`} style={{ width: w }} onClick={() => onActiveIndex(i)}>
              <div className="gal-thumb-art" style={{ aspectRatio: `${ratio}` }}>
                <span className="gal-thumb-num">{i + 1}</span>
                <TemplatePreview register={tv.register} palette={tv.palette} title={tv.title} kicker={tv.kicker} ratio={ratio} />
              </div>
              <span className="gal-thumb-cap" style={{ width: w }}>{f.role}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

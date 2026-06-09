import { useEffect, useRef, useState } from 'react'
import type { GenSpec } from '../../../spec'
import { stubFrameVisual } from '../../../engine/stub'
import { TemplatePreview } from '../../cards'
import { Icon } from '../../Icon'

const RATIO: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 }

// Fit a ratio box inside its measured container.
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

// Storyboard review — a large central frame flanked by round nav arrows, an
// inline edit/reroll row, and a captioned filmstrip. The modal shell supplies
// the heading; this owns the review surface.
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`
        .gal-stage { flex: 1; min-height: 0; display: flex; align-items: center; gap: 16px; }
        .gal-nav { flex: none; width: 48px; height: 48px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); display: grid; place-items: center; cursor: pointer; transition: background .14s, border-color .14s, transform .12s; }
        .gal-nav:hover { background: var(--accent); border-color: var(--accent); transform: scale(1.06); }
        .gal-stagebox { flex: 1; min-width: 0; height: 100%; display: grid; place-items: center; }
        .gal-frame-wrap { position: relative; border-radius: 16px; overflow: hidden; border: 1px solid var(--border-strong); box-shadow: var(--shadow-lg); background: #0a0a0c; }
        .gal-badge { position: absolute; top: 12px; left: 12px; z-index: 5; display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px; background: rgba(10,10,12,.66); backdrop-filter: blur(6px); }
        .gal-badge b { font-family: var(--font-mono); font-size: 12px; color: #fff; }
        .gal-badge span { font-size: 12px; color: rgba(255,255,255,.7); text-transform: capitalize; }
        .gal-frame-reroll { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); z-index: 5; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: none; background: rgba(10,10,12,.78); backdrop-filter: blur(6px); color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; opacity: 0; transition: opacity .14s, background .14s; }
        .gal-frame-wrap:hover .gal-frame-reroll { opacity: 1; }
        .gal-frame-reroll:hover { background: rgba(255,255,255,.18); }

        .gal-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-3); display: block; margin-bottom: 8px; }
        .gal-bar { display: flex; gap: 10px; align-items: center; }
        .gal-input { flex: 1; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px; padding: 12px 14px; color: var(--text); font-size: 13.5px; font-family: var(--font); outline: none; transition: border-color .14s; }
        .gal-input:focus { border-color: var(--accent); }
        .gal-btn { display: inline-flex; align-items: center; gap: 7px; padding: 12px 16px; border-radius: 12px; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); white-space: nowrap; }
        .gal-btn.primary { border: none; background: #fff; color: #0a0a0c; font-weight: 650; }
        .gal-btn.primary:disabled { background: var(--surface-2); color: var(--text-4); cursor: default; }

        .gal-striphead { display: flex; align-items: center; justify-content: space-between; }
        .gal-allbtn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); font-size: 12px; font-weight: 600; cursor: pointer; }
        .gal-allbtn:hover { border-color: var(--accent); color: var(--text); }
        .gal-strip { display: flex; align-items: flex-start; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; }
        .gal-join { flex: none; align-self: center; width: 22px; height: 22px; border-radius: 999px; background: var(--surface-3); color: var(--text-3); display: grid; place-items: center; margin-top: -14px; }
        .gal-thumb-reroll { position: absolute; top: 5px; right: 5px; z-index: 4; width: 20px; height: 20px; border-radius: 999px; border: none; background: rgba(10,10,12,.72); color: #fff; display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity .14s; }
        .gal-thumb:hover .gal-thumb-reroll { opacity: 1; }
        .gal-thumb { position: relative; flex: none; display: flex; flex-direction: column; gap: 6px; cursor: pointer; background: none; border: none; padding: 0; }
        .gal-thumb-art { position: relative; border-radius: 9px; overflow: hidden; border: 2px solid transparent; transition: border-color .14s, transform .12s; }
        .gal-thumb:hover .gal-thumb-art { transform: translateY(-2px); }
        .gal-thumb.sel .gal-thumb-art { border-color: var(--accent); }
        .gal-thumb-num { position: absolute; top: 5px; left: 5px; z-index: 3; min-width: 17px; height: 17px; padding: 0 5px; border-radius: 999px; background: rgba(10,10,12,.7); color: #fff; font-size: 10px; font-family: var(--font-mono); display: grid; place-items: center; }
        .gal-thumb-cap { font-size: 11px; color: var(--text-3); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; padding-left: 2px; text-transform: capitalize; }
        .gal-thumb.sel .gal-thumb-cap { color: var(--text); font-weight: 600; }
      `}</style>

      {/* Hero frame flanked by round nav arrows */}
      <div className="gal-stage">
        <button className="gal-nav" onClick={() => go(-1)} aria-label="Previous" disabled={n <= 1} style={{ visibility: n > 1 ? 'visible' : 'hidden' }}><Icon name="chevLeft" size={22} /></button>
        <div ref={ref} className="gal-stagebox">
          {active && vis && box.w > 0 && (
            <div className="gal-frame-wrap" style={{ width: box.w, height: box.h }}>
              <TemplatePreview register={vis.register} palette={vis.palette} title={vis.title} kicker={vis.kicker} ratio={ratio} />
              <button className="gal-frame-reroll" onClick={() => onRegenerate(active.id)}><Icon name="refresh" size={13} /> Reroll</button>
            </div>
          )}
        </div>
        <button className="gal-nav" onClick={() => go(1)} aria-label="Next" disabled={n <= 1} style={{ visibility: n > 1 ? 'visible' : 'hidden' }}><Icon name="chevRight" size={22} /></button>
      </div>

      {/* Edit / reroll-from-prompt row for the active frame */}
      {active && (
        <div>
          <span className="gal-label">Enter Prompt</span>
          <div className="gal-bar">
            <input
              className="gal-input"
              placeholder="Describe your idea for this frame…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitPrompt() }}
            />
            <button className="gal-btn primary" disabled={!prompt.trim()} onClick={submitPrompt}>Generate</button>
          </div>
        </div>
      )}

      {/* Filmstrip */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="gal-striphead">
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Frames</span>
          <button className="gal-allbtn" onClick={onRerollAll}><Icon name="refresh" size={13} /> Reroll all</button>
        </div>
        <div className="gal-strip">
          {frames.map((f, i) => {
            const tv = stubFrameVisual(f, spec.brand, spec, gridNonce, frameNonces[f.id] || 0)
            const w = ratio >= 1 ? 128 : 62
            return (
              <div key={f.id} style={{ display: 'contents' }}>
                {i > 0 && <span className="gal-join" aria-hidden><Icon name="plus" size={12} /></span>}
                <button className={`gal-thumb${i === idx ? ' sel' : ''}`} style={{ width: w }} onClick={() => onActiveIndex(i)}>
                  <div className="gal-thumb-art" style={{ aspectRatio: `${ratio}` }}>
                    <span className="gal-thumb-num">{i + 1}</span>
                    <button className="gal-thumb-reroll" onClick={(e) => { e.stopPropagation(); onRegenerate(f.id) }} aria-label="Reroll frame"><Icon name="refresh" size={11} /></button>
                    <TemplatePreview register={tv.register} palette={tv.palette} title={tv.title} kicker={tv.kicker} ratio={ratio} />
                  </div>
                  <span className="gal-thumb-cap" style={{ width: w }}>{f.role}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

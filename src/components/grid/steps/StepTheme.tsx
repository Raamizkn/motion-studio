import { useState } from 'react'
import type { Draft } from '../wizard'
import { themeToBrand } from '../wizard'
import type { GridAspect } from '../../../spec'
import { Icon } from '../../Icon'
import { ThemeModal } from '../../ThemeStudio'
import { useStore } from '../../../store'
import { BUILTIN_THEMES } from '../../../data'

const ASPECTS: GridAspect[] = ['16:9', '9:16', '1:1']
const FRAME_COUNTS = [4, 6, 9, 12]
const DURATIONS = [8, 10, 15, 20, 30]

// Grid label like the design's "3×3" when the count tiles squarely, else "N".
function frameLabel(n: number): string {
  const map: Record<number, string> = { 4: '2×2', 6: '2×3', 9: '3×3' }
  return map[n] || `${n}`
}

// Small dropdown "pill" used for the canvas controls.
function PillSelect<T extends string | number>({ icon, value, options, render, onChange }: { icon: string; value: T; options: T[]; render: (v: T) => string; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button className="th-pill" onClick={() => setOpen((o) => !o)}>
        <Icon name={icon} size={14} style={{ color: 'var(--text-3)' }} />
        <span>{render(value)}</span>
        <Icon name="chevDown" size={13} style={{ color: 'var(--text-4)' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
          <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 6, minWidth: 120, background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, animation: 'scaleIn .14s var(--ease)' }}>
            {options.map((o) => {
              const on = o === value
              return (
                <button key={String(o)} onClick={() => { onChange(o); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderRadius: 8, border: 'none', background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent-2)' : 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                  {render(o)}{on && <Icon name="check" size={13} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// Step 2 — "Choose a Theme": canvas controls (frames · aspect · duration) plus
// the theme specimen grid. The right preview shows the live typographic specimen.
export function StepTheme({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const userThemes = useStore((s) => s.userThemes)
  const allThemes = [...userThemes, ...BUILTIN_THEMES]
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
      <style>{`
        .th-ctrl { display: flex; gap: 10px; flex: none; }
        .th-pill { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; }
        .th-pill:hover { border-color: var(--accent); }

        .th-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 2px; align-content: start; }
        .th-card { position: relative; border-radius: 14px; overflow: hidden; border: 2px solid var(--border); background: #141417; cursor: pointer; transition: border-color .14s, transform .12s; display: flex; flex-direction: column; }
        .th-card:hover { transform: translateY(-2px); border-color: var(--border-strong); }
        .th-card.sel { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .th-check { position: absolute; top: 8px; right: 8px; z-index: 3; width: 20px; height: 20px; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .th-body { flex: 1; padding: 14px 14px 12px; display: flex; flex-direction: column; min-height: 104px; }
        .th-ico { display: inline-flex; }
        .th-meta { margin-top: auto; }
        .th-font { font-size: 13px; line-height: 1.2; color: var(--text-4); margin-bottom: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .th-name { font-size: 15px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--text); line-height: 1.05; }
        .th-strip { display: flex; height: 12px; }
        .th-strip i { flex: 1; }
        .th-create { align-items: center; justify-content: center; min-height: 116px; background: var(--surface); border-style: dashed; gap: 8px; }
      `}</style>

      {/* canvas controls */}
      <div className="th-ctrl">
        <PillSelect icon="layers" value={draft.frameCount} options={FRAME_COUNTS} render={(n) => frameLabel(n as number)} onChange={(n) => update({ frameCount: n as number })} />
        <PillSelect icon="image" value={draft.aspect} options={ASPECTS} render={(a) => String(a)} onChange={(a) => update({ aspect: a as GridAspect })} />
        <PillSelect icon="clock" value={draft.durationSec} options={DURATIONS} render={(d) => `${d}s`} onChange={(d) => update({ durationSec: d as number })} />
      </div>

      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-3)', flex: 'none' }}>Theme</span>

      {/* theme specimen grid */}
      <div className="th-grid">
        <button className="th-card th-create" onClick={() => setCreateOpen(true)}>
          <span style={{ color: 'var(--text-3)' }}><Icon name="plus" size={20} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Create Theme</span>
        </button>
        {allThemes.map((t) => {
          const sel = draft.brandThemeId === t.id
          const c = t.colors
          const strip = [c.primary, c.secondary, c.tertiary || c.accent || c.secondary, c.accent || c.primary]
          return (
            <button key={t.id} className={`th-card${sel ? ' sel' : ''}`} onClick={() => update({ brandThemeId: t.id, brand: themeToBrand(t) })}>
              {sel && <span className="th-check"><Icon name="check" size={11} /></span>}
              <div className="th-body">
                <span className="th-ico" style={{ color: c.accent || c.secondary }}><Squiggle /></span>
                <div className="th-meta">
                  <div className="th-font" style={{ fontFamily: `'${t.titleFont}', var(--font-display)` }}>{t.titleFont}</div>
                  <div className="th-name">{t.name}</div>
                </div>
              </div>
              <div className="th-strip">{strip.map((s, i) => <i key={i} style={{ background: s }} />)}</div>
            </button>
          )
        })}
      </div>

      {createOpen && (
        <ThemeModal onClose={() => setCreateOpen(false)} onSaved={(t) => { setCreateOpen(false); update({ brandThemeId: t.id, brand: themeToBrand(t) }) }} />
      )}
    </div>
  )
}

// Hand-drawn squiggle glyph for theme specimen cards.
function Squiggle() {
  return (
    <svg width={22} height={22} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19c3-9 7-9 9-2s6 7 9-3" />
    </svg>
  )
}

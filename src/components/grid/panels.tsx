import { useEffect, useRef, useState } from 'react'
import type { GenSpec } from '../../spec'
import { stubFrameVisual } from '../../engine/stub'
import { TemplatePreview } from '../cards'
import { Icon } from '../Icon'
import type { Draft } from './wizard'
import { AUDIO_PRESETS, Waveform } from './steps/StepAudio'

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

// Shared right-hand panel shell — a tall rounded surface the previews live in.
function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <aside style={{ width: 432, flex: 'none', borderRadius: 18, overflow: 'hidden', background: 'var(--bg)', border: '1px solid var(--border)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {children}
    </aside>
  )
}

// The persistent live preview. `view` follows the active step:
//  · product  → the hero product reference
//  · theme    → a typographic specimen showing how titles/copy read
//  · audio    → the selected soundtrack, visualised large
//  · frame    → frame[0] of the storyboard (during generation)
export function StudioPreview({ view, spec, draft, gridNonce = 0, dim = false }: { view: 'product' | 'theme' | 'audio' | 'frame'; spec: GenSpec; draft: Draft; gridNonce?: number; dim?: boolean }) {
  if (view === 'product') return <PreviewShell><ProductPreview draft={draft} spec={spec} gridNonce={gridNonce} /></PreviewShell>
  if (view === 'theme') return <PreviewShell><ThemePreview draft={draft} /></PreviewShell>
  if (view === 'audio') return <PreviewShell><AudioPreview draft={draft} /></PreviewShell>
  return <PreviewShell><FramePreview spec={spec} gridNonce={gridNonce} dim={dim} /></PreviewShell>
}

// ── product: big hero image (falls back to the live frame if none added) ──
function ProductPreview({ draft, spec, gridNonce }: { draft: Draft; spec: GenSpec; gridNonce: number }) {
  const images = draft.product.images
  if (!images.length) return <FramePreview spec={spec} gridNonce={gridNonce} dim={false} />
  const hero = images[0]
  return (
    <>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'grid', placeItems: 'center', padding: 20, background: 'radial-gradient(120% 90% at 50% 0%, #18181b, var(--bg))' }}>
        <img src={hero.dataUrl} alt={hero.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 14, objectFit: 'contain', boxShadow: 'var(--shadow-lg)' }} />
        {images.length > 1 && (
          <div style={{ position: 'absolute', right: 16, bottom: 60, display: 'flex' }}>
            {images.slice(1, 4).map((im, i) => (
              <span key={im.id} style={{ width: 40, height: 40, borderRadius: 9, overflow: 'hidden', border: '2px solid var(--bg)', marginLeft: i ? -12 : 0, boxShadow: 'var(--shadow-sm)', background: '#0a0a0c' }}>
                <img src={im.dataUrl} alt={im.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </span>
            ))}
          </div>
        )}
      </div>
      <MetaChip draft={draft} label={draft.brand.logoText?.trim() || 'Your product'} />
    </>
  )
}

// ── theme: typographic specimen in the selected brand's fonts/colors ──
function ThemePreview({ draft }: { draft: Draft }) {
  const b = draft.brand
  const c = b.colors
  const reg = (b.register || b.tone || 'editorial').toLowerCase()
  const regWord = reg.charAt(0).toUpperCase() + reg.slice(1)
  const initial = (b.logoText?.trim()?.charAt(0) || regWord.charAt(0)).toUpperCase()
  const swatches = [c.primary, c.secondary, c.accent || c.secondary, '#ffffff']
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: 30, background: c.surface || 'var(--bg)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', top: 16, right: 18, fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', color: c.secondary, opacity: .8 }}>PREVIEW</span>
      <span aria-hidden style={{ position: 'absolute', right: -40, bottom: -90, fontFamily: `'${b.titleFont}', var(--font-display)`, fontSize: 360, lineHeight: 1, fontWeight: 800, color: c.primary, opacity: .05, pointerEvents: 'none' }}>{initial}</span>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', color: c.secondary, fontFamily: `'${b.bodyFont}', var(--font)` }}>{(b.logoText || 'BRAND').toUpperCase()} · {regWord.toUpperCase()}</div>
      <div style={{ fontFamily: `'${b.titleFont}', var(--font-display)`, fontSize: 40, lineHeight: 1.04, fontWeight: 700, color: c.primary, letterSpacing: '-0.01em' }}>A {draft.durationSec}-second {reg} launch film</div>
      <div style={{ fontFamily: `'${b.bodyFont}', var(--font)`, fontSize: 14, lineHeight: 1.5, color: c.primary, opacity: .72, maxWidth: 320 }}>This is how your titles &amp; copy read across the storyboard.</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {swatches.map((s, i) => <span key={i} style={{ width: 26, height: 26, borderRadius: 7, background: s, border: '1px solid rgba(255,255,255,.14)' }} />)}
      </div>
    </div>
  )
}

// ── audio: the selected soundtrack visualised large ──
function AudioPreview({ draft }: { draft: Draft }) {
  const preset = AUDIO_PRESETS.find((a) => a.id === draft.audioId)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, padding: 28, background: 'radial-gradient(120% 80% at 50% 40%, #0c1f18, var(--bg))' }}>
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-strong)', background: '#070b09', padding: '34px 20px', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ transform: 'scaleY(2.6)' }}><Waveform seed={preset?.id || 'silent'} active /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 999, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--accent)', color: '#fff' }}><Icon name={preset ? 'pause' : 'audio'} size={16} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--text)' }}>{preset ? preset.name : 'No music'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{preset ? `${preset.mood} · ${preset.bpm} BPM` : 'Silent — model audio only'}</div>
        </div>
      </div>
    </div>
  )
}

// ── frame: live storyboard frame[0] ──
function FramePreview({ spec, gridNonce, dim }: { spec: GenSpec; gridNonce: number; dim: boolean }) {
  const ratio = RATIO[spec.canvas.aspect] || 16 / 9
  const { ref, box } = useFit(ratio)
  const f0 = spec.frames[0]
  const vis = f0 ? stubFrameVisual(f0, spec.brand, spec, gridNonce, 0) : null
  const images = spec.product.images
  return (
    <>
      <div ref={ref} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'grid', placeItems: 'center', padding: 22 }}>
        {vis && box.w > 0 && (
          <div style={{ width: box.w, height: box.h, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-md)', background: '#0a0a0c', opacity: dim ? 0.5 : 1, transition: 'opacity .3s' }}>
            <TemplatePreview register={vis.register} palette={vis.palette} title={vis.title} kicker={vis.kicker} ratio={ratio} />
          </div>
        )}
        {images.length > 0 && (
          <div style={{ position: 'absolute', right: 16, bottom: 60, display: 'flex' }}>
            {images.slice(0, 3).map((im, i) => (
              <span key={im.id} style={{ width: 38, height: 38, borderRadius: 9, overflow: 'hidden', border: '2px solid var(--bg)', marginLeft: i ? -12 : 0, boxShadow: 'var(--shadow-sm)', background: '#0a0a0c' }}>
                <img src={im.dataUrl} alt={im.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </span>
            ))}
          </div>
        )}
      </div>
      <MetaChip label={spec.brand.logoText?.trim() || 'Live preview'} aspect={`${spec.canvas.aspect} · ${spec.canvas.frameCount}f · ${spec.canvas.durationSec}s`} />
    </>
  )
}

function MetaChip({ draft, label, aspect }: { draft?: Draft; label: string; aspect?: string }) {
  const a = aspect ?? (draft ? `${draft.aspect} · ${draft.frameCount}f · ${draft.durationSec}s` : '')
  const initial = label.charAt(0).toUpperCase()
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 16px' }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent-grad)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 11, fontWeight: 800 }}>{initial || <Icon name="sparkle" size={12} />}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {a && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{a}</span>}
    </div>
  )
}

// On-brand generating state for the image / video phases. A shimmering headline
// over a skeleton of the prompt being assembled, with the phase checklist below.
export function GeneratingPanel({ title, phases, current, progress, error }: { title: string; phases: string[]; current: string; progress: number; error?: string | null }) {
  let idx = phases.findIndex((p) => p.toLowerCase() === (current || '').toLowerCase())
  if (idx < 0) idx = Math.min(phases.length - 1, Math.floor((progress / 100) * phases.length))
  const complete = progress >= 100
  const bars = [88, 64, 76, 52, 70]

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        @keyframes gp-text { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .gp-title { font-family: var(--font-display); font-weight: 600; font-size: 21px; line-height: 1.25;
          background: linear-gradient(90deg, var(--text-4) 0%, var(--text) 18%, var(--text-4) 40%, var(--text-4) 100%);
          background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          animation: gp-text 2.4s linear infinite; }
        .gp-bar { height: 16px; border-radius: 6px; }
        .gp-steps { display: flex; flex-direction: column; gap: 11px; }
        .gp-step { display: flex; align-items: center; gap: 11px; transition: opacity .3s; }
        .gp-dot { width: 22px; height: 22px; border-radius: 999px; flex: none; display: grid; place-items: center; }
      `}</style>

      <div style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
        <div className="gp-title">{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 2 }}>
          {bars.map((w, i) => <div key={i} className="gp-bar shimmer" style={{ width: `${w}%` }} />)}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!complete && !error && <span className="spinner" style={{ width: 16, height: 16 }} />}
          {complete && <span style={{ color: 'var(--green)' }}><Icon name="check" size={16} /></span>}
          {error && <span style={{ color: 'var(--red)' }}><Icon name="close" size={16} /></span>}
          <span style={{ fontSize: 13, fontWeight: 600, color: error ? 'var(--red)' : 'var(--text-2)' }}>
            {error ? error : `${Math.round(progress)}% · ${current || phases[idx] || 'Working'}`}
          </span>
        </div>
        <div className="gp-steps">
          {phases.map((p, i) => {
            const done = complete || i < idx
            const active = !complete && i === idx
            return (
              <div key={p} className="gp-step" style={{ opacity: done || active ? 1 : 0.42 }}>
                <div className="gp-dot" style={{ background: done ? 'var(--green)' : active ? 'var(--accent-soft)' : 'var(--surface-3)', color: done ? '#0a0a0c' : 'var(--accent-2)' }}>
                  {done ? <Icon name="check" size={12} /> : active ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--text-4)' }} />}
                </div>
                <span style={{ fontSize: 13, color: done || active ? 'var(--text)' : 'var(--text-3)' }}>{p}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

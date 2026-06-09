import type { Draft } from '../wizard'
import { Icon } from '../../Icon'

export interface AudioPreset { id: string; name: string; mood: string; bpm: number }

// System soundtrack presets (mirrors the 8 seeded audio presets in the spec).
export const AUDIO_PRESETS: AudioPreset[] = [
  { id: 'cinematic_dark', name: 'Cinematic Dark', mood: 'Tense · brooding', bpm: 80 },
  { id: 'upbeat_indie', name: 'Upbeat Indie', mood: 'Bright · bouncy', bpm: 120 },
  { id: 'calm_ambient', name: 'Calm Ambient', mood: 'Soft · airy', bpm: 70 },
  { id: 'driving_beat', name: 'Driving Beat', mood: 'Punchy · bold', bpm: 128 },
  { id: 'electronic_pulse', name: 'Electronic Pulse', mood: 'Synthy · modern', bpm: 124 },
  { id: 'soft_piano', name: 'Soft Piano', mood: 'Gentle · intimate', bpm: 68 },
  { id: 'runway_sleek', name: 'Runway Sleek', mood: 'Fashion · cool', bpm: 110 },
  { id: 'lofi_texture', name: 'Lo-Fi Texture', mood: 'Warm · hazy', bpm: 84 },
]

function h32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

// Deterministic little waveform from the preset id.
export function Waveform({ seed, active }: { seed: string; active: boolean }) {
  const n = 48
  let a = h32(seed)
  const bars = Array.from({ length: n }, (_, i) => {
    a = Math.imul(a ^ (a >>> 15), 1 | a) >>> 0
    const env = Math.sin((i / (n - 1)) * Math.PI) // taper edges
    return 0.16 + (0.84 * ((a % 1000) / 1000)) * (0.4 + 0.6 * env)
  })
  return (
    <svg viewBox={`0 0 ${n * 4} 40`} preserveAspectRatio="none" style={{ width: '100%', height: 40, display: 'block' }} aria-hidden>
      {bars.map((v, i) => {
        const hgt = Math.max(2, v * 36)
        return <rect key={i} x={i * 4 + 1} y={(40 - hgt) / 2} width={2.2} height={hgt} rx={1.1} fill={active ? '#42be65' : 'var(--text-4)'} />
      })}
    </svg>
  )
}

// Audio picker — a grid of waveform tiles. Selection is stored on the draft
// (mock — not wired to the stub video plan yet).
export function StepAudio({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const sel = draft.audioId
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
      <style>{`
        .au-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 12px; }
        .au-card { position: relative; text-align: left; padding: 0; border: none; background: none; cursor: pointer; display: flex; flex-direction: column; gap: 7px; }
        .au-tile { position: relative; aspect-ratio: 1; border-radius: 14px; overflow: hidden; border: 2px solid var(--border); background: radial-gradient(120% 90% at 50% 30%, #0d211a, #070b09); display: grid; place-items: center; padding: 14px; transition: border-color .14s, transform .12s; }
        .au-card:hover .au-tile { transform: translateY(-2px); border-color: var(--border-strong); }
        .au-card.sel .au-tile { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .au-check { position: absolute; top: 8px; right: 8px; z-index: 3; width: 20px; height: 20px; border-radius: 999px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .au-name { font-size: 12px; font-weight: 600; color: var(--text-2); padding-left: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .au-card.sel .au-name { color: var(--text); }
      `}</style>

      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-3)' }}>Audio</span>

      <div className="au-grid">
        {AUDIO_PRESETS.map((a) => {
          const on = sel === a.id
          return (
            <button key={a.id} className={`au-card${on ? ' sel' : ''}`} onClick={() => update({ audioId: a.id })}>
              <div className="au-tile">
                {on && <span className="au-check"><Icon name="check" size={11} /></span>}
                <div style={{ width: '100%', transform: 'scaleY(1.7)' }}><Waveform seed={a.id} active={on} /></div>
              </div>
              <span className="au-name">{a.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

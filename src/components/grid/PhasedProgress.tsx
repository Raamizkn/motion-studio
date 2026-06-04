import { Icon } from '../Icon'
import { ProgressBar } from '../shared'

// Phased progress for a grid/video job. Reuses the GenerateScreen gs-step look:
// a vertical list of named phases lighting up as the job's stage advances.
export function PhasedProgress({
  title,
  phases,
  current,
  progress,
  error,
}: {
  title: string
  phases: string[]
  current: string
  progress: number
  error?: string | null
}) {
  // the current phase index = the matching phase, else inferred from progress
  let idx = phases.findIndex((p) => p.toLowerCase() === (current || '').toLowerCase())
  if (idx < 0) idx = Math.min(phases.length - 1, Math.floor((progress / 100) * phases.length))
  const complete = progress >= 100

  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 420, maxWidth: '88%' }}>
        <style>{`
          .pp-steps { display: flex; flex-direction: column; gap: 13px; margin-top: 18px; }
          .pp-step { display: flex; align-items: center; gap: 12px; transition: opacity .3s; }
          .pp-dot { width: 24px; height: 24px; border-radius: 999px; flex: none; display: grid; place-items: center; }
          .pp-label { font-size: 13.5px; }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {!complete && !error && <span className="spinner" style={{ width: 20, height: 20 }} />}
          {complete && <span style={{ color: 'var(--green)' }}><Icon name="check" size={20} /></span>}
          {error && <span style={{ color: 'var(--red)' }}><Icon name="close" size={20} /></span>}
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: 'var(--text)' }}>{title}</span>
        </div>

        <div style={{ marginTop: 16 }}><ProgressBar pct={error ? 100 : progress} glow={!error} /></div>
        <div style={{ marginTop: 9, textAlign: 'center', fontSize: 12.5, color: error ? 'var(--red)' : 'var(--text-2)' }}>
          {error ? error : `${progress}% · ${current || phases[idx] || 'Working'}`}
        </div>

        <div className="pp-steps">
          {phases.map((p, i) => {
            const done = complete || i < idx
            const active = !complete && i === idx
            return (
              <div key={p} className="pp-step" style={{ opacity: done || active ? 1 : 0.4 }}>
                <div className="pp-dot" style={{ background: done ? 'var(--green)' : active ? 'var(--accent-soft)' : 'var(--surface-3)', color: done ? '#0a0a0c' : 'var(--accent-2)' }}>
                  {done ? <Icon name="check" size={13} /> : active ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--text-4)' }} />}
                </div>
                <span className="pp-label" style={{ color: done || active ? 'var(--text)' : 'var(--text-3)' }}>{p}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

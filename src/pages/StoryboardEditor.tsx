import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { ScenePreview, ASPECT_RATIO } from '../components/ScenePreview'
import { Icon } from '../components/Icon'
import { Modal, StatusBadge } from '../components/shared'
import { startRender } from '../render'
import type { StoryboardFrame, SceneKind } from '../types'
import { SCENE_LABELS } from '../scene'
import { generateStoryboardAI, regenerateFrameAI, aiStatus } from '../ai'

const GEN_STEPS = [
  'Scraping brand assets',
  'Detecting color palette and typography',
  'Writing scene narrative',
  'Composing frame HTML',
  'Finalizing storyboard',
]

export function StoryboardEditor() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const project = useStore((s) => s.projects.find((p) => p.id === id))
  const { renameProject, updateFrame, reorderFrames, addFrame, deleteFrame, setStatus } = useStore()

  const [generating, setGenerating] = useState(params.get('fresh') === '1')
  const [step, setStep] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [approved, setApproved] = useState(false)
  const [aiSource, setAiSource] = useState<'gemini' | 'fallback' | null>(null)

  // generation step feed + real Gemini call in parallel
  useEffect(() => {
    if (!generating || !project) return
    let cancelled = false
    let i = 0
    const stepTimer = setInterval(() => {
      if (cancelled) return
      i++
      setStep(i)
      if (i >= GEN_STEPS.length) clearInterval(stepTimer)
    }, 600)
    // call Gemini in parallel; replace frames when it arrives
    ;(async () => {
      const { frames, source } = await generateStoryboardAI(project.config)
      if (cancelled) return
      setAiSource(source)
      // wait for the step feed to finish so it doesn't disappear instantly
      const waitMs = Math.max(0, GEN_STEPS.length * 600 + 200 - 0)
      setTimeout(() => {
        if (cancelled) return
        useStore.getState().setFrames(project.id, frames)
        setGenerating(false)
      }, waitMs)
    })()
    return () => { cancelled = true; clearInterval(stepTimer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating, project?.id])

  if (!project) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        Project not found. <button className="btn" style={{ marginLeft: 10 }} onClick={() => nav('/studio')}>Back to Studio</button>
      </div>
    )
  }

  const ratio = ASPECT_RATIO[project.config.aspect]

  const onGenerateVideo = async () => {
    setConfirm(false)
    setStatus(project.id, 'rendering')
    try {
      await startRender(project)
    } catch (e) {
      console.error(e)
    }
    nav(`/studio/projects/${project.id}/editor?render=1`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <header style={topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button className="btn icon sm ghost" onClick={() => nav('/studio')} aria-label="Back"><Icon name="arrowLeft" size={16} /></button>
          <input
            value={project.name}
            onChange={(e) => renameProject(project.id, e.target.value)}
            style={{ background: 'none', border: 'none', fontSize: 15, fontWeight: 700, outline: 'none', minWidth: 80, maxWidth: 280 }}
          />
          <StatusBadge status={project.status} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--text-3)' }}>
          <span className="chip" style={{ cursor: 'default' }}><Icon name="clock" size={13} /> {project.config.durationSec}s</span>
          <span className="chip" style={{ cursor: 'default' }}>{project.config.aspect}</span>
          <span className="chip" style={{ cursor: 'default' }}>{project.frames.length} scenes</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn ghost sm" onClick={() => nav(`/studio/new`)}><Icon name="refresh" size={15} /> Regenerate</button>
          <button className="btn primary sm" disabled={!approved} onClick={() => setConfirm(true)}>
            Generate Video <Icon name="arrowRight" size={15} />
          </button>
        </div>
      </header>

      {generating ? (
        <GenerationFeed step={step} brand={!!project.config.brand} />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 40px' }}>
          {/* narrative summary */}
          <div className="card fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '9px 15px', marginBottom: 18 }}>
            <Icon name="sparkle" size={16} style={{ color: 'var(--accent-2)' }} />
            <span style={{ fontSize: 13 }}>
              <strong>{project.frames.length} scenes</strong> · {project.config.durationSec}s · {project.config.aspect} · {project.config.model} engine
            </span>
            {aiSource && (
              <span className="chip" style={{ height: 22, cursor: 'default', background: aiSource === 'gemini' ? 'var(--accent-soft)' : 'var(--surface-2)', borderColor: aiSource === 'gemini' ? 'var(--accent)' : 'var(--border)', color: aiSource === 'gemini' ? 'var(--accent-2)' : 'var(--text-3)', fontSize: 11 }}>
                {aiSource === 'gemini' ? 'AI · Gemini' : 'AI · local'}
              </span>
            )}
          </div>

          {/* frame row */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', overflowX: 'auto', paddingBottom: 16 }}>
            {project.frames.map((f, i) => (
              <FrameCard
                key={f.id}
                frame={f}
                ratio={ratio}
                onCopy={(lines) => updateFrame(project.id, f.id, { copy: lines, seed: { ...f.seed, lines, headline: f.seed.kind === 'hero' ? `*${lines[0]}*` : f.seed.headline } })}
                onRegenerate={async (prompt) => {
                  const { patch } = await regenerateFrameAI(f, prompt, project.config.palette)
                  updateFrame(project.id, f.id, patch)
                }}
                onDelete={() => deleteFrame(project.id, f.id)}
                onDuplicate={() => addFrame(project.id, i)}
                onReorder={(dir) => {
                  const ids = project.frames.map((x) => x.id)
                  const j = i + dir
                  if (j < 0 || j >= ids.length) return
                  ;[ids[i], ids[j]] = [ids[j], ids[i]]
                  reorderFrames(project.id, ids)
                }}
                isFirst={i === 0}
                isLast={i === project.frames.length - 1}
              />
            ))}
            {/* add frame ghost */}
            <button
              onClick={() => addFrame(project.id, project.frames.length - 1)}
              className="card"
              style={{ width: 120, flex: 'none', display: 'grid', placeItems: 'center', gap: 8, color: 'var(--text-3)', cursor: 'pointer', borderStyle: 'dashed' }}
            >
              <Icon name="plus" size={22} />
              <span style={{ fontSize: 12 }}>Add scene</span>
            </button>
          </div>

          {/* approval gate */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>How does this look?</span>
            <button className={`btn sm ${approved ? 'primary' : ''}`} onClick={() => setApproved(true)}>
              <Icon name="check" size={15} /> Looks good
            </button>
            <button className="btn sm ghost" onClick={() => nav('/studio/new')}><Icon name="refresh" size={14} /> Regenerate all</button>
          </div>
        </div>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Ready to render?"
        footer={
          <>
            <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn primary" onClick={onGenerateVideo}><Icon name="sparkle" size={15} /> Render video</button>
          </>
        }
      >
        <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
          <strong>{project.frames.length} frames</strong> · {project.config.durationSec}s · {project.config.quality} quality.
          <br />
          Kinetic will render real frames in headless Chrome and encode to MP4.
          <br />
          Estimated render time: <strong>~{Math.ceil(project.config.durationSec * 1.7)}s</strong>.
        </p>
      </Modal>
    </div>
  )
}

const topBar: React.CSSProperties = {
  height: 56,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '0 20px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-elev)',
}

function GenerationFeed({ step, brand }: { step: number; brand: boolean }) {
  const steps = brand ? GEN_STEPS : GEN_STEPS.slice(2)
  return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 460, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div className="spinner" style={{ width: 22, height: 22 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Building your storyboard</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Powered by Kinetic</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((s, i) => {
            const done = i < step
            const active = i === step
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 11, opacity: done || active ? 1 : 0.4, transition: 'opacity .3s' }}>
                <div style={{ width: 20, height: 20, borderRadius: 99, display: 'grid', placeItems: 'center', background: done ? 'var(--green)' : active ? 'var(--accent-soft)' : 'var(--surface-2)', color: done ? '#0a0a0c' : 'var(--accent-2)', flex: 'none' }}>
                  {done ? <Icon name="check" size={13} /> : active ? <span className="spinner" style={{ width: 12, height: 12 }} /> : null}
                </div>
                <span style={{ fontSize: 13.5, color: done || active ? 'var(--text)' : 'var(--text-3)' }}>{s}</span>
              </div>
            )
          })}
        </div>
        <div className="card" style={{ marginTop: 22, padding: 14, fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-2)' }}>What is Kinetic?</strong> The engine renders video from HTML/CSS scenes — every element a DOM node with motion. It plans your narrative, writes scene copy, then composes animated frames you can edit before rendering.
        </div>
      </div>
    </div>
  )
}

// ── Frame card ──────────────────────────────────────────────────────────────
function FrameCard({
  frame,
  ratio,
  onCopy,
  onRegenerate,
  onDelete,
  onDuplicate,
  onReorder,
  isFirst,
  isLast,
}: {
  frame: StoryboardFrame
  ratio: number
  onCopy: (lines: string[]) => void
  onRegenerate: (prompt: string) => void | Promise<void>
  onDelete: () => void
  onDuplicate: () => void
  onReorder: (dir: number) => void
  isFirst: boolean
  isLast: boolean
}) {
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const copyRef = useRef<string[]>(frame.copy)

  const submit = async () => {
    if (!prompt.trim()) return
    setBusy(true)
    try { await onRegenerate(prompt) } finally { setPrompt(''); setBusy(false) }
  }

  return (
    <div
      className="card"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setMenu(false) }}
      style={{ width: 300, flex: 'none', display: 'flex', flexDirection: 'column', overflow: 'visible', position: 'relative' }}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>{String(frame.index + 1).padStart(2, '0')}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{frame.start}–{frame.end}s</span>
        <span style={{ fontSize: 11, color: 'var(--accent-2)', marginLeft: 4 }}>{SCENE_LABELS[frame.kind]}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, opacity: hover ? 1 : 0, transition: 'opacity .15s' }}>
          <button className="btn icon sm ghost" disabled={isFirst} onClick={() => onReorder(-1)} aria-label="Move left"><Icon name="chevLeft" size={14} /></button>
          <button className="btn icon sm ghost" disabled={isLast} onClick={() => onReorder(1)} aria-label="Move right"><Icon name="chevRight" size={14} /></button>
          <button className="btn icon sm ghost" onClick={() => setMenu((m) => !m)} aria-label="More"><Icon name="grip" size={14} /></button>
        </div>
        {menu && (
          <div className="card" style={{ position: 'absolute', top: 38, right: 10, zIndex: 30, padding: 5, width: 140, background: 'var(--bg-elev)', boxShadow: 'var(--shadow-pop)' }}>
            {[{ l: 'Duplicate', f: onDuplicate }, { l: 'Delete', f: onDelete, d: true }].map((a) => (
              <button key={a.l} onClick={() => { a.f(); setMenu(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 9px', borderRadius: 6, fontSize: 12.5, color: a.d ? 'var(--red)' : 'var(--text)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{a.l}</button>
            ))}
          </div>
        )}
      </div>

      {/* preview */}
      <div style={{ position: 'relative', margin: '0 12px', borderRadius: 12, overflow: 'hidden' }}>
        <ScenePreview seed={frame.seed} ratio={ratio} rounded={12} />
        {busy && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.5)' }}><span className="spinner" /></div>}
      </div>

      {/* editable copy */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        {frame.copy.map((line, i) => (
          <div
            key={i}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => {
              const lines = [...copyRef.current]
              lines[i] = e.currentTarget.textContent || ''
              copyRef.current = lines
              onCopy(lines)
            }}
            style={{ fontSize: i === 0 ? 14 : 12.5, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--text)' : 'var(--text-3)', outline: 'none', borderRadius: 4, padding: '1px 3px' }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* per-frame prompt */}
      <div style={{ display: 'flex', gap: 6, padding: '0 12px 12px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 9px', height: 32 }}>
          <Icon name="sparkle" size={13} style={{ color: 'var(--lime)' }} />
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Edit this frame…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12 }} />
        </div>
        <button className="btn icon sm" onClick={submit} aria-label="Apply"><Icon name="arrowRight" size={14} /></button>
      </div>
    </div>
  )
}

// deterministic "regenerate" — interpret a few keywords, else cycle scene kind
function regenFrame(frame: StoryboardFrame, prompt: string): Partial<StoryboardFrame> {
  const p = prompt.toLowerCase()
  const order: SceneKind[] = ['hero', 'cards', 'showcase', 'split', 'quote', 'globe', 'logo', 'cta']
  let kind = frame.kind
  for (const k of order) if (p.includes(k) || (k === 'cards' && p.includes('card')) || (k === 'cta' && p.includes('call'))) kind = k
  if (kind === frame.kind) kind = order[(order.indexOf(frame.kind) + 1) % order.length]
  const newCopy = prompt.length > 4 && !order.some((k) => p.includes(k))
    ? prompt.split(/[.,]/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
    : frame.copy
  return {
    kind,
    title: SCENE_LABELS[kind],
    copy: newCopy.length ? newCopy : frame.copy,
    seed: { ...frame.seed, kind, lines: newCopy.length ? newCopy : frame.seed.lines, headline: kind === 'hero' ? `*${newCopy[0] || frame.seed.headline.replace(/\*/g, '')}*` : (newCopy[0] || frame.seed.headline) },
  }
}

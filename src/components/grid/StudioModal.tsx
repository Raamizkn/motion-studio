import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GenSpec, UseCase } from '../../spec'
import { useCaseDef } from '../../spec'
import { stubVideoPlan, hashStr } from '../../engine/stub'
import { startGridImage, startGridVideo, pollGrid, IMAGE_PHASES, VIDEO_PHASES } from '../../grid'
import { useStore } from '../../store'
import { Icon } from '../Icon'
import { StudioPreview, GeneratingPanel } from './panels'
import { StepProduct } from './steps/StepProduct'
import { StepTheme } from './steps/StepTheme'
import { StepAudio } from './steps/StepAudio'
import { StepStoryboard } from './steps/StepGrid'
import type { Draft } from './wizard'
import { initialDraft, applyUseCase, buildSpec } from './wizard'

type Screen = 'product' | 'theme' | 'audio' | 'storyboard' | 'done'
type JobState = { status: 'rendering' | 'complete' | 'error'; progress: number; stage: string; error?: string | null }

export function StudioModal({ open, onClose, initialUseCase }: { open: boolean; onClose: () => void; initialUseCase?: UseCase }) {
  const nav = useNavigate()
  const createGridProject = useStore((s) => s.createGridProject)
  const setVideoPlan = useStore((s) => s.setVideoPlan)
  const setStatus = useStore((s) => s.setStatus)

  const [draft, setDraft] = useState<Draft>(() => initialDraft(initialUseCase))
  const [screen, setScreen] = useState<Screen>('product')
  const [committedSpec, setCommittedSpec] = useState<GenSpec | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [gridNonce, setGridNonce] = useState(0)
  const [frameNonces, setFrameNonces] = useState<Record<string, number>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'image' | 'video'>('idle')
  const [imageJob, setImageJob] = useState<JobState | null>(null)
  const [videoJob, setVideoJob] = useState<JobState | null>(null)
  const stopRef = useRef<() => void>(() => {})

  // reset when (re)opened
  useEffect(() => {
    if (!open) return
    setDraft(initialDraft(initialUseCase))
    setScreen('product')
    setCommittedSpec(null)
    setProjectId(null)
    setGridNonce(0)
    setFrameNonces({})
    setActiveIndex(0)
    setPhase('idle')
    setImageJob(null)
    setVideoJob(null)
  }, [open, initialUseCase])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { stopRef.current(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => stopRef.current(), [])

  // land in the editor once the video is done (must run before any early return)
  useEffect(() => {
    if (!open || screen !== 'done' || !projectId) return
    const t = setTimeout(() => { onClose(); nav(`/studio/projects/${projectId}/result`) }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screen, projectId])

  const liveSpec = useMemo(() => buildSpec(draft), [draft])
  const activeSpec = committedSpec ?? liveSpec
  const name = draft.brand.logoText?.trim() || useCaseDef(draft.useCase).title

  if (!open) return null

  const handleClose = () => { stopRef.current(); onClose() }
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const runImageJob = (id: string, spec: GenSpec) => {
    setPhase('image')
    setImageJob({ status: 'rendering', progress: 0, stage: IMAGE_PHASES[0] })
    startGridImage(id, spec).catch(() => {})
    stopRef.current()
    stopRef.current = pollGrid(id, 'image', (s) => {
      setImageJob({ status: s.status === 'unknown' ? 'error' : s.status, progress: s.progress, stage: s.stage, error: s.error })
      if (s.status === 'complete') setPhase('idle')
    })
  }

  // ── Stage D: generate the storyboard (from the Audio step) ──
  const handleGenerateGrid = () => {
    const spec = buildSpec(draft)
    const project = createGridProject(name, spec)
    setProjectId(project.id)
    setCommittedSpec(spec)
    setActiveIndex(0)
    setScreen('storyboard')
    runImageJob(project.id, spec)
  }

  const handleRegenerate = (id: string) => setFrameNonces((m) => ({ ...m, [id]: (m[id] || 0) + 1 }))
  const handlePromptReroll = (id: string, text: string) => setFrameNonces((m) => ({ ...m, [id]: hashStr(text) }))

  // Reroll the whole storyboard — bump the grid seed and re-run the phased job.
  const handleRerollAll = () => {
    if (!projectId || !committedSpec) return
    setGridNonce((n) => n + 1)
    setFrameNonces({})
    runImageJob(projectId, committedSpec)
  }

  // ── Stage F: generate the final video ──
  const handleGenerateVideo = () => {
    if (!projectId || !committedSpec) return
    const plan = stubVideoPlan(committedSpec)
    setVideoPlan(projectId, plan)
    setPhase('video')
    setVideoJob({ status: 'rendering', progress: 0, stage: VIDEO_PHASES[0] })
    startGridVideo(projectId, committedSpec, plan).catch(() => {})
    stopRef.current()
    stopRef.current = pollGrid(projectId, 'video', (s) => {
      setVideoJob({ status: s.status === 'unknown' ? 'error' : s.status, progress: s.progress, stage: s.stage, error: s.error })
      if (s.status === 'complete') { setStatus(projectId, 'complete'); setPhase('idle'); setScreen('done') }
    })
  }

  const busy = phase !== 'idle'
  const promptReady = !!draft.product.description?.trim()

  // contextual header copy
  const SUB = 'Add product, describe it, pick a style and theme then create the storyboard.'
  const head = (() => {
    if (phase === 'image') return { title: 'Generating your storyboard', sub: `${Math.round(imageJob?.progress || 0)}% · ${imageJob?.stage || 'Working'}` }
    if (phase === 'video') return { title: 'Generating your video', sub: `${Math.round(videoJob?.progress || 0)}% · ${videoJob?.stage || 'Working'}` }
    if (screen === 'product') return { title: 'Motion Studio', sub: SUB }
    if (screen === 'theme') return { title: 'Choose a Theme', sub: SUB }
    if (screen === 'audio') return { title: 'Add Audio', sub: SUB }
    if (screen === 'storyboard') return { title: 'Storyboard', sub: `${activeSpec.frames.length} frames the model returned · hover a frame to reroll it, or reroll from a prompt.` }
    return { title: 'Your video is ready', sub: 'Opening the editor…' }
  })()

  // footer: ghost (cancel/back) + solid primary, right-aligned
  type Foot = { primary: string; onPrimary: () => void; disabled?: boolean; hint?: string; ghost: string; onGhost: () => void } | null
  const footer: Foot = (() => {
    if (busy || screen === 'done') return null
    if (screen === 'product') return { ghost: 'Cancel', onGhost: handleClose, primary: 'Continue', onPrimary: () => setScreen('theme'), disabled: !promptReady, hint: 'Describe your ad to continue' }
    if (screen === 'theme') return { ghost: 'Back', onGhost: () => setScreen('product'), primary: 'Continue', onPrimary: () => setScreen('audio') }
    if (screen === 'audio') return { ghost: 'Back', onGhost: () => setScreen('theme'), primary: 'Generate Storyboard', onPrimary: handleGenerateGrid }
    if (screen === 'storyboard') return { ghost: 'Back', onGhost: () => setScreen('audio'), primary: 'Generate Video', onPrimary: handleGenerateVideo }
    return null
  })()

  // two-column steps share the persistent preview; storyboard + done are full-width
  const twoCol = busy || screen === 'product' || screen === 'theme' || screen === 'audio'
  const previewView: 'product' | 'theme' | 'audio' | 'frame' = busy ? 'frame' : screen === 'theme' ? 'theme' : screen === 'audio' ? 'audio' : 'product'

  const leftContent = () => {
    if (phase === 'image') return <GeneratingPanel title="Assembling your mega-prompt…" phases={IMAGE_PHASES} current={imageJob?.stage || ''} progress={imageJob?.progress || 0} error={imageJob?.error} />
    if (phase === 'video') return <GeneratingPanel title="Composing your video…" phases={VIDEO_PHASES} current={videoJob?.stage || ''} progress={videoJob?.progress || 0} error={videoJob?.error} />
    if (screen === 'product') return <StepProduct draft={draft} update={update} onPickStyle={(u) => setDraft((d) => applyUseCase(d, u))} />
    if (screen === 'theme') return <StepTheme draft={draft} update={update} />
    if (screen === 'audio') return <StepAudio draft={draft} update={update} />
    return null
  }

  return (
    <div
      onMouseDown={handleClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeUp .2s ease' }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: '90vw', height: '88vh', maxWidth: 1180, maxHeight: 820, background: 'var(--bg-elev)', borderRadius: 28, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'scaleIn .22s var(--ease)', padding: 24 }}
      >
        {/* header: heading + subhead, close top-right */}
        <header style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 27, lineHeight: 1.15, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>{head.title}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '6px 0 0' }}>{head.sub}</p>
          </div>
          <button onClick={handleClose} aria-label="Close" style={{ flex: 'none', width: 38, height: 38, borderRadius: 999, border: 'none', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={18} /></button>
        </header>

        {/* body */}
        <main style={{ flex: 1, minHeight: 0, margin: '24px 0', display: 'flex', gap: 24 }}>
          {twoCol ? (
            <>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>{leftContent()}</div>
              <StudioPreview view={previewView} spec={activeSpec} draft={draft} gridNonce={gridNonce} dim={phase === 'video'} />
            </>
          ) : screen === 'storyboard' ? (
            <div style={{ flex: 1, minWidth: 0 }}>
              <StepStoryboard
                spec={activeSpec}
                gridNonce={gridNonce}
                frameNonces={frameNonces}
                activeIndex={activeIndex}
                onActiveIndex={setActiveIndex}
                onRegenerate={handleRegenerate}
                onPromptReroll={handlePromptReroll}
                onRerollAll={handleRerollAll}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ width: 60, height: 60, borderRadius: 999, background: 'var(--green)', color: '#0a0a0c', display: 'grid', placeItems: 'center', margin: '0 auto 18px', animation: 'scaleIn .3s var(--ease)' }}><Icon name="check" size={30} /></span>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 22, color: 'var(--text)' }}>All done</div>
                <div style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6 }}>Taking you to the editor…</div>
              </div>
            </div>
          )}
        </main>

        {/* footer: ghost + solid primary, right-aligned */}
        {footer && (
          <footer style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
            {footer.disabled && footer.hint && <span style={{ fontSize: 12.5, color: 'var(--text-4)', marginRight: 'auto' }}>{footer.hint}</span>}
            <button onClick={footer.onGhost} style={{ height: 44, padding: '0 22px', borderRadius: 14, border: 'none', background: 'var(--surface-3)', color: 'var(--text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>{footer.ghost}</button>
            <button
              onClick={footer.disabled ? undefined : footer.onPrimary}
              disabled={footer.disabled}
              style={{ height: 44, padding: '0 28px', borderRadius: 14, border: 'none', background: footer.disabled ? 'var(--surface-3)' : '#fff', color: footer.disabled ? 'var(--text-4)' : '#0a0a0c', fontSize: 14.5, fontWeight: 650, cursor: footer.disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', transition: 'background .14s, color .14s' }}
            >
              {footer.primary}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}

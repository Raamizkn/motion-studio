import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GenSpec, UseCase } from '../../spec'
import { useCaseDef } from '../../spec'
import { stubVideoPlan, hashStr } from '../../engine/stub'
import { startGridImage, startGridVideo, pollGrid, IMAGE_PHASES, VIDEO_PHASES } from '../../grid'
import { useStore } from '../../store'
import { Icon } from '../Icon'
import { PhasedProgress } from './PhasedProgress'
import { StepSetup } from './steps/StepSetup'
import { StepStoryboard } from './steps/StepGrid'
import type { Draft } from './wizard'
import { initialDraft, applyUseCase, buildSpec } from './wizard'

type Screen = 'setup' | 'storyboard' | 'done'
type JobState = { status: 'rendering' | 'complete' | 'error'; progress: number; stage: string; error?: string | null }

export function StudioModal({ open, onClose, initialUseCase }: { open: boolean; onClose: () => void; initialUseCase?: UseCase }) {
  const nav = useNavigate()
  const createGridProject = useStore((s) => s.createGridProject)
  const setVideoPlan = useStore((s) => s.setVideoPlan)
  const setStatus = useStore((s) => s.setStatus)

  const [draft, setDraft] = useState<Draft>(() => initialDraft(initialUseCase))
  const [screen, setScreen] = useState<Screen>('setup')
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
    setScreen('setup')
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
    const t = setTimeout(() => { onClose(); nav(`/studio/projects/${projectId}/result`) }, 1100)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, screen, projectId])

  const liveSpec = useMemo(() => buildSpec(draft), [draft])
  const activeSpec = committedSpec ?? liveSpec
  const name = draft.brand.logoText?.trim() || useCaseDef(draft.useCase).title

  if (!open) return null

  const handleClose = () => { stopRef.current(); onClose() }
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  // ── Stage D: generate the storyboard (model returns the split frames) ──
  const handleGenerateGrid = () => {
    const spec = buildSpec(draft)
    const project = createGridProject(name, spec)
    setProjectId(project.id)
    setCommittedSpec(spec)
    setActiveIndex(0)
    setScreen('storyboard')
    setPhase('image')
    setImageJob({ status: 'rendering', progress: 0, stage: IMAGE_PHASES[0] })
    startGridImage(project.id, spec).catch(() => {})
    stopRef.current()
    stopRef.current = pollGrid(project.id, 'image', (s) => {
      setImageJob({ status: s.status === 'unknown' ? 'error' : s.status, progress: s.progress, stage: s.stage, error: s.error })
      if (s.status === 'complete') setPhase('idle')
    })
  }

  const handleRegenerate = (id: string) => setFrameNonces((m) => ({ ...m, [id]: (m[id] || 0) + 1 }))
  const handlePromptReroll = (id: string, text: string) => setFrameNonces((m) => ({ ...m, [id]: hashStr(text) }))

  // Reroll the whole storyboard — bump the grid seed and re-run the phased job.
  const handleRerollAll = () => {
    if (!projectId || !committedSpec) return
    setGridNonce((n) => n + 1)
    setFrameNonces({})
    setPhase('image')
    setImageJob({ status: 'rendering', progress: 0, stage: IMAGE_PHASES[0] })
    startGridImage(projectId, committedSpec).catch(() => {})
    stopRef.current()
    stopRef.current = pollGrid(projectId, 'image', (s) => {
      setImageJob({ status: s.status === 'unknown' ? 'error' : s.status, progress: s.progress, stage: s.stage, error: s.error })
      if (s.status === 'complete') setPhase('idle')
    })
  }

  // ── Stage F: generate the final video (no planning screen — straight to it) ──
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
  const footer = (() => {
    if (screen === 'done' || busy) return null
    if (screen === 'setup') return { primary: 'Generate storyboard', icon: 'sparkle', onPrimary: handleGenerateGrid, back: false as const }
    if (screen === 'storyboard') return { primary: 'Generate video', icon: 'film', onPrimary: handleGenerateVideo, back: true as const }
    return null
  })()

  return (
    <div
      onMouseDown={handleClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeUp .2s ease' }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: '90vw', height: '90vh', maxWidth: 1500, maxHeight: 980, background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 20, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'scaleIn .22s var(--ease)' }}
      >
        {/* header */}
        <header style={{ flex: 'none', height: 60, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent-grad)', display: 'grid', placeItems: 'center', color: '#fff' }}><Icon name="sparkle" size={16} /></span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>Vibe Motion Studio</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-4)' }}>Stubbed preview · models wire in later</span>
          <button onClick={handleClose} aria-label="Close" style={{ marginLeft: 14, width: 34, height: 34, borderRadius: 999, border: 'none', background: 'var(--surface-3)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={16} /></button>
        </header>

        {/* body */}
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 32px' }}>
          {phase === 'image' ? (
            <PhasedProgress title="Generating your storyboard" phases={IMAGE_PHASES} current={imageJob?.stage || ''} progress={imageJob?.progress || 0} error={imageJob?.error} />
          ) : phase === 'video' ? (
            <PhasedProgress title="Generating your video" phases={VIDEO_PHASES} current={videoJob?.stage || ''} progress={videoJob?.progress || 0} error={videoJob?.error} />
          ) : screen === 'setup' ? (
            <StepSetup draft={draft} update={update} onPickStyle={(u) => setDraft((d) => applyUseCase(d, u))} />
          ) : screen === 'storyboard' ? (
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
          ) : screen === 'done' ? (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--green)', color: '#0a0a0c', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}><Icon name="check" size={28} /></span>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: 'var(--text)' }}>Your video is ready</div>
                <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6 }}>Opening the editor…</div>
              </div>
            </div>
          ) : null}
        </main>

        {/* footer */}
        {footer && (
          <footer style={{ flex: 'none', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderTop: '1px solid var(--border)' }}>
            <div>
              {footer.back && (
                <button onClick={() => setScreen('setup')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                  <Icon name="arrowLeft" size={15} /> Back
                </button>
              )}
            </div>
            <button
              onClick={footer.onPrimary}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, border: 'none', background: 'var(--accent-grad)', color: '#fff', fontSize: 14.5, fontWeight: 650, cursor: 'pointer', boxShadow: '0 4px 18px var(--accent-glow)' }}
            >
              <Icon name={footer.icon as any} size={16} />
              {footer.primary}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}

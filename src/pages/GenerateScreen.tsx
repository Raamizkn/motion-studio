import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { DirectorView, Skeleton } from '../components/DirectorView'
import { composeVideoAI, generateNarrationAI } from '../ai'
import { startRender, pollRender } from '../render'
import { BUILTIN_THEMES } from '../data'

/**
 * Prompt → video pipeline (no storyboard). Renders the full director workspace
 * with the assist panel intact and the stage/timeline/drawer as skeletons while
 * Claude composes and the renderer runs. Hands off to the editor when ready.
 */

type Phase = 'compose' | 'render' | 'done' | 'error'

const STEPS = [
  { key: 'script', label: 'Writing the script & scene narrative' },
  { key: 'design', label: 'Designing the visual system' },
  { key: 'motion', label: 'Composing scenes, motion & transitions' },
  { key: 'render', label: 'Rendering frames in headless Chrome' },
  { key: 'encode', label: 'Encoding your MP4' },
]

export function GenerateScreen() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const project = useStore((s) => s.projects.find((p) => p.id === id))
  const setStatus = useStore((s) => s.setStatus)
  const setComposedHtml = useStore((s) => s.setComposedHtml)
  const setNarration = useStore((s) => s.setNarration)
  const userThemes = useStore((s) => s.userThemes)

  const [phase, setPhase] = useState<Phase>('compose')
  const [stepIdx, setStepIdx] = useState(0)
  const [renderPct, setRenderPct] = useState(0)
  const [summary, setSummary] = useState('')
  const [usedFallback, setUsedFallback] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!project || started.current) return
    started.current = true
    let stopPoll = () => {}

    let tick = 0
    const ticker = setInterval(() => {
      tick++
      setStepIdx((i) => (i < 2 ? Math.min(2, i + 1) : i))
      if (tick > 8) clearInterval(ticker)
    }, 2600)

    ;(async () => {
      try {
        setStatus(project.id, 'composing')
        const theme = project.config.themeId
          ? [...userThemes, ...BUILTIN_THEMES].find((t) => t.id === project.config.themeId)
          : undefined
        const media = (project.config.assets || [])
          .map((a) => a.dataUrl)
          .filter((u): u is string => typeof u === 'string' && /^(https?:|data:)/.test(u))

        const result = await composeVideoAI({
          prompt: project.config.prompt,
          flow: project.config.flow,
          aspect: project.config.aspect,
          durationSec: project.config.durationSec,
          palette: project.config.palette,
          brand: project.config.brand,
          theme: theme && {
            name: theme.name, register: theme.register, colors: theme.colors,
            titleFont: theme.titleFont, bodyFont: theme.bodyFont,
            logoText: theme.logoText, styleNotes: theme.styleNotes,
          },
          media,
          voiceover: project.config.voiceover?.enabled
            ? { enabled: true, style: project.config.voiceover.style }
            : undefined,
        })

        clearInterval(ticker)
        if (result.ok && result.html) {
          setComposedHtml(project.id, result.html, result.summary)
          setSummary(result.summary || '')

          // voiceover requested → write + voice narration so the first render has sound
          if (project.config.voiceover?.enabled) {
            setStepIdx(2)
            const narr = await generateNarrationAI({
              id: project.id,
              html: result.html,
              summary: result.summary,
              prompt: project.config.prompt,
              durationSec: result.duration || project.config.durationSec,
              voiceStyle: project.config.voiceover.style || 'warm',
              voiceId: project.config.voiceover.voiceId,
            })
            if (narr.ok && narr.url) {
              setNarration(project.id, { url: narr.url, script: narr.script, duration: narr.duration, voice: narr.voice })
            }
          }
        } else {
          setUsedFallback(true)
        }

        setPhase('render')
        setStepIdx(3)
        setStatus(project.id, 'rendering')
        const fresh = useStore.getState().projects.find((p) => p.id === project.id)!
        await startRender(fresh)

        stopPoll = pollRender(project.id, (s) => {
          setRenderPct(s.progress || 0)
          if (s.progress >= 80) setStepIdx(4)
          if (s.status === 'complete' && s.url) {
            setStatus(project.id, 'complete')
            setPhase('done')
            setTimeout(() => nav(`/studio/projects/${project.id}/editor?render=1`), 600)
          }
          if (s.status === 'error' || s.status === 'unknown') {
            setStatus(project.id, 'error'); setError(s.error || 'Render failed'); setPhase('error')
          }
        })
      } catch (e) {
        clearInterval(ticker)
        setError(String((e as Error)?.message || e))
        setStatus(project.id, 'error'); setPhase('error')
      }
    })()

    return () => { clearInterval(ticker); stopPoll() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  if (!project) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
        Project not found.
        <button className="btn" style={{ marginLeft: 10 }} onClick={() => nav('/studio')}>Back to Studio</button>
      </div>
    )
  }

  const activeStep = phase === 'render' ? Math.max(3, stepIdx) : stepIdx

  // ── left assist panel content: the brief + staged progress ──
  const assist = (
    <>
      <style>{`
        .gs-brief { background: var(--surface); border-radius: 16px; padding: 12px 14px; font-size: 14px; color: var(--text-2); line-height: 1.5; }
        .gs-spark { display: flex; align-items: center; gap: 8px; color: var(--accent-2); font-size: 13px; font-weight: 500; }
        .gs-steps { display: flex; flex-direction: column; gap: 13px; margin-top: 4px; }
        .gs-step { display: flex; align-items: center; gap: 12px; transition: opacity .3s; }
        .gs-dot { width: 22px; height: 22px; border-radius: 999px; flex: none; display: grid; place-items: center; }
        .gs-step-label { font-size: 13.5px; }
        .gs-note { background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px; padding: 12px 14px; font-size: 12.5px; color: var(--text-3); line-height: 1.55; }
        .gs-err { display: flex; gap: 10px; margin-top: 8px; }
      `}</style>

      {project.config.prompt && <div className="gs-brief">{project.config.prompt}</div>}

      <div className="gs-spark"><Icon name="sparkle" size={15} /> {phase === 'done' ? 'Your video is ready' : phase === 'error' ? 'Generation failed' : 'Creating your video'}</div>

      {phase === 'error' ? (
        <>
          <div className="gs-note" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>{error}</div>
          <div className="gs-err">
            <button className="btn primary sm" onClick={() => location.reload()}><Icon name="refresh" size={14} /> Try again</button>
            <button className="btn ghost sm" onClick={() => nav('/studio')}>Back</button>
          </div>
        </>
      ) : (
        <>
          <div className="gs-steps">
            {STEPS.map((s, i) => {
              const done = i < activeStep || phase === 'done'
              const active = i === activeStep && phase !== 'done'
              return (
                <div key={s.key} className="gs-step" style={{ opacity: done || active ? 1 : 0.4 }}>
                  <div className="gs-dot" style={{ background: done ? 'var(--green)' : active ? 'var(--accent-soft)' : 'var(--surface-3)', color: done ? '#0a0a0c' : 'var(--accent-2)' }}>
                    {done ? <Icon name="check" size={13} /> : active ? <span className="spinner" style={{ width: 12, height: 12 }} /> : null}
                  </div>
                  <span className="gs-step-label" style={{ color: done || active ? 'var(--text)' : 'var(--text-3)' }}>{s.label}</span>
                </div>
              )
            })}
          </div>
          <div className="gs-note">
            {summary
              ? <><strong style={{ color: 'var(--text-2)' }}>Claude’s plan:</strong> {summary}</>
              : usedFallback
              ? 'Claude was unavailable, so the built-in composer made this draft.'
              : 'Claude is authoring every scene as animated HTML — typography, motion and transitions tuned to your brief.'}
          </div>
        </>
      )}
    </>
  )

  const meta = `${project.config.durationSec}s · ${project.config.aspect} · powered by Claude`

  const stage = (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Skeleton style={{ width: '100%', height: '100%', borderRadius: 16 }} />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', gap: 10 }}>
        <div>
          <div style={{ width: 46, height: 46, borderRadius: 14, margin: '0 auto 12px', display: 'grid', placeItems: 'center', background: 'var(--accent-grad)', boxShadow: '0 6px 28px var(--accent-glow)', animation: 'gs-pulse 1.8s ease-in-out infinite' }}>
            <Icon name="sparkle" size={22} style={{ color: '#fff' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
            {phase === 'render' ? `Rendering · ${Math.max(5, renderPct)}%` : 'Composing your video'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{meta}</div>
        </div>
      </div>
      <style>{`@keyframes gs-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.08) } }`}</style>
    </div>
  )

  const timeline = (
    <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 'var(--r-panel)', padding: 16, display: 'flex', gap: 10, height: 120, alignItems: 'center' }}>
      {[...Array(5)].map((_, i) => <Skeleton key={i} style={{ flex: 1, height: 64 }} />)}
    </div>
  )

  const drawer = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[...Array(6)].map((_, i) => <Skeleton key={i} style={{ height: 40 }} />)}
    </div>
  )

  return <DirectorView assist={assist} stage={stage} timeline={timeline} drawer={drawer} drawerTitle="Layers" />
}

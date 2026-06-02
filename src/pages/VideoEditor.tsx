import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { ScenePreview, ASPECT_RATIO } from '../components/ScenePreview'
import { Icon } from '../components/Icon'
import { Modal, ProgressBar } from '../components/shared'
import { startRender, pollRender, getRenderStatus } from '../render'
import type { OverlayElement, ChatMessage, AspectRatio } from '../types'
import {
  LayerPanel,
  ContextualToolbar,
  AIPromptBar,
  AIChatPanel,
  Timeline,
  FirstRunTour,
  ExportModal,
  PublishModal,
} from './editorParts'
import { editorCommandAI } from '../ai'
import type { EditCall } from '../ai'

export function VideoEditor() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const project = useStore((s) => s.projects.find((p) => p.id === id))
  const ensureEditor = useStore((s) => s.ensureEditor)
  const editor = useStore((s) => s.editors[id])
  const setStatus = useStore((s) => s.setStatus)
  const store = useStore()

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [rendering, setRendering] = useState(params.get('render') === '1')
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('Starting render')
  const [renderErr, setRenderErr] = useState<string | null>(null)

  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [zoom, setZoom] = useState(28) // px per second
  const [exportOpen, setExportOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [tour, setTour] = useState(() => localStorage.getItem(`ms-tour-${id}`) !== '1')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number>()

  useEffect(() => { if (id) ensureEditor(id) }, [id, ensureEditor])

  // render polling
  useEffect(() => {
    if (!rendering || !project) return
    let stop = () => {}
    ;(async () => {
      // check if already complete (e.g. revisiting)
      const existing = await getRenderStatus(id)
      if (existing.status === 'complete' && existing.url) {
        setVideoUrl(existing.url); setRendering(false); setStatus(id, 'complete'); return
      }
      stop = pollRender(id, (s) => {
        setProgress(s.progress); setStage(s.stage || 'Rendering')
        if (s.status === 'complete' && s.url) { setVideoUrl(s.url); setRendering(false); setStatus(id, 'complete') }
        if (s.status === 'error') { setRenderErr(s.error || 'Render failed'); setRendering(false); setStatus(id, 'error') }
      })
    })()
    return () => stop()
  }, [rendering, id, project, setStatus])

  // try to load an already-rendered video on mount
  useEffect(() => {
    if (rendering) return
    getRenderStatus(id).then((s) => { if (s.status === 'complete' && s.url) setVideoUrl(s.url) })
  }, [id, rendering])

  const duration = editor?.duration || project?.config.durationSec || 30

  // playback loop
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setTime((t) => {
        const nt = t + dt
        if (nt >= duration) { setPlaying(false); return 0 }
        return nt
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current!)
  }, [playing, duration])

  // sync real video element
  useEffect(() => {
    const v = videoRef.current
    if (!v || !videoUrl) return
    if (playing) { v.play().catch(() => {}) } else { v.pause(); if (Math.abs(v.currentTime - time) > 0.2) v.currentTime = time }
  }, [playing, time, videoUrl])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? store.redo(id) : store.undo(id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, store])

  if (!project || !editor) {
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>Loading editor…</div>
  }

  const aspect = project.config.aspect
  const currentClip = editor.clips.find((c) => time >= c.start && time < c.start + c.duration) || editor.clips[0]
  const sel = editor.overlays.find((o) => o.id === editor.selectedId) || null

  const startExportRender = async () => {
    setRendering(true); setProgress(0); setRenderErr(null)
    try { await startRender(project) } catch (e) { setRenderErr(String(e)); setRendering(false) }
  }

  // ── AI command handling (Gemini-powered, falls back locally) ──
  const runAI = async (prompt: string, context: string) => {
    const userMsg: ChatMessage = { id: Math.random().toString(36), role: 'user', text: prompt }
    const pending: ChatMessage = { id: 'pending', role: 'ai', text: '…thinking', toolCalls: [] }
    setChat((c) => [...c, userMsg, pending])

    const result = await editorCommandAI(prompt, context, sel, editor.overlays, project.config.aspect)
    const applied = applyEditCalls(result.calls, editor, sel, project.config.aspect, {
      updateOverlay: (oid, patch) => store.updateOverlay(id, oid, patch, true),
      addOverlay: (ov) => store.addOverlay(id, ov),
      deleteOverlay: (oid) => store.deleteOverlay(id, oid),
    })

    const aiMsg: ChatMessage = {
      id: Math.random().toString(36),
      role: 'ai',
      text: `${result.summary}${result.source === 'fallback' ? ' (local mode)' : ''}`,
      toolCalls: applied.map((c) => ({ tool: c.tool, summary: c.tool })),
    }
    setChat((c) => [...c.filter((m) => m.id !== 'pending'), aiMsg])
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <EditorTopBar
        project={project}
        time={time}
        duration={duration}
        playing={playing}
        onPlay={() => setPlaying((p) => !p)}
        onSeekStart={() => { setTime(0); setPlaying(false) }}
        canUndo={store.canUndo(id)}
        canRedo={store.canRedo(id)}
        onUndo={() => store.undo(id)}
        onRedo={() => store.redo(id)}
        onBack={() => nav(`/studio/projects/${id}/storyboard`)}
        onExport={() => setExportOpen(true)}
        onPublish={() => setPublishOpen(true)}
        onRename={(n: string) => store.renameProject(id, n)}
        hasVideo={!!videoUrl}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* LEFT layers */}
        {leftOpen ? (
          <LayerPanel id={id} onCollapse={() => setLeftOpen(false)} />
        ) : (
          <button className="btn icon ghost" onClick={() => setLeftOpen(true)} style={{ alignSelf: 'flex-start', margin: 8 }} aria-label="Open layers"><Icon name="layers" size={18} /></button>
        )}

        {/* CENTER */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
            <Canvas
              aspect={aspect}
              videoUrl={videoUrl}
              videoRef={videoRef}
              seed={currentClip?.seed}
              overlays={editor.overlays}
              selectedId={editor.selectedId}
              onSelect={(oid: string | null) => store.selectElement(id, oid)}
              onMove={(oid: string, patch: Partial<OverlayElement>) => store.updateOverlay(id, oid, patch)}
              onMoveEnd={() => store.snapshot(id)}
            />
            {rendering && <RenderOverlay progress={progress} stage={stage} />}
            {renderErr && (
              <div className="card" style={{ position: 'absolute', bottom: 20, padding: '12px 16px', color: 'var(--red)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <Icon name="close" size={16} /> {renderErr}
                <button className="btn sm" onClick={startExportRender}>Retry</button>
              </div>
            )}
            {tour && <FirstRunTour onDone={() => { setTour(false); localStorage.setItem(`ms-tour-${id}`, '1') }} />}
          </div>

          {/* contextual toolbar */}
          {sel && <ContextualToolbar el={sel} onChange={(patch) => store.updateOverlay(id, sel.id, patch, true)} onDelete={() => store.deleteOverlay(id, sel.id)} />}

          {/* AI prompt bar */}
          <AIPromptBar selected={!!sel} onRun={runAI} />
        </div>

        {/* RIGHT chat */}
        {rightOpen ? (
          <AIChatPanel chat={chat} onCollapse={() => setRightOpen(false)} onRun={(p) => runAI(p, 'Whole video')} />
        ) : (
          <button className="btn icon ghost" onClick={() => setRightOpen(true)} style={{ alignSelf: 'flex-start', margin: 8 }} aria-label="Open AI"><Icon name="sparkle" size={18} /></button>
        )}
      </div>

      {/* TIMELINE */}
      <Timeline
        id={id}
        time={time}
        duration={duration}
        zoom={zoom}
        onZoom={setZoom}
        onSeek={(t) => { setTime(Math.max(0, Math.min(duration, t))); setPlaying(false) }}
      />

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} project={project} videoUrl={videoUrl} onRender={startExportRender} />
      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} project={project} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function EditorTopBar(props: any) {
  const { project, time, duration, playing, onPlay, onSeekStart, canUndo, canRedo, onUndo, onRedo, onBack, onExport, onPublish, onRename, hasVideo } = props
  const [exportMenu, setExportMenu] = useState(false)
  return (
    <header style={{ height: 50, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
      <button className="btn icon sm ghost" onClick={onBack} aria-label="Back"><Icon name="arrowLeft" size={16} /></button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13 }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--accent-grad)', display: 'grid', placeItems: 'center' }}><Icon name="motion" size={12} style={{ color: '#fff' }} /></div>
        Motion Studio
      </div>
      <input defaultValue={project.name} onBlur={(e) => onRename(e.target.value)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px', fontSize: 13, maxWidth: 200, outline: 'none' }} />
      <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
      <button className="btn icon sm ghost" disabled={!canUndo} onClick={onUndo} aria-label="Undo"><Icon name="undo" size={16} /></button>
      <button className="btn icon sm ghost" disabled={!canRedo} onClick={onRedo} aria-label="Redo"><Icon name="redo" size={16} /></button>
      <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
      <button className="btn icon sm ghost" onClick={onSeekStart} aria-label="To start"><Icon name="chevLeft" size={16} /></button>
      <button className="btn icon sm primary" onClick={onPlay} aria-label="Play/Pause" data-tour="play"><Icon name={playing ? 'pause' : 'play'} size={15} /></button>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-2)', minWidth: 92 }}>{fmt(time)} / {fmt(duration)}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 9, position: 'relative' }} data-tour="export">
        <div style={{ position: 'relative' }}>
          <button className="btn sm" onClick={() => setExportMenu((m) => !m)}><Icon name="download" size={15} /> Export <Icon name="chevDown" size={13} /></button>
          {exportMenu && (
            <div className="card" style={{ position: 'absolute', top: 38, right: 0, zIndex: 40, padding: 5, width: 150, background: 'var(--bg-elev)', boxShadow: 'var(--shadow-pop)' }}>
              {['MP4', 'WebM', 'GIF', 'MOV', 'Image Sequence'].map((f) => (
                <button key={f} onClick={() => { setExportMenu(false); onExport() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 9px', borderRadius: 6, fontSize: 12.5 }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{f}</button>
              ))}
            </div>
          )}
        </div>
        <button className="btn primary sm" onClick={onPublish}><Icon name="share" size={15} /> Publish</button>
      </div>
    </header>
  )
}

// ── Canvas ──
function useFit(ratio: number) {
  const outerRef = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      let w = width
      let h = w / ratio
      if (h > height) { h = height; w = h * ratio }
      setBox({ w: Math.round(w), h: Math.round(h) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ratio])
  return { outerRef, box }
}

function Canvas({ aspect, videoUrl, videoRef, seed, overlays, selectedId, onSelect, onMove, onMoveEnd }: any) {
  const ratio = ASPECT_RATIO[aspect as AspectRatio]
  const { outerRef, box } = useFit(ratio)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; rect: DOMRect } | null>(null)

  const onPointerDown = (e: React.PointerEvent, o: OverlayElement) => {
    e.stopPropagation()
    onSelect(o.id)
    const rect = wrapRef.current!.getBoundingClientRect()
    drag.current = { id: o.id, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, rect }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const d = drag.current
    const dx = ((e.clientX - d.sx) / d.rect.width) * 100
    const dy = ((e.clientY - d.sy) / d.rect.height) * 100
    onMove(d.id, { x: Math.max(0, Math.min(100, d.ox + dx)), y: Math.max(0, Math.min(100, d.oy + dy)) })
  }
  const onPointerUp = () => { if (drag.current) { drag.current = null; onMoveEnd() } }

  return (
    <div ref={outerRef} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
    <div
      ref={wrapRef}
      data-tour="canvas"
      onClick={() => onSelect(null)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ position: 'relative', width: box.w || '100%', height: box.h || undefined, aspectRatio: box.w ? undefined : String(ratio), borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', background: '#0a0a0c' }}
    >
      {videoUrl ? (
        <video ref={videoRef} src={videoUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
      ) : seed ? (
        <ScenePreview seed={seed} ratio={ratio} />
      ) : (
        <div className="shimmer" style={{ position: 'absolute', inset: 0 }} />
      )}

      {/* overlays */}
      {overlays.map((o: OverlayElement) => (
        <div
          key={o.id}
          onPointerDown={(e) => onPointerDown(e, o)}
          onClick={(e) => { e.stopPropagation(); onSelect(o.id) }}
          style={{
            position: 'absolute',
            left: `${o.x}%`,
            top: `${o.y}%`,
            width: `${o.w}%`,
            transform: `translate(-50%,-50%) rotate(${o.rotation}deg)`,
            opacity: o.opacity,
            cursor: 'move',
            outline: selectedId === o.id ? '2px solid var(--accent)' : '1px dashed transparent',
            outlineOffset: 2,
            padding: 4,
            borderRadius: 4,
          }}
        >
          {o.kind === 'text' ? (
            <div style={{ fontSize: `calc(${(o.fontSize || 40) / 12}cqw)`, fontWeight: o.bold ? 800 : 500, fontStyle: o.italic ? 'italic' : 'normal', color: o.color || '#fff', textAlign: o.align || 'center', textShadow: '0 1px 16px rgba(0,0,0,.8)', lineHeight: 1.1, containerType: 'inline-size' } as any}>{o.text}</div>
          ) : o.kind === 'logo' ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(0,0,0,.4)', color: o.color, fontWeight: 800, fontSize: 14, letterSpacing: '.05em' }}>{o.text}</div>
          ) : (
            <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)' }} />
          )}
          {selectedId === o.id && ['nw', 'ne', 'sw', 'se'].map((h) => (
            <span key={h} style={{ position: 'absolute', width: 9, height: 9, background: '#fff', border: '1px solid var(--accent)', borderRadius: 2, ...handlePos(h) }} />
          ))}
        </div>
      ))}
    </div>
    </div>
  )
}
function handlePos(h: string): React.CSSProperties {
  const m = -5
  return {
    top: h[0] === 'n' ? m : undefined, bottom: h[0] === 's' ? m : undefined,
    left: h[1] === 'w' ? m : undefined, right: h[1] === 'e' ? m : undefined,
  }
}

// ── Render overlay ──
function RenderOverlay({ progress, stage }: { progress: number; stage: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,10,.86)', backdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', zIndex: 50, borderRadius: 14 }}>
      <div style={{ width: 360, maxWidth: '80%', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
          <span className="spinner" style={{ width: 20, height: 20 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Rendering your video</span>
        </div>
        <ProgressBar pct={progress} glow />
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-2)' }}>{progress}% · {stage}</div>
        <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-4)' }}>Kinetic · headless Chrome → FFmpeg → MP4</div>
      </div>
    </div>
  )
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${ss.toString().padStart(2, '0')}`
}

// ── Apply structured AI edit calls to the editor state ───────────────────────
function applyEditCalls(
  calls: EditCall[],
  editor: any,
  selected: OverlayElement | null,
  aspect: AspectRatio,
  ops: { updateOverlay: (id: string, patch: Partial<OverlayElement>) => void; addOverlay: (ov: Omit<OverlayElement, 'id'>) => string; deleteOverlay: (id: string) => void },
): EditCall[] {
  const applied: EditCall[] = []
  const resolveTarget = (t: string | undefined): OverlayElement | null => {
    if (!t || t === 'none') return null
    if (t === 'selected') return selected || editor.overlays[0] || null
    if (t === 'first') return editor.overlays[0] || null
    if (t === 'last') return editor.overlays[editor.overlays.length - 1] || null
    if (t === 'all_text') return editor.overlays.find((o: OverlayElement) => o.kind === 'text') || null
    return editor.overlays.find((o: OverlayElement) => o.id === t) || null
  }
  for (const call of calls) {
    switch (call.tool) {
      case 'resize_element': {
        const tgt = resolveTarget((call as any).target)
        if (!tgt) break
        const patch: Partial<OverlayElement> = {}
        if (call.fontSize) patch.fontSize = Math.max(8, Math.min(200, call.fontSize))
        if (call.width) patch.w = Math.max(5, Math.min(95, call.width))
        ops.updateOverlay(tgt.id, patch)
        applied.push(call)
        break
      }
      case 'position_element': {
        const tgt = resolveTarget((call as any).target)
        if (!tgt) break
        ops.updateOverlay(tgt.id, { x: Math.max(0, Math.min(100, call.x)), y: Math.max(0, Math.min(100, call.y)) })
        applied.push(call)
        break
      }
      case 'set_color': {
        const tgt = resolveTarget((call as any).target)
        if (!tgt) break
        ops.updateOverlay(tgt.id, { color: call.color })
        applied.push(call)
        break
      }
      case 'set_weight': {
        const tgt = resolveTarget((call as any).target)
        if (!tgt) break
        ops.updateOverlay(tgt.id, { bold: !!call.bold })
        applied.push(call)
        break
      }
      case 'set_animation': {
        const tgt = resolveTarget((call as any).target)
        if (!tgt) break
        ops.updateOverlay(tgt.id, { animation: call.animation })
        applied.push(call)
        break
      }
      case 'add_element': {
        ops.addOverlay({
          sceneId: editor.clips[editor.clips.length - 1]?.id || '',
          kind: 'text',
          text: call.text || 'New text',
          x: 50, y: 80, w: 50, h: 14,
          rotation: 0, opacity: 1, fontSize: 44, color: '#ffffff', align: 'center', bold: true,
        })
        applied.push(call)
        break
      }
      case 'delete_element': {
        const tgt = resolveTarget((call as any).target)
        if (!tgt) break
        ops.deleteOverlay(tgt.id)
        applied.push(call)
        break
      }
      case 'add_subtitles':
      case 'tighten_transitions':
      case 'reformat':
        applied.push(call)
        break
    }
  }
  return applied
}

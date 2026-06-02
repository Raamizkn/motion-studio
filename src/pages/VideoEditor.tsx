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
import { meshBg } from '../sceneModel'

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

  // playback clock — driven by the real <video> when present, else a timer
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const tick = (now: number) => {
      const v = videoRef.current
      if (v && videoUrl) {
        setTime(v.currentTime)
        if (v.ended || v.currentTime >= duration - 0.02) { setPlaying(false); return }
      } else {
        const dt = (now - last) / 1000
        last = now
        setTime((t) => { const nt = t + dt; if (nt >= duration) { setPlaying(false); return duration } return nt })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current!)
  }, [playing, duration, videoUrl])

  // play / pause the real video element
  useEffect(() => {
    const v = videoRef.current
    if (!v || !videoUrl) return
    if (playing) v.play().catch(() => {})
    else v.pause()
  }, [playing, videoUrl])

  // when paused/scrubbing, paint the exact frame at the playhead
  useEffect(() => {
    const v = videoRef.current
    if (!v || !videoUrl || playing) return
    if (Math.abs(v.currentTime - time) > 0.04) {
      try { v.currentTime = Math.min(time, duration - 0.02) } catch { /* not seekable yet */ }
    }
  }, [time, playing, videoUrl, duration])

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
  const currentScene = editor.scenes.find((s) => time >= s.start && time < s.end) || editor.scenes[0]
  // selection can be a scene element (in the current scene) or a persistent overlay
  const selSceneEl = currentScene?.elements.find((e) => e.id === editor.selectedId) || null
  const selOverlay = editor.overlays.find((o) => o.id === editor.selectedId) || null
  const sel: any = selSceneEl || selOverlay
  const selIsOverlay = !!selOverlay
  const selName = selSceneEl ? selSceneEl.role : selOverlay ? (editor.layers.find((l) => l.id === selOverlay.id)?.name || selOverlay.text || selOverlay.kind) : null
  const selIsText = sel ? (sel.type === 'text' || sel.kind === 'text' || sel.kind === 'logo' || (sel.type === 'shape' && sel.text != null)) : false

  // route an edit to the right store slice based on what's selected
  const patchSel = (patch: any) => { if (!sel) return; selIsOverlay ? store.updateOverlay(id, sel.id, patch, true) : store.updateSceneElement(id, sel.id, patch, true) }
  const moveItem = (itemId: string, patch: any) => {
    if (editor.overlays.some((o) => o.id === itemId)) store.updateOverlay(id, itemId, patch)
    else store.updateSceneElement(id, itemId, patch)
  }
  const textItem = (itemId: string, text: string) => {
    if (editor.overlays.some((o) => o.id === itemId)) store.updateOverlay(id, itemId, { text }, true)
    else store.updateSceneElement(id, itemId, { text }, true)
  }
  const deleteSel = () => { if (!sel) return; selIsOverlay ? store.deleteOverlay(id, sel.id) : store.deleteSceneElement(id, sel.id) }
  const duplicateSel = () => { if (!sel) return; selIsOverlay ? store.duplicateOverlay(id, sel.id) : store.duplicateSceneElement(id, sel.id) }

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
    const applied = applyEditCalls(result.calls, { overlays: editor.overlays, scene: currentScene }, sel, project.config.aspect, {
      patch: (eid, p) => moveItem(eid, p),
      addOverlay: (ov) => store.addOverlay(id, ov),
      addSceneElement: (el) => currentScene && store.addSceneElement(id, currentScene.id, el),
      remove: (eid) => { editor.overlays.some((o) => o.id === eid) ? store.deleteOverlay(id, eid) : store.deleteSceneElement(id, eid) },
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
          <LayerPanel id={id} scene={currentScene} onCollapse={() => setLeftOpen(false)} />
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
              scene={currentScene}
              overlays={editor.overlays}
              selectedId={editor.selectedId}
              playing={playing}
              onSelect={(oid: string | null) => store.selectElement(id, oid)}
              onMove={moveItem}
              onMoveEnd={() => store.snapshot(id)}
              onText={textItem}
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
          {sel && <ContextualToolbar el={sel} isText={selIsText} onChange={patchSel} onDelete={deleteSel} onDuplicate={duplicateSel} />}

          {/* AI prompt bar */}
          <AIPromptBar selectedName={selName} onRun={runAI} />
        </div>

        {/* RIGHT chat */}
        {rightOpen ? (
          <AIChatPanel chat={chat} selectedName={selName} onCollapse={() => setRightOpen(false)} onRun={(p) => runAI(p, selName ? 'Selected element' : 'Whole video')} />
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

function Canvas({ aspect, videoUrl, videoRef, scene, overlays, selectedId, playing, onSelect, onMove, onMoveEnd, onText }: any) {
  const ratio = ASPECT_RATIO[aspect as AspectRatio]
  const { outerRef, box } = useFit(ratio)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; rect: DOMRect } | null>(null)
  const resize = useRef<{ id: string; cx: number; cy: number; startDist: number; startW: number; startFont: number; isText: boolean } | null>(null)
  const cw = box.w || 640
  const previewing = !!videoUrl && playing

  const startMove = (e: React.PointerEvent, item: any) => {
    e.stopPropagation()
    onSelect(item.id)
    drag.current = { id: item.id, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y, rect: wrapRef.current!.getBoundingClientRect() }
    wrapRef.current?.setPointerCapture(e.pointerId)
  }
  const startResize = (e: React.PointerEvent, item: any, isText: boolean) => {
    e.stopPropagation()
    onSelect(item.id)
    const r = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    resize.current = { id: item.id, cx, cy, startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, startW: item.w, startFont: item.fontSize || 40, isText }
    wrapRef.current?.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (resize.current) {
      const r = resize.current
      const scale = Math.max(0.12, Math.hypot(e.clientX - r.cx, e.clientY - r.cy) / r.startDist)
      const patch: any = { w: Math.max(3, Math.min(100, +(r.startW * scale).toFixed(1))) }
      if (r.isText) patch.fontSize = Math.max(8, Math.min(260, Math.round(r.startFont * scale)))
      onMove(r.id, patch)
    } else if (drag.current) {
      const d = drag.current
      onMove(d.id, { x: Math.max(0, Math.min(100, d.ox + ((e.clientX - d.sx) / d.rect.width) * 100)), y: Math.max(0, Math.min(100, d.oy + ((e.clientY - d.sy) / d.rect.height) * 100)) })
    }
  }
  const onPointerUp = () => {
    if (resize.current || drag.current) { resize.current = null; drag.current = null; onMoveEnd() }
  }

  const items = [...(scene?.elements || []).map((e: any) => ({ ...e, _scene: true })), ...overlays.map((o: any) => ({ ...o, _scene: false }))]

  return (
    <div ref={outerRef} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
    <div
      ref={wrapRef}
      data-tour="canvas"
      onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.bg === '1') onSelect(null) }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ position: 'relative', width: box.w || '100%', height: box.h || undefined, aspectRatio: box.w ? undefined : String(ratio), borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', background: '#0a0a0c' }}
    >
      {/* MP4 preview (mounted always for the ref; shown only while playing) */}
      <video
        ref={videoRef}
        src={videoUrl || undefined}
        preload="auto"
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#0a0a0c', display: previewing ? 'block' : 'none' }}
      />

      {/* Live editable scene */}
      <div data-bg="1" style={{ position: 'absolute', inset: 0, background: scene ? meshBg(scene.palette) : '#0a0a0c', display: previewing ? 'none' : 'block' }}>
        {items.map((item) => (
          <EditItem
            key={item.id}
            item={item}
            cw={cw}
            selected={selectedId === item.id}
            editing={editingId === item.id}
            onSelect={onSelect}
            onStartMove={startMove}
            onStartResize={startResize}
            onStartEdit={() => setEditingId(item.id)}
            onCommitText={(t: string) => { setEditingId(null); onText(item.id, t) }}
          />
        ))}
      </div>
    </div>
    </div>
  )
}

// Unified editable element — handles scene elements (type) and overlays (kind)
function EditItem({ item, cw, selected, editing, onSelect, onStartMove, onStartResize, onStartEdit, onCommitText }: any) {
  const isText = item.type === 'text' || item.kind === 'text' || item.kind === 'logo'
  const geo: React.CSSProperties = {
    position: 'absolute', left: `${item.x}%`, top: `${item.y}%`, width: `${item.w}%`,
    transform: `translate(-50%,-50%) rotate(${item.rotation || 0}deg)`, opacity: item.opacity ?? 1,
    outline: selected ? '2px solid var(--accent)' : '1px dashed transparent', outlineOffset: 2, borderRadius: 4,
    cursor: editing ? 'text' : 'move', touchAction: 'none',
  }
  const textStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    fontSize: (item.fontSize || 40) / 1000 * cw, fontWeight: item.bold ? 800 : 500, fontStyle: item.italic ? 'italic' : 'normal',
    color: item.color || '#fff', textAlign: item.align || 'center', fontFamily: `${item.fontFamily || 'Inter'}, sans-serif`,
    textShadow: '0 1px 16px rgba(0,0,0,.75)', lineHeight: 1.08, letterSpacing: '-0.01em', outline: editing ? '1px solid var(--accent)' : 'none', ...extra,
  })
  const editable = (style: React.CSSProperties, content: string) => (
    <div contentEditable={editing} suppressContentEditableWarning
      onBlur={(e) => onCommitText(e.currentTarget.textContent || '')}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLElement).blur() } }}
      style={style}>{content}</div>
  )

  let inner: React.ReactNode = null
  if (item.kind === 'image' || (item.type === 'image' && item.src)) {
    inner = <img src={item.src} alt={item.text || 'asset'} draggable={false} style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain', pointerEvents: 'none' }} />
  } else if (item.type === 'text' || item.kind === 'text') {
    inner = editable(textStyle(), item.text || '')
  } else if (item.kind === 'logo') {
    inner = editable({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(0,0,0,.4)', color: item.color || '#fff', fontWeight: 800, fontSize: (item.fontSize || 24) / 1000 * cw, letterSpacing: '.05em', outline: editing ? '1px solid var(--accent)' : 'none' }, item.text || 'LOGO')
  } else if (item.type === 'graphic') {
    inner = <Graphic item={item} cw={cw} />
  } else {
    // shape / card (may have centered text)
    const h = item.h ? (item.h / 100) * (cw / (16 / 9)) : undefined
    inner = (
      <div style={{ width: '100%', height: h, minHeight: h ? undefined : 40, background: item.glass ? 'rgba(255,255,255,.08)' : item.bg || 'rgba(255,255,255,.08)', border: item.border || '1px solid rgba(255,255,255,.18)', borderRadius: item.radius ?? 16, backdropFilter: item.glass ? 'blur(14px)' : undefined, boxShadow: item.glass ? undefined : (item.bg ? '0 20px 60px rgba(0,0,0,.4)' : undefined), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item.text != null && item.text !== '' && editable({ ...textStyle({ textShadow: 'none' }), padding: '0 8px' }, item.text)}
      </div>
    )
  }

  return (
    <div
      onPointerDown={(e) => !editing && onStartMove(e, item)}
      onDoubleClick={(e) => { e.stopPropagation(); if (isText) { onSelect(item.id); onStartEdit() } }}
      style={geo}
    >
      {inner}
      {selected && !editing && ['nw', 'ne', 'sw', 'se'].map((h) => (
        <span key={h} onPointerDown={(e) => startResizeStop(e, () => onStartResize(e, item, isText))} style={{ position: 'absolute', width: 12, height: 12, background: '#fff', border: '1.5px solid var(--accent)', borderRadius: 3, cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize', touchAction: 'none', ...handlePos(h) }} />
      ))}
    </div>
  )
}
function startResizeStop(e: React.PointerEvent, fn: () => void) { e.stopPropagation(); fn() }

function Graphic({ item, cw }: any) {
  const h = item.h ? (item.h / 100) * (cw / (16 / 9)) : 200
  const accent = (item.border || '').match(/#[0-9a-fA-F]{3,8}/)?.[0] || '#8a3ffc'
  if (item.graphic === 'globe') {
    return (
      <div style={{ width: '100%', height: h, borderRadius: '50%', border: `2px solid ${accent}aa`, position: 'relative', boxShadow: `inset 0 0 ${h / 3}px ${accent}55, 0 0 ${h / 4}px ${accent}44` }}>
        <div style={{ position: 'absolute', inset: '8%', borderRadius: '50%', border: `1px solid ${accent}55` }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${accent}66`, transform: 'rotateY(70deg)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px solid ${accent}66`, transform: 'rotateX(70deg)' }} />
      </div>
    )
  }
  if (item.graphic === 'ring') return <div style={{ width: '100%', height: h, borderRadius: '50%', border: item.border || `2px solid ${accent}` }} />
  if (item.graphic === 'frame') return <div style={{ width: '100%', height: h, borderRadius: 20, background: item.bg || '#222', border: item.border }} />
  return <div style={{ width: '100%', height: h, background: item.bg }} />
}
function handlePos(h: string): React.CSSProperties {
  const m = -7
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

// ── Apply structured AI edit calls to scene elements + overlays ──────────────
function applyEditCalls(
  calls: EditCall[],
  ctx: { overlays: OverlayElement[]; scene: any },
  selected: any,
  aspect: AspectRatio,
  ops: { patch: (id: string, patch: any) => void; addOverlay: (ov: Omit<OverlayElement, 'id'>) => string; addSceneElement: (el: any) => void; remove: (id: string) => void },
): EditCall[] {
  const applied: EditCall[] = []
  const pool: any[] = [...(ctx.scene?.elements || []), ...ctx.overlays]
  const isText = (o: any) => o && (o.type === 'text' || o.kind === 'text' || o.kind === 'logo')
  const resolve = (t: string | undefined): any => {
    if (!t || t === 'none') return null
    if (t === 'selected') return selected || pool.find(isText) || pool[0] || null
    if (t === 'first') return pool[0] || null
    if (t === 'last') return pool[pool.length - 1] || null
    if (t === 'all_text') return pool.find(isText) || null
    return pool.find((o) => o.id === t) || null
  }
  for (const call of calls) {
    switch (call.tool) {
      case 'resize_element': {
        const tgt = resolve((call as any).target); if (!tgt) break
        const patch: any = {}
        if (call.fontSize) patch.fontSize = Math.max(8, Math.min(240, call.fontSize))
        if (call.width) patch.w = Math.max(4, Math.min(100, call.width))
        ops.patch(tgt.id, patch); applied.push(call); break
      }
      case 'position_element': { const tgt = resolve((call as any).target); if (!tgt) break; ops.patch(tgt.id, { x: Math.max(0, Math.min(100, call.x)), y: Math.max(0, Math.min(100, call.y)) }); applied.push(call); break }
      case 'set_color': { const tgt = resolve((call as any).target); if (!tgt) break; ops.patch(tgt.id, { color: call.color }); applied.push(call); break }
      case 'set_weight': { const tgt = resolve((call as any).target); if (!tgt) break; ops.patch(tgt.id, { bold: !!call.bold }); applied.push(call); break }
      case 'set_animation': { const tgt = resolve((call as any).target); if (!tgt) break; ops.patch(tgt.id, { anim: call.animation, animation: call.animation }); applied.push(call); break }
      case 'add_element': {
        // add a scene element to the current scene so it lives inside the video
        if (ctx.scene) ops.addSceneElement({ id: `el_${Math.random().toString(36).slice(2)}`, role: (call.text || 'Text').slice(0, 18), type: 'text', text: call.text || 'New text', x: 50, y: 80, w: 50, rotation: 0, opacity: 1, fontSize: 44, color: '#ffffff', align: 'center', bold: true, anim: 'rise' })
        else ops.addOverlay({ sceneId: '', kind: 'text', text: call.text || 'New text', x: 50, y: 80, w: 50, h: 14, rotation: 0, opacity: 1, fontSize: 44, color: '#fff', align: 'center', bold: true })
        applied.push(call); break
      }
      case 'delete_element': { const tgt = resolve((call as any).target); if (!tgt) break; ops.remove(tgt.id); applied.push(call); break }
      case 'add_subtitles':
      case 'tighten_transitions':
      case 'reformat':
        applied.push(call); break
    }
  }
  return applied
}

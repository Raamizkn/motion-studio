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
  Timeline,
  FirstRunTour,
  ExportModal,
  PublishModal,
} from './editorParts'
import { editorCommandAI, editCompositionAI, generateNarrationAI } from '../ai'
import type { EditCall } from '../ai'
import { meshBg } from '../sceneModel'
import { LiveCanvas } from '../components/LiveCanvas'

export function VideoEditor() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const project = useStore((s) => s.projects.find((p) => p.id === id))
  const ensureEditor = useStore((s) => s.ensureEditor)
  const editor = useStore((s) => s.editors[id])
  const setStatus = useStore((s) => s.setStatus)
  const store = useStore()
  // One brain: if Claude composed this project, the editor previews/edits the
  // real composition (seekable iframe) — never the legacy scene-graph.
  const useLive = !!project?.composedHtml

  const [reloadKey, setReloadKey] = useState(0)
  const [selectedEid, setSelectedEid] = useState<string | null>(null)
  const [compEls, setCompEls] = useState<import('../components/LiveCanvas').CompEl[]>([])
  // composition undo/redo history (separate from the legacy scene-graph history)
  const compHist = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] })
  const [compNonce, setCompNonce] = useState(0) // bump to re-render undo/redo enabled state
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
  const [rightOpen, setRightOpen] = useState(true)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [tour, setTour] = useState(() => localStorage.getItem(`ms-tour-${id}`) !== '1')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>()
  const [narrating, setNarrating] = useState(false)
  const [narrErr, setNarrErr] = useState<string | null>(null)
  const [narrNonce, setNarrNonce] = useState(0) // remounts <audio> so a re-narration reloads

  useEffect(() => { if (id) ensureEditor(id) }, [id, ensureEditor])

  // render polling
  useEffect(() => {
    if (!rendering || !project) return
    let stop = () => {}
    ;(async () => {
      // check if already complete, errored, or gone (e.g. revisiting after server restart)
      const existing = await getRenderStatus(id)
      if (existing.status === 'complete' && existing.url) {
        setVideoUrl(existing.url); setRendering(false); setStatus(id, 'complete')
        // clear ?render=1 so refreshing won't re-trigger
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
      if (existing.status === 'unknown') {
        // server doesn't know about this job (restarted, never started, etc.)
        setRenderErr('Render job not found — try rendering again'); setRendering(false); setStatus(id, 'error')
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
      if (existing.status === 'error') {
        setRenderErr(existing.error || 'Render failed'); setRendering(false); setStatus(id, 'error')
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
      stop = pollRender(id, (s) => {
        setProgress(s.progress); setStage(s.stage || 'Rendering')
        if (s.status === 'complete' && s.url) {
          setVideoUrl(s.url); setRendering(false); setStatus(id, 'complete')
          window.history.replaceState({}, '', window.location.pathname)
        }
        if (s.status === 'error') { setRenderErr(s.error || 'Render failed'); setRendering(false); setStatus(id, 'error') }
        if (s.status === 'unknown') { setRenderErr('Render job not found — try rendering again'); setRendering(false); setStatus(id, 'error') }
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
      if (v && videoUrl && !useLive) {
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
  }, [playing, duration, videoUrl, useLive])

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

  // ── narration audio: sync the <audio> to the preview transport ──
  // Only drives the live preview (the iframe has no sound of its own). When the
  // exported MP4 plays it already carries muxed audio, so we stay muted there.
  const narrationUrl = project?.narrationUrl
  useEffect(() => {
    const a = audioRef.current
    if (!a || !narrationUrl || !useLive) return
    if (playing) {
      if (Math.abs(a.currentTime - time) > 0.25) { try { a.currentTime = time } catch { /* */ } }
      a.play().catch(() => {})
    } else {
      a.pause()
      if (Math.abs(a.currentTime - time) > 0.05) { try { a.currentTime = Math.min(time, duration) } catch { /* */ } }
    }
  }, [playing, time, narrationUrl, useLive, duration])

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); if (useLive) { e.shiftKey ? compRedo() : compUndo() } else { e.shiftKey ? store.redo(id) : store.undo(id) } }
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

  // ── generate narration (Claude writes the script → ElevenLabs speaks it) ──
  const genNarration = async () => {
    if (narrating) return
    setNarrating(true); setNarrErr(null)
    try {
      const res = await generateNarrationAI({
        id,
        html: project.composedHtml,
        summary: project.composeSummary,
        prompt: project.config.prompt,
        durationSec: duration,
        voiceStyle: project.config.voiceover?.style || 'warm',
      })
      if (res.ok && res.url) {
        store.setNarration(id, { url: res.url, script: res.script, duration: res.duration, voice: res.voice })
        setNarrNonce((n) => n + 1)
        setVideoUrl(null) // any exported MP4 is now stale (no narration baked in)
      } else {
        setNarrErr(res.needsKey ? 'Add your ElevenLabs API key to .env to enable narration.' : (res.error || 'Narration failed'))
      }
    } catch (e) {
      setNarrErr(String((e as Error)?.message || e))
    } finally {
      setNarrating(false)
    }
  }

  // record the current composition into undo history before replacing it
  const pushCompHistory = () => {
    const cur = useStore.getState().projects.find((p) => p.id === id)?.composedHtml
    if (cur != null) { compHist.current.past.push(cur); if (compHist.current.past.length > 60) compHist.current.past.shift(); compHist.current.future = []; setCompNonce((n) => n + 1) }
  }
  // direct edits on the live composition persist the settled DOM; we don't bump
  // reloadKey (the live DOM already reflects the change).
  const onPersistComposition = (nextHtml: string) => {
    pushCompHistory()
    store.setComposedHtml(id, nextHtml)
  }
  const compUndo = () => {
    const cur = useStore.getState().projects.find((p) => p.id === id)?.composedHtml
    const prev = compHist.current.past.pop()
    if (prev == null || cur == null) return
    compHist.current.future.push(cur)
    store.setComposedHtml(id, prev)
    setSelectedEid(null); setReloadKey((k) => k + 1); setCompNonce((n) => n + 1)
  }
  const compRedo = () => {
    const cur = useStore.getState().projects.find((p) => p.id === id)?.composedHtml
    const next = compHist.current.future.pop()
    if (next == null || cur == null) return
    compHist.current.past.push(cur)
    store.setComposedHtml(id, next)
    setSelectedEid(null); setReloadKey((k) => k + 1); setCompNonce((n) => n + 1)
  }

  // ── AI command handling ──
  const runAI = async (prompt: string, context: string) => {
    const userMsg: ChatMessage = { id: Math.random().toString(36), role: 'user', text: prompt }
    const pending: ChatMessage = {
      id: 'pending',
      role: 'ai',
      text: useLive && project.composedHtml ? 'Reading your composition and planning the edit…' : 'Thinking through your request…',
      toolCalls: [],
    }
    setChat((c) => [...c, userMsg, pending])

    // Composed projects: Claude rewrites the whole composition, then we reload it.
    if (useLive && project.composedHtml) {
      const res = await editCompositionAI(project.composedHtml, prompt)
      if (res.ok && res.html) {
        pushCompHistory()
        store.setComposedHtml(id, res.html, res.summary)
        setReloadKey((k) => k + 1)
        setVideoUrl(null) // exported MP4 is now stale until re-render
      }
      const aiMsg: ChatMessage = {
        id: Math.random().toString(36),
        role: 'ai',
        text: res.ok ? (res.summary || 'Updated your composition.') : `Couldn't apply that: ${res.error || 'try rephrasing'}`,
      }
      setChat((c) => [...c.filter((m) => m.id !== 'pending'), aiMsg])
      return
    }

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

  const onRunAssist = (prompt: string) => {
    if (!prompt.trim()) return
    runAI(prompt, selName ? `Selected: ${selName}` : 'Whole video')
  }

  return (
    <div className="ed-root">
      <style>{`
        .ed-root { display: flex; height: 100%; width: 100%; background: var(--bg); overflow: hidden; }

        /* ── Left assist (384px col, 360px frame; Vibe Motion brand) ── */
        .ed-assist { width: 384px; flex: none; height: 100%; padding: 24px 16px 16px 8px; display: flex; }
        .ed-assist-frame {
          flex: 1; display: flex; flex-direction: column;
          background: var(--bg-elev); border: 1px solid var(--border);
          border-radius: var(--r-panel);
          box-shadow: 0 2px 4px rgba(0,0,0,0.16);
          overflow: hidden;
        }
        .ed-assist-head {
          height: 64px; flex: none; display: flex; align-items: center; gap: 8px;
          padding: 0 16px; border-bottom: 1px solid var(--border);
        }
        .ed-assist-title { flex: 1; font-family: var(--font-display); font-weight: 500; font-size: 16px; color: var(--text); letter-spacing: 0.01em; }
        .ed-hbtn { width: 32px; height: 32px; border-radius: 999px; border: 1px solid var(--border-strong); background: transparent; color: var(--text-2); cursor: pointer; display: grid; place-items: center; transition: background .14s; }
        .ed-hbtn:hover { background: var(--surface); }
        .ed-hbtn.solid { background: var(--surface-3); border-color: transparent; }
        .ed-assist-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .ed-msg { padding: 10px 12px; border-radius: 14px; font-size: 13.5px; line-height: 1.5; max-width: 92%; }
        .ed-msg.user { align-self: flex-end; background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
        .ed-msg.ai { align-self: flex-start; background: var(--surface); color: var(--text); border-bottom-left-radius: 4px; }
        .ed-msg-tools { font-size: 11px; color: var(--text-3); font-family: var(--font-mono); margin-top: 4px; padding-left: 4px; }
        .ed-msg-empty { color: var(--text-3); font-size: 13px; line-height: 1.55; text-align: center; margin: 40px 4px 0; }

        /* Designed thinking / generation loading state */
        .ed-think { align-self: flex-start; max-width: 92%; display: flex; flex-direction: column; gap: 10px; }
        .ed-think-row { display: flex; align-items: center; gap: 8px; }
        .ed-think-spark {
          width: 26px; height: 26px; border-radius: 8px; flex: none; display: grid; place-items: center;
          background: var(--accent-soft); color: var(--accent-2);
          animation: edThinkPulse 1.4s ease-in-out infinite;
        }
        .ed-think-text {
          font-size: 13px; color: var(--text-2); line-height: 1.4;
          background: linear-gradient(90deg, var(--text-3) 0%, var(--text) 50%, var(--text-3) 100%);
          background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: edShimmer 1.8s linear infinite;
        }
        .ed-gen-card {
          display: flex; align-items: center; gap: 12px; padding: 12px;
          background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
        }
        .ed-gen-stack { position: relative; width: 46px; height: 46px; flex: none; }
        .ed-gen-thumb {
          position: absolute; inset: 0; border-radius: 9px; border: 1px solid var(--border-strong);
          background: linear-gradient(135deg, #8a3ffc33, #2dd4bf22);
        }
        .ed-gen-thumb:nth-child(1) { transform: rotate(-8deg) translate(-2px,1px); opacity: .5; }
        .ed-gen-thumb:nth-child(2) { transform: rotate(5deg) translate(2px,-1px); opacity: .75; }
        .ed-gen-thumb:nth-child(3) {
          background: linear-gradient(135deg, var(--accent), #2dd4bf);
          animation: edSpin 1.1s linear infinite;
          display: grid; place-items: center; color: #fff;
        }
        .ed-gen-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .ed-gen-title { font-size: 12.5px; font-weight: 600; color: var(--text); }
        .ed-gen-queue { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-3); }
        .ed-gen-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-2); animation: edThinkPulse 1.2s ease-in-out infinite; }
        @keyframes edShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes edThinkPulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
        @keyframes edSpin { to { transform: rotate(360deg); } }
        .ed-assist-foot { flex: none; padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 10px; }
        .ed-prompt {
          background: var(--bg-elev); border: 1px solid var(--border-strong);
          border-radius: 18px; padding: 12px; display: flex; flex-direction: column; gap: 10px;
        }
        .ed-prompt-input { background: transparent; border: none; outline: none; color: var(--text); font-size: 14px; font-family: var(--font); min-height: 22px; }
        .ed-prompt-input::placeholder { color: var(--text-4); }
        .ed-prompt-bar { display: flex; align-items: center; gap: 8px; }
        .ed-prompt-context { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: var(--accent-soft); color: var(--accent-2); border-radius: 999px; font-size: 12px; font-weight: 500; }
        .ed-prompt-send { margin-left: auto; width: 32px; height: 32px; border-radius: 999px; border: none; background: var(--accent); color: #fff; cursor: pointer; display: grid; place-items: center; }
        .ed-prompt-send:disabled { opacity: 0.5; cursor: default; }
        .ed-prompt-foot { font-size: 11px; color: var(--text-4); text-align: center; }

        /* ── Center column ── */
        .ed-center { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; padding: 24px 8px 16px; gap: 16px; }
        .ed-cmdbar {
          flex: none; height: 48px;
          background: var(--bg-elev); border: 1px solid var(--border); border-radius: 16px;
          display: flex; align-items: center; gap: 8px;
          padding: 0 12px;
        }
        .ed-name {
          background: transparent; border: none; outline: none;
          color: var(--text); font-family: var(--font-display); font-weight: 500;
          font-size: 14px; min-width: 100px; max-width: 240px;
        }
        .ed-cmdbtn { height: 32px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-family: var(--font-display); font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .ed-cmdbtn:disabled { opacity: 0.5; cursor: default; }
        .ed-cmdbtn.primary { background: var(--accent); color: #fff; border-color: transparent; }
        .ed-cmdbtn.active { background: var(--accent-soft); border-color: rgba(138,63,252,0.4); color: var(--accent-2); }
        .ed-cmdbtn.icon { width: 32px; padding: 0; justify-content: center; }
        .ed-time { font-family: var(--font-mono); font-size: 12.5px; color: var(--text-2); min-width: 96px; text-align: center; }
        .ed-sep { width: 1px; height: 20px; background: var(--border-strong); }

        .ed-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; position: relative; }
        .ed-stage-card {
          width: 100%; height: 100%;
          background: var(--bg-elev);
          border: 1px solid var(--border); border-radius: 16px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          position: relative;
        }
        .ed-toolbar-float { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 30; }
        .ed-err {
          position: absolute; bottom: 16px; left: 16px;
          background: var(--bg-elev); border: 1px solid var(--red);
          padding: 10px 14px; border-radius: 12px;
          color: var(--red); font-size: 13px; display: flex; gap: 10px; align-items: center;
        }
        .ed-narrating {
          position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
          background: var(--bg-elev); border: 1px solid var(--border-strong);
          padding: 8px 14px; border-radius: 9999px; box-shadow: var(--shadow-pop);
          color: var(--text-2); font-size: 12.5px; display: flex; gap: 9px; align-items: center; z-index: 30;
        }
        .ed-timeline-wrap { flex: none; }

        /* ── Right drawer ── */
        .ed-drawer-col { display: flex; height: 100%; padding: 24px 16px 16px 0; }
        .ed-drawer {
          width: 280px; flex: none; display: flex; flex-direction: column;
          background: var(--bg-elev); border: 1px solid var(--border);
          border-radius: var(--r-panel);
          box-shadow: 0 2px 4px rgba(0,0,0,0.16);
          overflow: hidden;
        }
        /* defang LayerPanel's own chrome so it fills our director drawer */
        .ed-drawer > div:first-child { width: 100% !important; border-right: none !important; background: transparent !important; flex: 1 !important; }
        .ed-drawer-tab {
          align-self: center; margin: auto 0;
          width: 28px; height: 56px; border-radius: 12px 0 0 12px;
          background: var(--bg-elev); border: 1px solid var(--border); border-right: none;
          color: var(--text-2); cursor: pointer; display: grid; place-items: center;
        }
      `}</style>

      {/* ── LEFT: Vibe Motion assist (chat) ── */}
      <aside className="ed-assist">
        <div className="ed-assist-frame">
          <div className="ed-assist-head">
            <span className="ed-assist-title">Vibe Motion</span>
            <button className="ed-hbtn" onClick={() => setChat([])} aria-label="New chat"><Icon name="plus" size={16} /></button>
            <button className="ed-hbtn" aria-label="History"><Icon name="undo" size={16} /></button>
            <button className="ed-hbtn solid" onClick={() => nav('/studio')} aria-label="Close"><Icon name="close" size={16} /></button>
          </div>

          <div className="ed-assist-body">
            {chat.length === 0 && (
              <div className="ed-msg-empty">
                <Icon name="sparkle" size={24} style={{ color: 'var(--accent-2)' }} />
                <p style={{ marginTop: 10 }}>Describe any change and I'll apply it — move elements, restyle text, add subtitles, reformat, or tighten transitions.</p>
              </div>
            )}
            {chat.map((m) =>
              m.id === 'pending' ? (
                <div key={m.id} className="ed-think">
                  <div className="ed-think-row">
                    <span className="ed-think-spark"><Icon name="sparkle" size={15} /></span>
                    <span className="ed-think-text">{m.text}</span>
                  </div>
                  <div className="ed-gen-card">
                    <div className="ed-gen-stack">
                      <div className="ed-gen-thumb" />
                      <div className="ed-gen-thumb" />
                      <div className="ed-gen-thumb"><Icon name="sparkle" size={16} /></div>
                    </div>
                    <div className="ed-gen-meta">
                      <span className="ed-gen-title">Composing your scene</span>
                      <span className="ed-gen-queue"><span className="ed-gen-dot" /> In queue · working</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className={`ed-msg ${m.role}`}>{m.text}</div>
                  {m.toolCalls && m.toolCalls.length > 0 && (
                    <div className="ed-msg-tools">{m.toolCalls.map((t, i) => <div key={i}>↳ {t.tool}</div>)}</div>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="ed-assist-foot">
            <div className="ed-prompt">
              <PromptInput onSend={onRunAssist} />
              <div className="ed-prompt-bar">
                <span className="ed-prompt-context">
                  <Icon name="sparkle" size={12} />
                  {selName ? selName : 'Whole video'}
                </span>
              </div>
            </div>
            <div className="ed-prompt-foot">ImagineArt can make mistakes. Check important info.</div>
          </div>
        </div>
      </aside>

      {/* ── CENTER: command bar + stage + timeline ── */}
      <div className="ed-center">
        <div className="ed-cmdbar">
          <button className="ed-cmdbtn icon" onClick={() => nav('/studio')} aria-label="Back"><Icon name="arrowLeft" size={16} /></button>
          <input className="ed-name" defaultValue={project.name} onBlur={(e) => store.renameProject(id, e.target.value)} />
          <div className="ed-sep" />
          <button className="ed-cmdbtn icon" disabled={useLive ? compHist.current.past.length === 0 : !store.canUndo(id)} onClick={() => (useLive ? compUndo() : store.undo(id))} aria-label="Undo"><Icon name="undo" size={15} /></button>
          <button className="ed-cmdbtn icon" disabled={useLive ? compHist.current.future.length === 0 : !store.canRedo(id)} onClick={() => (useLive ? compRedo() : store.redo(id))} aria-label="Redo"><Icon name="redo" size={15} /></button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }} data-tour="export">
            <span className="ed-cmdbtn"><Icon name="image" size={14} /> {aspect}</span>
            {useLive && (
              <button
                className={`ed-cmdbtn${narrationUrl ? ' active' : ''}`}
                onClick={genNarration}
                disabled={narrating}
                title={narrationUrl ? 'Regenerate narration' : 'Generate AI narration'}
              >
                <Icon name="sparkle" size={14} />
                {narrating ? 'Narrating…' : narrationUrl ? 'Re-narrate' : 'Narrate'}
              </button>
            )}
            <button className="ed-cmdbtn" onClick={() => setExportOpen(true)}><Icon name="download" size={14} /> Export</button>
            <button className="ed-cmdbtn primary" onClick={() => setPublishOpen(true)}><Icon name="share" size={14} /> Publish</button>
          </div>
        </div>

        <div className="ed-stage">
          <div className="ed-stage-card">
            {useLive ? (
              <LiveCanvas
                html={project.composedHtml!}
                aspect={aspect}
                time={time}
                reloadKey={reloadKey}
                selectedEid={selectedEid}
                onSelect={setSelectedEid}
                onElements={setCompEls}
                onPersist={onPersistComposition}
              />
            ) : (
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
            )}
            {!useLive && sel && (
              <div className="ed-toolbar-float">
                <ContextualToolbar el={sel} isText={selIsText} onChange={patchSel} onDelete={deleteSel} onDuplicate={duplicateSel} />
              </div>
            )}
            {/* narration audio — synced to the preview transport */}
            {narrationUrl && <audio key={narrNonce} ref={audioRef} src={`${narrationUrl}?v=${narrNonce}`} preload="auto" style={{ display: 'none' }} />}
            {rendering && <RenderOverlay progress={progress} stage={stage} />}
            {narrating && (
              <div className="ed-narrating">
                <span className="ed-think-spark"><Icon name="sparkle" size={14} /></span>
                Writing & voicing narration…
              </div>
            )}
            {narrErr && (
              <div className="ed-err" onClick={() => setNarrErr(null)}>
                <Icon name="close" size={16} /> {narrErr}
              </div>
            )}
            {renderErr && (
              <div className="ed-err">
                <Icon name="close" size={16} /> {renderErr}
                <button className="ed-cmdbtn" onClick={startExportRender}>Retry</button>
              </div>
            )}
            {tour && <FirstRunTour onDone={() => { setTour(false); localStorage.setItem(`ms-tour-${id}`, '1') }} />}
          </div>
        </div>

        <div className="ed-timeline-wrap">
          <Timeline
            id={id}
            time={time}
            duration={duration}
            zoom={zoom}
            onZoom={setZoom}
            onSeek={(t) => { setTime(Math.max(0, Math.min(duration, t))); setPlaying(false) }}
            playing={playing}
            onPlay={() => setPlaying((p) => !p)}
            onSeekStart={() => { setTime(0); setPlaying(false) }}
          />
        </div>
      </div>

      {/* ── RIGHT: collapsible layers drawer ── */}
      {rightOpen ? (
        <div className="ed-drawer-col">
          <div className="ed-drawer">
            {useLive
              ? <CompositionLayers els={compEls} selectedEid={selectedEid} onSelect={setSelectedEid} onCollapse={() => setRightOpen(false)} />
              : <LayerPanel id={id} scene={currentScene} onCollapse={() => setRightOpen(false)} />}
          </div>
        </div>
      ) : (
        <button className="ed-drawer-tab" onClick={() => setRightOpen(true)} aria-label="Expand layers">
          <Icon name="chevLeft" size={16} />
        </button>
      )}

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} project={project} videoUrl={videoUrl} onRender={startExportRender} rendering={rendering} progress={progress} stage={stage} />
      <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} project={project} />
    </div>
  )
}

/* Inline auto-expanding prompt input used in the assist panel */
function PromptInput({ onSend }: { onSend: (v: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <textarea
      className="ed-prompt-input"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && val.trim()) {
          e.preventDefault()
          onSend(val)
          setVal('')
        }
      }}
      placeholder="Ask AI to edit your video…"
      rows={1}
      style={{ resize: 'none' }}
    />
  )
}

// Layers panel derived from the live composition (one model with the canvas)
function CompositionLayers({ els, selectedEid, onSelect, onCollapse }: { els: import('../components/LiveCanvas').CompEl[]; selectedEid: string | null; onSelect: (eid: string | null) => void; onCollapse: () => void }) {
  const texts = els.filter((e) => e.kind === 'text')
  const media = els.filter((e) => e.kind === 'image')
  const Row = ({ e }: { e: import('../components/LiveCanvas').CompEl }) => (
    <button
      onClick={() => onSelect(selectedEid === e.eid ? null : e.eid)}
      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: selectedEid === e.eid ? 'var(--accent-soft)' : 'transparent', color: selectedEid === e.eid ? 'var(--accent-2)' : 'var(--text-2)', marginBottom: 2 }}
      onMouseEnter={(ev) => { if (selectedEid !== e.eid) ev.currentTarget.style.background = 'var(--surface)' }}
      onMouseLeave={(ev) => { if (selectedEid !== e.eid) ev.currentTarget.style.background = 'transparent' }}
    >
      <Icon name={e.kind === 'image' ? 'image' : 'type'} size={15} style={{ flex: 'none' }} />
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label || (e.kind === 'image' ? 'Image' : 'Text')}</span>
    </button>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15, color: 'var(--text)' }}>
        Layers
        <button onClick={onCollapse} aria-label="Collapse" style={{ width: 28, height: 28, borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="chevRight" size={16} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {els.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: 12.5, textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>Reading the composition…<br />text & media elements appear here.</div>}
        {texts.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-4)', margin: '4px 6px 8px' }}>TEXT</div>}
        {texts.map((e) => <Row key={e.eid} e={e} />)}
        {media.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-4)', margin: '14px 6px 8px' }}>MEDIA</div>}
        {media.map((e) => <Row key={e.eid} e={e} />)}
      </div>
    </div>
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
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus()
      document.execCommand('selectAll', false, undefined)
    }
  }, [editing])

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
    <div ref={textRef} contentEditable={editing} suppressContentEditableWarning
      onBlur={(e) => onCommitText(e.currentTarget.textContent || '')}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLElement).blur() } }}
      style={{ ...style, cursor: editing ? 'text' : 'inherit' }}>{content}</div>
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

import { useEffect, useRef, useState } from 'react'
import type { VideoProject } from '../../types'
import { stubFrameVisual } from '../../engine/stub'
import { useCaseDef } from '../../spec'
import { TemplatePreview } from '../cards'
import { Icon } from '../Icon'

const ASPECT: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 }

function useFit(ratio: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current; if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      let w = width, h = w / ratio
      if (h > height) { h = height; w = h * ratio }
      setBox({ w: Math.round(w), h: Math.round(h) })
    }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect()
  }, [ratio])
  return { ref, box }
}

function timeAgo(ts: number) {
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function fmt(s: number) { const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return `${m}:${ss.toString().padStart(2, '0')}` }

// The final result view — opens AS A MODAL over the dashboard (ImagineArt-style).
// Big player on the left with a floating toolbar; details + actions panel on the right.
export function ResultModal({ project, onClose }: { project: VideoProject; onClose: () => void }) {
  const spec = project.spec
  const aspect = project.config.aspect
  const ratio = ASPECT[aspect] || 16 / 9
  const { ref, box } = useFit(ratio)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const rafRef = useRef<number>()
  const duration = project.config.durationSec
  const url = project.generatedVideoUrl

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // playback clock — drives the storyboard frame switch when there is no MP4
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const tick = (now: number) => {
      const v = videoRef.current
      if (v && url) {
        setTime(v.currentTime)
        if (v.ended || v.currentTime >= duration - 0.02) { setPlaying(false); return }
      } else {
        const dt = (now - last) / 1000; last = now
        setTime((t) => { const nt = t + dt; if (nt >= duration) { setPlaying(false); return duration } return nt })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current!)
  }, [playing, duration, url])

  useEffect(() => {
    const v = videoRef.current; if (!v || !url) return
    if (playing) v.play().catch(() => {}); else v.pause()
  }, [playing, url])

  const frames = project.frames || []
  const cur = frames.find((f) => time >= f.start && time < f.end) || frames[frames.length - 1] || frames[0]
  const specFrame = spec?.frames.find((sf) => sf.id === cur?.id) || spec?.frames[cur?.index ?? 0]
  const vis = spec && specFrame ? stubFrameVisual(specFrame, spec.brand, spec, 0, 0) : null
  const def = spec ? useCaseDef(spec.useCase) : null
  const model = project.videoPlan?.model || def?.model || 'kling'
  const modelName = model === 'kling' ? 'Kling' : 'Seedance 2'

  const trackRef = useRef<HTMLDivElement | null>(null)
  const seek = (e: React.MouseEvent) => {
    const el = trackRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    const t = ((e.clientX - r.left) / r.width) * duration
    setTime(Math.max(0, Math.min(duration, t)))
    if (videoRef.current && url) { try { videoRef.current.currentTime = t } catch { /* */ } }
  }

  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', display: 'flex', animation: 'fadeUp .18s ease' }}>
      <style>{`
        .rm-tab { padding: 9px 14px; font-size: 12.5px; font-weight: 600; border-radius: 999px; border: 1px solid transparent; background: transparent; color: var(--text-3); cursor: pointer; transition: all .14s; }
        .rm-tab.sel { background: var(--surface-3); color: var(--text); }
        .rm-actrow { display: grid; grid-template-columns: 60px 1fr; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); }
        .rm-actrow:last-child { border-bottom: none; }
        .rm-actlabel { font-size: 12.5px; color: var(--text-3); }
        .rm-actbtns { display: flex; gap: 8px; justify-content: flex-end; }
        .rm-actbtn { flex: 1; max-width: 110px; padding: 9px 0; border-radius: 9px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); font-size: 12.5px; font-weight: 600; cursor: pointer; opacity: .65; transition: opacity .14s, border-color .14s; }
        .rm-actbtn:not(:disabled):hover { opacity: 1; border-color: var(--accent); }
        .rm-actbtn:disabled { cursor: default; }
        .rm-toolpill { display: inline-flex; align-items: center; gap: 7px; padding: 10px 14px; border-radius: 999px; border: none; background: rgba(20,20,22,.7); backdrop-filter: blur(8px); color: var(--text); font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background .14s; }
        .rm-toolpill:not(:disabled):hover { background: var(--accent); color: #fff; }
        .rm-toolpill:disabled { opacity: .7; cursor: default; }
        .rm-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 999px; border: none; background: rgba(0,0,0,.55); backdrop-filter: blur(6px); color: #fff; display: grid; place-items: center; cursor: pointer; transition: background .14s; opacity: .5; }
        .rm-nav:not(:disabled):hover { background: var(--accent); opacity: 1; }
        .rm-nav:disabled { cursor: default; }
      `}</style>

      <div onMouseDown={(e) => e.stopPropagation()} style={{ flex: 1, display: 'flex', background: 'var(--bg)', animation: 'scaleIn .2s var(--ease)' }}>
        {/* ── LEFT: player + bottom toolbar ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '28px 32px 24px', position: 'relative' }}>
          {/* Player */}
          <div ref={ref} style={{ flex: 1, minHeight: 0, position: 'relative', display: 'grid', placeItems: 'center' }}>
            <button className="rm-nav" style={{ left: 0 }} disabled aria-label="Previous"><Icon name="chevLeft" size={18} /></button>
            <div style={{ position: 'relative', width: box.w || '100%', height: box.h || undefined, aspectRatio: box.w ? undefined : String(ratio), borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', background: '#0a0a0c' }}>
              {url ? (
                <video ref={videoRef} src={url} preload="auto" playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#0a0a0c' }} />
              ) : vis ? (
                <TemplatePreview key={cur?.id} register={vis.register} palette={vis.palette} title={vis.title} kicker={vis.kicker} ratio={ratio} />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)', fontSize: 13 }}>Preparing…</div>
              )}
              {/* Transport overlay */}
              <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 999, background: 'rgba(10,10,12,.6)', backdropFilter: 'blur(6px)' }}>
                <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'} style={{ width: 30, height: 30, borderRadius: 999, border: 'none', background: 'transparent', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                  <Icon name={playing ? 'pause' : 'play'} size={16} />
                </button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'rgba(255,255,255,.85)', minWidth: 70 }}>{fmt(time)} / {fmt(duration)}</span>
                <div ref={trackRef} onClick={seek} style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,.18)', cursor: 'pointer', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, (time / (duration || 1)) * 100)}%`, background: '#fff', borderRadius: 99 }} />
                </div>
                <button aria-label="Fullscreen" style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(255,255,255,.7)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="image" size={14} /></button>
              </div>
            </div>
            <button className="rm-nav" style={{ right: 0 }} disabled aria-label="Next"><Icon name="chevRight" size={18} /></button>
          </div>

          {/* Bottom action toolbar */}
          <div style={{ flex: 'none', marginTop: 20, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 8, padding: 6, background: 'rgba(20,20,22,.55)', border: '1px solid var(--border)', borderRadius: 999, backdropFilter: 'blur(8px)' }}>
              <button className="rm-toolpill" disabled title="Wired later"><Icon name="motion" size={14} /> Motion Control</button>
              <button className="rm-toolpill" disabled title="Wired later"><Icon name="image" size={14} /> Reframe</button>
              <button className="rm-toolpill" disabled title="Wired later"><Icon name="apps" size={14} /> Color Correction</button>
              <button className="rm-toolpill" disabled title="Wired later"><Icon name="trash" size={14} /> Remove Object</button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: details panel ── */}
        <aside style={{ width: 380, flex: 'none', background: 'var(--bg-elev)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header: Download + share/close */}
          <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {url ? (
              <a href={url} download={`${project.name}.mp4`} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 11, background: 'var(--accent-grad)', color: '#fff', fontSize: 14, fontWeight: 650, boxShadow: '0 4px 18px var(--accent-glow)' }}>
                <Icon name="download" size={15} /> Download
              </a>
            ) : (
              <button style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', borderRadius: 11, background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: 14, fontWeight: 650, border: 'none', cursor: 'default' }} disabled>
                <Icon name="download" size={15} /> Download
              </button>
            )}
            <button aria-label="More" style={{ width: 38, height: 38, borderRadius: 999, border: 'none', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="grip" size={15} /></button>
            <button aria-label="Share" style={{ width: 38, height: 38, borderRadius: 999, border: 'none', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="share" size={15} /></button>
            <button onClick={onClose} aria-label="Close" style={{ width: 38, height: 38, borderRadius: 999, border: 'none', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={15} /></button>
          </div>

          {/* By + time */}
          <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: '1px solid var(--border)' }}>
            <span style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--accent-grad)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flex: 'none' }}>{project.name.charAt(0).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{project.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>Created {timeAgo(project.createdAt)}</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ padding: '14px 16px 6px', display: 'flex', gap: 6 }}>
            <button className="rm-tab sel"><Icon name="check" size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Details</button>
            <button className="rm-tab" disabled style={{ cursor: 'default', opacity: .55 }}>Comments (0)</button>
          </div>

          <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Prompt */}
            {(spec?.product.description || def) && (
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
                {def && <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-2)', fontWeight: 600, fontSize: 12, marginRight: 6 }}>{def.title}</span>}
                {spec?.product.description || spec?.style.treatment}
              </div>
            )}

            {/* Images */}
            {spec && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Images</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)', background: 'var(--surface-2)', padding: '3px 9px', borderRadius: 999 }}>
                    <Icon name="motion" size={11} /> {modelName}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {spec.product.images.length > 0 ? (
                    spec.product.images.map((im) => <img key={im.id} src={im.dataUrl} alt={im.name} style={{ width: 36, height: 36, borderRadius: 7, objectFit: 'cover', border: '1px solid var(--border-strong)' }} />)
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>No reference images</span>
                  )}
                </div>
              </div>
            )}

            {/* Located */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 8 }}>Located</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13 }}>
                <Icon name="grip" size={14} /> Default Folder
              </div>
            </div>

            {/* Creation Actions */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Creation Actions</div>
              <div className="rm-actrow">
                <span className="rm-actlabel">Extend</span>
                <div className="rm-actbtns">
                  <button className="rm-actbtn" disabled>Auto</button>
                  <button className="rm-actbtn" disabled>Manually</button>
                </div>
              </div>
              <div className="rm-actrow">
                <span className="rm-actlabel">Upscale</span>
                <div className="rm-actbtns"><button className="rm-actbtn" disabled style={{ maxWidth: 228 }}>Upscale</button></div>
              </div>
              <div className="rm-actrow">
                <span className="rm-actlabel">Edit</span>
                <div className="rm-actbtns"><button className="rm-actbtn" disabled style={{ maxWidth: 228 }}>Edit</button></div>
              </div>
              <div className="rm-actrow">
                <span className="rm-actlabel">Use</span>
                <div className="rm-actbtns">
                  <button className="rm-actbtn" disabled>Image</button>
                  <button className="rm-actbtn" disabled>Prompt</button>
                  <button className="rm-actbtn" disabled style={{ opacity: .35 }}>Effect</button>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8 }}>Stubbed preview — model actions wire in later.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

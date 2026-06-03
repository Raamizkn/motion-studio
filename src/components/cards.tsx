import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudioTemplate, VideoProject } from '../types'
import { Icon } from './Icon'
import { useStore } from '../store'

// Bespoke editorial preview — matches the warm-paper / serif register the
// YC-style template actually produces, so the card reads true to the output.
function EditorialPreview({ ratio = 16 / 9 }: { ratio?: number }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${ratio}`, background: '#F5F2EC', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, padding: '14% 12%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8A8575', marginBottom: 8 }}>Introducing</div>
        <div style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 700, fontSize: 26, lineHeight: 1.04, color: '#141414', letterSpacing: '-0.01em' }}>
          Built for the<br />people who <span style={{ color: '#3B5BDB' }}>make</span><br />things.
        </div>
        <div style={{ position: 'absolute', right: '8%', bottom: '8%', fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 700, fontSize: 40, color: 'rgba(20,20,20,0.07)' }}>2025</div>
      </div>
    </div>
  )
}

// Premium static preview that reads like the real Claude output (dark cinematic
// product register) — used wherever there's no live composition to thumbnail.
// Replaces the old scene-graph ScenePreview everywhere it leaked into the UI.
export function Poster({ palette, kicker, title, ratio = 16 / 9 }: { palette?: string[]; kicker?: string; title?: string; ratio?: number }) {
  const accent = palette?.[0] || '#8a3ffc'
  const accent2 = palette?.[1] || '#2dd4bf'
  const words = (title || 'Vibe Motion').split(' ')
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${ratio}`, background: '#0a0a0c', overflow: 'hidden', containerType: 'inline-size' }}>
      {/* mesh accent glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 80% at 78% 18%, ${accent}44, transparent 60%), radial-gradient(55% 70% at 12% 92%, ${accent2}33, transparent 60%)` }} />
      {/* hairline grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '14% 22%' }} />
      <div style={{ position: 'absolute', inset: 0, padding: '12% 11%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6%' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '6.5cqw', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>{kicker || 'Vibe Motion'}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15cqw', lineHeight: 0.96, letterSpacing: '-0.03em', color: '#fff' }}>
          {words.slice(0, 2).join(' ')} <span style={{ color: accent2 }}>{words.slice(2, 4).join(' ')}</span>
        </div>
        <div style={{ width: '26%', height: '3px', borderRadius: 2, background: accent }} />
      </div>
    </div>
  )
}

type PReg = NonNullable<StudioTemplate['register']>
const ASPECT_NUM: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 }

const LOOP = 6 // seconds — shared loop length so previews "play" continuously
const EASE = 'cubic-bezier(.22,.9,.3,1)'
const an = (name: string, delay = 0, dur = LOOP): React.CSSProperties => ({ animation: `${name} ${dur}s ${EASE} ${delay}s infinite both` })

// Distinct per-register LOOPING previews — each register reads visually different
// (fonts, colour, layout, motion) and animates on a loop so cards play like video.
export function TemplatePreview({ register, palette, title, kicker, ratio }: { register?: PReg; palette?: string[]; title: string; kicker: string; ratio: number }) {
  const p = palette && palette.length ? palette : ['#8a3ffc', '#2dd4bf', '#0a0a0c']
  const a = p[0], b = p[1] || p[0]
  const box = (extra: React.CSSProperties): React.CSSProperties => ({ position: 'relative', width: '100%', aspectRatio: `${ratio}`, overflow: 'hidden', containerType: 'inline-size', ...extra })
  const grain = 'radial-gradient(rgba(255,255,255,.06) 0.5px, transparent 0.6px)'
  const words = title.split(' ')

  switch (register) {
    case 'editorial':
      return (
        <div style={box({ background: '#f4f1ea' })}>
          <div style={{ position: 'absolute', right: '-4%', top: '0%', fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: '46cqw', lineHeight: 1, color: 'rgba(20,20,20,.05)', ...an('vmDrift', 0, 14) }}>{(kicker || 'A')[0]}</div>
          <div style={{ position: 'absolute', inset: 0, padding: '14% 11%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5%' }}>
            <div style={{ ...an('vmUp', 0.1), fontFamily: 'var(--font-display)', fontSize: '4cqw', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#8a8575' }}>{kicker}</div>
            <div style={{ ...an('vmUp', 0.28), fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 700, fontSize: '13cqw', lineHeight: 1.02, letterSpacing: '-0.02em', color: '#161616' }}>{title}</div>
            <div style={{ ...an('vmWipe', 0.5), width: '34%', height: 2, background: a }} />
          </div>
        </div>
      )
    case 'minimal':
      return (
        <div style={box({ background: '#f6f5f2' })}>
          <div style={{ position: 'absolute', inset: 0, padding: '15% 12%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '7%' }}>
            <div style={{ ...an('vmUp', 0.1), fontFamily: 'var(--font-display)', fontSize: '3.8cqw', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#a39e94' }}>{kicker}</div>
            <div style={{ ...an('vmUp', 0.26), fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '11cqw', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#1a1a1a' }}>{title}</div>
            <div style={{ ...an('vmWipe', 0.46), width: '28%', height: 1.5, background: '#1a1a1a' }} />
          </div>
        </div>
      )
    case 'bold':
      return (
        <div style={box({ background: a })}>
          <div style={{ position: 'absolute', inset: 0, ...an('vmDrift', 0, 10), background: `radial-gradient(60% 60% at 70% 18%, ${b}aa, transparent 70%)` }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: grain, backgroundSize: '4px 4px', opacity: 0.4, mixBlendMode: 'overlay' }} />
          <div style={{ position: 'absolute', inset: 0, padding: '9%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '4%' }}>
            <div style={{ fontFamily: "'Archivo Black', var(--font-display)", fontSize: '21cqw', lineHeight: 0.86, letterSpacing: '-0.03em', color: '#fff', textTransform: 'uppercase' }}>
              {words.map((w, i) => <span key={i} style={{ display: 'inline-block', marginRight: '0.18em', ...an('vmPop', 0.12 + i * 0.12) }}>{w}</span>)}
            </div>
            <div style={{ ...an('vmScale', 0.5), alignSelf: 'flex-start', background: '#fff', color: a, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '4.2cqw', padding: '4px 10px', borderRadius: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kicker}</div>
          </div>
        </div>
      )
    case 'presentation':
      return (
        <div style={box({ background: '#fbfbfd' })}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '12%', background: a, ...an('vmWipe', 0) }} />
          <div style={{ position: 'absolute', inset: 0, padding: '12% 9% 9%', display: 'flex', flexDirection: 'column', gap: '5.5%' }}>
            <div style={{ ...an('vmUp', 0.18), fontFamily: "'Space Grotesk', var(--font-display)", fontWeight: 700, fontSize: '8cqw', color: '#16181d', letterSpacing: '-0.01em', marginTop: '5%' }}>{title}</div>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...an('vmUp', 0.4 + i * 0.2), display: 'flex', alignItems: 'center', gap: '3%' }}>
                <span style={{ width: '3.4cqw', height: '3.4cqw', borderRadius: 2, background: b, flex: 'none' }} />
                <span style={{ height: '3cqw', width: `${72 - i * 16}%`, background: '#e4e5eb', borderRadius: 2 }} />
              </div>
            ))}
            <div style={{ position: 'absolute', bottom: '6%', right: '8%', fontFamily: 'var(--font-mono)', fontSize: '3.4cqw', color: '#b3b6c2' }}>01 / 06</div>
          </div>
        </div>
      )
    case 'infographic':
      return (
        <div style={box({ background: '#0d1017' })}>
          <div style={{ position: 'absolute', inset: 0, padding: '9%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ ...an('vmUp', 0.1), fontFamily: "'Space Grotesk', var(--font-display)", fontWeight: 700, fontSize: '5.5cqw', color: '#fff', letterSpacing: '.02em' }}>{kicker}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4%', height: '44%' }}>
              {[42, 68, 54, 88, 72].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '3px 3px 0 0', transformOrigin: 'bottom', background: i % 2 ? b : a, opacity: 0.6 + i * 0.08, ...an('vmBar', 0.15 + i * 0.1) }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3%' }}>
              <span style={{ ...an('vmPop', 0.7), fontFamily: "'Space Grotesk', var(--font-display)", fontWeight: 700, fontSize: '15cqw', color: a, letterSpacing: '-0.03em' }}>{(title.match(/\d[\d.,]*[%×x]?/) || ['+212%'])[0]}</span>
              <span style={{ ...an('vmUp', 0.85), fontFamily: 'var(--font-display)', fontSize: '4.2cqw', color: 'rgba(255,255,255,.62)' }}>{title.replace(/[\d.,%+×x]/g, '').trim().slice(0, 16) || 'growth'}</span>
            </div>
          </div>
        </div>
      )
    case 'poster':
      return (
        <div style={box({ background: `linear-gradient(150deg, ${a}, ${b})` })}>
          <div style={{ position: 'absolute', inset: 0, ...an('vmDrift', 0, 12), background: `radial-gradient(50% 50% at 30% 30%, ${b}, transparent 70%)`, opacity: 0.55 }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: grain, backgroundSize: '3px 3px', opacity: 0.5, mixBlendMode: 'overlay' }} />
          <div style={{ position: 'absolute', inset: 0, padding: '11%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5%' }}>
            <div style={{ ...an('vmWipe', 0.1), width: '22%', height: 3, background: 'rgba(255,255,255,.8)' }} />
            <div style={{ fontFamily: "'Archivo Black', var(--font-display)", fontSize: '17cqw', lineHeight: 0.9, letterSpacing: '-0.03em', color: '#fff' }}>
              {words.map((w, i) => <span key={i} style={{ display: 'inline-block', marginRight: '0.16em', ...an('vmPop', 0.18 + i * 0.13) }}>{w}</span>)}
            </div>
            <div style={{ ...an('vmUp', 0.6), fontFamily: 'var(--font-display)', fontSize: '3.8cqw', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,.82)' }}>{kicker}</div>
          </div>
        </div>
      )
    case 'product':
    default:
      return (
        <div style={box({ background: '#08080b' })}>
          <div style={{ position: 'absolute', inset: 0, ...an('vmDrift', 0, 11), background: `radial-gradient(55% 70% at 78% 16%, ${a}55, transparent 60%), radial-gradient(50% 60% at 14% 92%, ${b}3a, transparent 60%)` }} />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '14% 22%' }} />
          <div style={{ position: 'absolute', inset: 0, padding: '11%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5%' }}>
            <div style={{ ...an('vmUp', 0.1), fontFamily: "'Space Grotesk', var(--font-display)", fontSize: '4cqw', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>{kicker}</div>
            <div style={{ ...an('vmUp', 0.26), fontFamily: "'Space Grotesk', var(--font-display)", fontWeight: 700, fontSize: '13cqw', lineHeight: 0.98, letterSpacing: '-0.03em', color: '#fff' }}>
              {words.slice(0, 2).join(' ')} <span style={{ color: b }}>{words.slice(2, 4).join(' ')}</span>
            </div>
            <div style={{ ...an('vmWipe', 0.5), width: '26%', height: 3, borderRadius: 2, background: a }} />
          </div>
        </div>
      )
  }
}

const THUMB_DIMS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 }, '9:16': { w: 1080, h: 1920 }, '1:1': { w: 1080, h: 1080 }, '4:5': { w: 1080, h: 1350 },
}
// Static thumbnail rendered from the real composition (seeked to a hold frame),
// so project previews match the actual output — never the old scene-graph seed.
// Live composition thumbnail. Holds a settled frame at rest; when `playing`
// (card hovered), it loops the real GSAP timeline so the card plays like a video.
function CompThumb({ html, aspect, playing }: { html: string; aspect: string; playing?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const iref = useRef<HTMLIFrameElement | null>(null)
  const tlRef = useRef<any>(null)
  const [w, setW] = useState(0)
  const dim = THUMB_DIMS[aspect] || THUMB_DIMS['16:9']
  useEffect(() => {
    const el = ref.current; if (!el) return
    const m = () => setW(el.getBoundingClientRect().width)
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect()
  }, [])
  const applyMode = (tl: any) => {
    if (!tl) return
    try {
      if (playing) { tl.repeat(-1); tl.play(0) }
      // settled hold: past the entrance, before mid transitions — never a fade
      else { tl.pause(); tl.repeat(0); tl.seek(Math.min(2.2, tl.duration() * 0.45)) }
    } catch { /* */ }
  }
  const onLoad = () => {
    const win = iref.current?.contentWindow as any
    let tries = 0
    const grab = () => {
      const tl = win?.__timelines?.main
      if (tl) { tlRef.current = tl; applyMode(tl) }
      else if (tries++ < 60) win?.setTimeout(grab, 40)
    }
    grab()
  }
  useEffect(() => { applyMode(tlRef.current) }, [playing])
  const scale = w ? w / dim.w : 0
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', aspectRatio: `${dim.w} / ${dim.h}`, overflow: 'hidden', background: '#0a0a0c', pointerEvents: 'none' }}>
      {scale > 0 && (
        <iframe ref={iref} srcDoc={html} onLoad={onLoad} title="" scrolling="no" tabIndex={-1}
          style={{ position: 'absolute', top: 0, left: 0, width: dim.w, height: dim.h, border: 'none', transformOrigin: 'top left', transform: `scale(${scale})` }} />
      )}
    </div>
  )
}

// Clean placeholder for projects still composing (no live composition yet) —
// branded and on-design, never the old scene-graph look.
function ComposingThumb({ aspect, composing }: { aspect: string; composing?: boolean }) {
  const dim = THUMB_DIMS[aspect] || THUMB_DIMS['16:9']
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: `${dim.w} / ${dim.h}`, overflow: 'hidden', background: '#0a0a0c', display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(60% 80% at 70% 20%, rgba(138,63,252,.28), transparent 60%)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-3)' }}>
        <span className={composing ? 'spin' : ''} style={{ color: 'var(--accent-2)' }}><Icon name="sparkle" size={22} /></span>
        <span style={{ fontSize: 11.5, letterSpacing: '0.04em' }}>{composing ? 'Composing…' : 'Preview pending'}</span>
      </div>
    </div>
  )
}

// Mosaic tile — each template renders at its NATURAL aspect ratio so the grid
// packs like puzzle pieces. Details live in a hover overlay, not a basic card.
export function TemplateCard({ tpl, onUse }: { tpl: StudioTemplate; onUse: (t: StudioTemplate) => void }) {
  const ratio = ASPECT_NUM[tpl.aspect] || 16 / 9
  return (
    <button className="tpl-tile" onClick={() => onUse(tpl)} style={{ aspectRatio: `${ratio}` }}>
      <div className="tpl-tile-art">
        <TemplatePreview register={tpl.register} palette={tpl.config.palette} title={tpl.name} kicker={tpl.category} ratio={ratio} />
      </div>
      <div className="tpl-tile-overlay">
        <div className="tpl-tile-meta">
          <div className="tpl-tile-name">{tpl.name}</div>
          <div className="tpl-tile-desc">{tpl.description}</div>
          <div className="tpl-tile-foot">
            <span>{tpl.aspect}</span><span>·</span><span>{tpl.durationSec}s</span><span>·</span><span>{tpl.category}</span>
          </div>
        </div>
        <span className="tpl-tile-cta">Use template <Icon name="arrowRight" size={14} /></span>
      </div>
    </button>
  )
}

// Project tile — same mosaic language as templates. Plays the real composition
// on hover; details live in the hover overlay. No status badges.
export function ProjectCard({ project }: { project: VideoProject }) {
  const nav = useNavigate()
  const [hover, setHover] = useState(false)
  const [menu, setMenu] = useState(false)
  const { renameProject, deleteProject, duplicateProject } = useStore()
  const ratio = ASPECT_NUM[project.config.aspect] || 16 / 9
  const dest = project.composedHtml || project.status === 'complete' || project.status === 'rendering'
    ? `/studio/projects/${project.id}/editor`
    : `/studio/projects/${project.id}/generate`

  return (
    <div
      className="tpl-tile"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setMenu(false) }}
      onClick={() => nav(dest)}
      style={{ aspectRatio: `${ratio}` }}
    >
      <div className="tpl-tile-art">
        {project.composedHtml
          ? <CompThumb html={project.composedHtml} aspect={project.config.aspect} playing={hover} />
          : <ComposingThumb aspect={project.config.aspect} composing={project.status === 'composing'} />}
      </div>

      {/* ⋮ menu */}
      <button
        className="tpl-menu-btn"
        onClick={(e) => { e.stopPropagation(); setMenu((m) => !m) }}
        style={{ opacity: hover || menu ? 1 : 0 }}
        aria-label="Project menu"
      >
        <Icon name="grip" size={15} />
      </button>
      {menu && (
        <div onClick={(e) => e.stopPropagation()} className="tpl-menu">
          {[
            { label: 'Rename', fn: () => { const n = prompt('Rename project', project.name); if (n) renameProject(project.id, n) } },
            { label: 'Duplicate', fn: () => duplicateProject(project.id) },
            { label: 'Delete', fn: () => deleteProject(project.id), danger: true },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => { a.fn(); setMenu(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7, fontSize: 13, color: a.danger ? 'var(--red)' : 'var(--text)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <div className="tpl-tile-overlay">
        <div className="tpl-tile-meta">
          <div className="tpl-tile-name">{project.name}</div>
          <div className="tpl-tile-foot">
            <span>{project.config.aspect}</span><span>·</span><span>{project.config.durationSec}s</span><span>·</span><span>{timeAgo(project.updatedAt)}</span>
          </div>
        </div>
        <span className="tpl-tile-cta">Open editor <Icon name="arrowRight" size={14} /></span>
      </div>
    </div>
  )
}

function timeAgo(ts: number) {
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

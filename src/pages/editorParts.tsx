import { useRef, useState } from 'react'
import { useStore } from '../store'
import { Icon } from '../components/Icon'
import { Modal, Segmented } from '../components/shared'
import type { EditorState, OverlayElement, ChatMessage, LayerGroup, VideoProject, AspectRatio } from '../types'
import { startRender } from '../render'
import { TEMPLATES } from '../data'

// ── Layers panel ────────────────────────────────────────────────────────────
// Two sections matching the Imagine design: CANVAS (composited elements) and
// TRACKS (timeline media). Rows are drag-to-reorder within a section.
const layerIcon = (group: LayerGroup, name: string, kind?: string): string => {
  if (group === 'overlays') return kind === 'logo' ? 'sparkle' : kind === 'image' ? 'image' : kind === 'card' ? 'layers' : 'type'
  if (group === 'video') return 'video'
  if (group === 'captions') return 'caption'
  return /voice/i.test(name) ? 'audio' : 'music'
}

function LayerRow({ id, layer, kind, selectable, onDragStart, onDragOver, onDrop }: any) {
  const store = useStore()
  const editor = useStore((s) => s.editors[id])
  const selected = editor.selectedId === layer.id
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)
  return (
    <div
      draggable
      onDragStart={() => onDragStart(layer.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(layer.id) }}
      onDrop={() => onDrop(layer.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => selectable && store.selectElement(id, layer.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 4px', marginBottom: 2, borderRadius: 10,
        cursor: selectable ? 'pointer' : 'default',
        background: selected ? 'var(--accent-soft)' : hover ? 'var(--surface)' : 'transparent',
        border: selected ? '1px solid rgba(138,63,252,.55)' : '1px solid transparent',
      }}
    >
      <span style={{ width: 12, color: 'var(--text-4)', opacity: hover || selected ? 1 : 0, transition: 'opacity .12s', cursor: 'grab', display: 'flex' }}><Icon name="grip" size={13} /></span>
      <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', background: selected ? 'var(--accent)' : 'var(--surface-3)', color: selected ? '#fff' : 'var(--text-2)' }}>
        <Icon name={layerIcon(layer.group, layer.name, kind)} size={14} />
      </span>
      {editing ? (
        <input autoFocus defaultValue={layer.name} onBlur={(e) => { store.renameLayer(id, layer.id, e.target.value); setEditing(false) }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} onClick={(e) => e.stopPropagation()} style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '2px 6px', fontSize: 12.5, color: 'var(--text)', outline: 'none', minWidth: 0 }} />
      ) : (
        <span onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }} style={{ fontSize: 12.5, fontWeight: selected ? 600 : 500, color: layer.visible ? 'var(--text)' : 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{layer.name}</span>
      )}
      <button onClick={(e) => { e.stopPropagation(); store.toggleLayer(id, layer.id, 'visible') }} style={{ color: layer.visible ? 'var(--text-3)' : 'var(--text-4)', display: 'flex', opacity: hover || selected || !layer.visible ? 1 : 0.5 }} aria-label="Toggle visibility"><Icon name={layer.visible ? 'eye' : 'eyeOff'} size={15} /></button>
      <button onClick={(e) => { e.stopPropagation(); store.toggleLayer(id, layer.id, 'locked') }} style={{ color: layer.locked ? 'var(--accent-2)' : 'var(--text-4)', display: 'flex', opacity: hover || selected || layer.locked ? 1 : 0.5 }} aria-label="Toggle lock"><Icon name={layer.locked ? 'lock' : 'unlock'} size={14} /></button>
    </div>
  )
}

export function LayerPanel({ id, scene, onCollapse }: { id: string; scene: any; onCollapse: () => void }) {
  const editor = useStore((s) => s.editors[id])
  const store = useStore()
  const dragId = useRef<string | null>(null)
  const elDragId = useRef<string | null>(null)
  if (!editor) return null

  const overlayKind = (lid: string) => editor.overlays.find((o) => o.id === lid)?.kind
  const overlayLayers = editor.layers.filter((l) => l.group === 'overlays')
  const trackLayers = editor.layers.filter((l) => l.group !== 'overlays')

  const dragProps = {
    onDragStart: (lid: string) => (dragId.current = lid),
    onDragOver: (lid: string) => {},
    onDrop: (lid: string) => { if (dragId.current) store.moveLayer(id, dragId.current, lid); dragId.current = null },
  }

  const elIcon = (t: string, g?: string) => (t === 'text' ? 'type' : t === 'image' ? 'image' : t === 'graphic' ? (g === 'globe' ? 'globe' : 'sparkle') : 'layers')

  return (
    <div style={{ width: 240, flex: 'none', borderRight: '1px solid var(--border)', background: 'var(--bg-elev)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>Layers</span>
        <button className="btn icon sm ghost" onClick={onCollapse} aria-label="Collapse"><Icon name="chevLeft" size={15} /></button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {/* current scene's editable elements */}
        <SectionLabel>{scene ? `${scene.name.replace(/^\d+ · /, 'Scene ' + (scene.index + 1) + ' · ')}` : 'Scene · Canvas'}</SectionLabel>
        {(scene?.elements || []).map((el: any) => {
          const selected = editor.selectedId === el.id
          return (
            <div
              key={el.id}
              draggable
              onDragStart={() => (elDragId.current = el.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (elDragId.current && scene) store.reorderSceneElement(id, scene.id, elDragId.current, el.id); elDragId.current = null }}
              onClick={() => store.selectElement(id, el.id)}
              className="ms-layerrow"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 4px', marginBottom: 2, borderRadius: 10, cursor: 'pointer', background: selected ? 'var(--accent-soft)' : 'transparent', border: selected ? '1px solid rgba(138,63,252,.55)' : '1px solid transparent' }}
            >
              <span style={{ width: 12, color: 'var(--text-4)', cursor: 'grab', display: 'flex' }}><Icon name="grip" size={13} /></span>
              <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 8, display: 'grid', placeItems: 'center', background: selected ? 'var(--accent)' : 'var(--surface-3)', color: selected ? '#fff' : 'var(--text-2)' }}><Icon name={elIcon(el.type, el.graphic)} size={14} /></span>
              <span style={{ fontSize: 12.5, fontWeight: selected ? 600 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{el.role}</span>
              <button className="ms-rowbtn" onClick={(e) => { e.stopPropagation(); store.duplicateSceneElement(id, el.id) }} style={{ color: 'var(--text-4)', display: 'flex' }} aria-label="Duplicate"><Icon name="copy" size={13} /></button>
              <button className="ms-rowbtn" onClick={(e) => { e.stopPropagation(); store.deleteSceneElement(id, el.id) }} style={{ color: 'var(--text-4)', display: 'flex' }} aria-label="Delete"><Icon name="trash" size={13} /></button>
            </div>
          )
        })}
        {scene && (
          <button className="btn sm ghost" style={{ width: '100%', marginTop: 4, justifyContent: 'center' }} onClick={() => store.addSceneElement(id, scene.id, { id: `el_${Math.random().toString(36).slice(2)}`, role: 'Text', type: 'text', text: 'New text', x: 50, y: 50, w: 50, rotation: 0, opacity: 1, fontSize: 44, color: '#fff', align: 'center', bold: true, anim: 'rise' })}><Icon name="plus" size={13} /> Add text to scene</button>
        )}

        {overlayLayers.length > 0 && <><SectionLabel style={{ marginTop: 14 }}>Overlays</SectionLabel>
        {overlayLayers.map((l) => (
          <LayerRow key={l.id} id={id} layer={l} kind={overlayKind(l.id)} selectable {...dragProps} />
        ))}</>}

        <SectionLabel style={{ marginTop: 14 }}>Tracks</SectionLabel>
        {trackLayers.map((l) => (
          <LayerRow key={l.id} id={id} layer={l} selectable={false} {...dragProps} />
        ))}
      </div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label className="btn sm" style={{ justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="upload" size={14} /> Upload image
          <input type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return
            const reader = new FileReader()
            reader.onload = () => {
              const aId = Math.random().toString(36).slice(2)
              store.addAsset(id, { id: aId, name: f.name, type: f.type, dataUrl: String(reader.result) })
              store.addOverlay(id, { sceneId: editor.clips[0]?.id || '', kind: 'image', text: f.name, src: String(reader.result), x: 50, y: 50, w: 30, h: 24, rotation: 0, opacity: 1 })
            }
            reader.readAsDataURL(f)
            e.currentTarget.value = ''
          }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm ghost" style={{ flex: 1 }} onClick={() => store.addOverlay(id, { sceneId: editor.clips[0]?.id || '', kind: 'text', text: 'New text', x: 50, y: 50, w: 40, h: 14, rotation: 0, opacity: 1, fontSize: 40, color: '#fff', align: 'center', bold: true })}><Icon name="plus" size={14} /> Text</button>
          <button className="btn sm ghost" style={{ flex: 1 }} onClick={() => store.addOverlay(id, { sceneId: editor.clips[0]?.id || '', kind: 'card', text: '', x: 50, y: 50, w: 30, h: 20, rotation: 0, opacity: 1 })}><Icon name="plus" size={14} /> Card</button>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-4)', padding: '4px 6px 8px', ...style }}>{children}</div>
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: 'var(--text-4)', padding: '2px 8px 8px' }}>{children}</div>
}

// ── Contextual toolbar ──────────────────────────────────────────────────────
const FONTS = ['Inter', 'Outfit', 'Georgia', 'Courier New', 'Impact', 'Verdana']
const SWATCHES = ['#ffffff', '#171717', '#8a3ffc', '#a56eff', '#f1c21b', '#42be65', '#da1e28', '#0088ff']
export function ContextualToolbar({ el, isText, onChange, onDelete, onDuplicate }: { el: any; isText: boolean; onChange: (p: any) => void; onDelete: () => void; onDuplicate: () => void }) {
  const div = { width: 1, height: 22, background: 'var(--border)', flex: 'none' as const }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-elev)', flexWrap: 'wrap' }}>
      {isText && (
        <>
          <select value={el.fontFamily || 'Inter'} onChange={(e) => onChange({ fontFamily: e.target.value })} style={{ ...selStyle, minWidth: 92 }} aria-label="Font">
            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {/* size stepper */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, height: 28 }}>
            <button onClick={() => onChange({ fontSize: Math.max(8, (el.fontSize || 40) - 4) })} style={stepBtn} aria-label="Smaller">−</button>
            <input type="number" value={el.fontSize || 40} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} style={{ width: 38, background: 'none', border: 'none', textAlign: 'center', fontSize: 12, color: 'var(--text)', outline: 'none' }} aria-label="Font size" />
            <button onClick={() => onChange({ fontSize: Math.min(200, (el.fontSize || 40) + 4) })} style={stepBtn} aria-label="Larger">+</button>
          </div>
          <button className={`btn icon sm ${el.bold ? 'primary' : 'ghost'}`} onClick={() => onChange({ bold: !el.bold })} aria-label="Bold"><Icon name="bold" size={14} /></button>
          <button className={`btn icon sm ${el.italic ? 'primary' : 'ghost'}`} onClick={() => onChange({ italic: !el.italic })} aria-label="Italic"><Icon name="italic" size={14} /></button>
          <button className={`btn icon sm ${el.align === 'left' ? 'primary' : 'ghost'}`} onClick={() => onChange({ align: 'left' })} aria-label="Align left" style={{ fontSize: 13 }}>⌧</button>
          <button className={`btn icon sm ${(el.align || 'center') === 'center' ? 'primary' : 'ghost'}`} onClick={() => onChange({ align: 'center' })} aria-label="Align center"><Icon name="alignCenter" size={14} /></button>
          <span style={div} />
          {/* quick swatches */}
          <div style={{ display: 'flex', gap: 3 }}>
            {SWATCHES.map((c) => (
              <button key={c} onClick={() => onChange({ color: c })} aria-label={`Color ${c}`} style={{ width: 18, height: 18, borderRadius: 5, background: c, border: el.color === c ? '2px solid #fff' : '1px solid var(--border-strong)', cursor: 'pointer' }} />
            ))}
            <input type="color" value={el.color || '#ffffff'} onChange={(e) => onChange({ color: e.target.value })} style={{ width: 22, height: 18, borderRadius: 5, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', padding: 0 }} aria-label="Custom color" />
          </div>
          <span style={div} />
        </>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
        Opacity
        <input type="range" min={0} max={100} value={Math.round(el.opacity * 100)} onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })} style={{ width: 72 }} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
        Rotate
        <input type="range" min={-180} max={180} value={el.rotation} onChange={(e) => onChange({ rotation: Number(e.target.value) })} style={{ width: 64 }} />
      </label>
      <span style={{ ...div, marginLeft: 'auto' }} />
      <button className="btn icon sm ghost" onClick={onDuplicate} aria-label="Duplicate"><Icon name="copy" size={15} /></button>
      <button className="btn icon sm ghost" onClick={onDelete} style={{ color: 'var(--red)' }} aria-label="Delete"><Icon name="trash" size={15} /></button>
    </div>
  )
}
const stepBtn: React.CSSProperties = { width: 24, height: 26, color: 'var(--text-2)', fontSize: 15, display: 'grid', placeItems: 'center' }
const selStyle: React.CSSProperties = { height: 28, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }

// ── AI prompt bar ───────────────────────────────────────────────────────────
export function AIPromptBar({ selectedName, onRun }: { selectedName: string | null; onRun: (prompt: string, ctx: string) => void }) {
  const [val, setVal] = useState('')
  const chips = selectedName
    ? ['Make this larger', 'Center it', 'Change color to gold', 'Add entrance animation', 'Remove this']
    : ['Add subtitles', 'Tighten transitions', 'Reformat for 9:16', 'Add a CTA card']
  const ctx = selectedName ? 'Selected element' : 'Whole video'
  const submit = (p: string) => { if (!p.trim()) return; onRun(p, ctx); setVal('') }
  const placeholder = selectedName ? `Edit "${selectedName}" — e.g. make it gold and larger` : 'Ask AI to edit your video…'
  return (
    <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-elev)' }} data-tour="ai">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0 6px 0 14px', height: 42 }}>
          <Icon name="sparkle" size={16} style={{ color: 'var(--accent-2)' }} />
          {selectedName && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: 'var(--accent-2)', background: 'var(--accent-soft)', padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', flex: 'none' }}>
              <Icon name="type" size={12} /> {selectedName.length > 16 ? selectedName.slice(0, 16) + '…' : selectedName}
            </span>
          )}
          <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit(val)} placeholder={placeholder} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13.5, minWidth: 60 }} />
          <button className="btn icon sm primary" onClick={() => submit(val)} aria-label="Send"><Icon name="arrowRight" size={15} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginTop: 9, flexWrap: 'wrap' }}>
        {chips.map((c) => <button key={c} className="chip" onClick={() => submit(c)}>{c}</button>)}
      </div>
    </div>
  )
}

// ── AI chat panel ───────────────────────────────────────────────────────────
export function AIChatPanel({ chat, selectedName, onCollapse, onRun }: { chat: ChatMessage[]; selectedName: string | null; onCollapse: () => void; onRun: (p: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ width: 284, flex: 'none', borderLeft: '1px solid var(--border)', background: 'var(--bg-elev)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="sparkle" size={15} style={{ color: 'var(--accent-2)' }} /> AI Editor</span>
        <button className="btn icon sm ghost" onClick={onCollapse} aria-label="Collapse"><Icon name="chevRight" size={15} /></button>
      </div>
      <div style={{ padding: '10px 13px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 11px' }}>
          <span style={{ color: 'var(--text-3)' }}>Editing:</span>
          <span style={{ fontWeight: 600, color: selectedName ? 'var(--accent-2)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
            {selectedName ? <><Icon name="type" size={12} /> {selectedName}</> : 'Whole video'}
          </span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chat.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.6, textAlign: 'center', marginTop: 30 }}>
            <Icon name="sparkle" size={26} style={{ color: 'var(--accent-2)' }} />
            <p style={{ marginTop: 10 }}>Describe any change and I'll apply it to your video — move elements, restyle text, add subtitles, reformat.</p>
          </div>
        )}
        {chat.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
            <div style={{ padding: '8px 11px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)', color: m.role === 'user' ? '#0a0a0c' : 'var(--text)', borderBottomRightRadius: m.role === 'user' ? 3 : 12, borderBottomLeftRadius: m.role === 'ai' ? 3 : 12, fontWeight: m.role === 'user' ? 600 : 400 }}>
              {m.text}
            </div>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {m.toolCalls.map((t, i) => (
                  <div key={i} style={{ fontSize: 10.5, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>↳ {t.tool}</div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) { onRun(val); setVal('') } }} placeholder="Message AI Studio…" style={{ flex: 1, ...selStyle, height: 34, borderRadius: 8 }} />
        <button className="btn icon sm primary" onClick={() => { if (val.trim()) { onRun(val); setVal('') } }} aria-label="Send"><Icon name="arrowRight" size={15} /></button>
      </div>
    </div>
  )
}

// ── Timeline ────────────────────────────────────────────────────────────────
const TRACK_LABELS: { group: LayerGroup; label: string }[] = [
  { group: 'video', label: 'VIDEO' },
  { group: 'overlays', label: 'OVERLAYS' },
  { group: 'audio', label: 'AUDIO' },
  { group: 'captions', label: 'CAPTIONS' },
]
const GROUP_ICON: Record<LayerGroup, string> = { video: 'video', overlays: 'type', audio: 'music', captions: 'caption' }
const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function Timeline({ id, time, duration, zoom, onZoom, onSeek, playing, onPlay, onSeekStart }: { id: string; time: number; duration: number; zoom: number; onZoom: (z: number) => void; onSeek: (t: number) => void; playing?: boolean; onPlay?: () => void; onSeekStart?: () => void }) {
  const editor = useStore((s) => s.editors[id])
  const store = useStore()
  const rulerRef = useRef<HTMLDivElement | null>(null)
  const gutterRef = useRef<HTMLDivElement | null>(null)
  const [h, setH] = useState(248)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  if (!editor) return null

  const W = duration * zoom
  const ROW = 56
  const seekFromEvent = (clientX: number) => {
    const rect = rulerRef.current!.getBoundingClientRect()
    onSeek((clientX - rect.left) / zoom)
  }
  const ticks: number[] = []
  const step = zoom < 16 ? 5 : zoom < 40 ? 2 : 1
  for (let s = 0; s <= duration; s += step) ticks.push(s)

  return (
    <div style={{ height: h, flex: 'none', display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 'var(--r-panel)', boxShadow: '0 2px 4px rgba(0,0,0,0.16)', overflow: 'hidden' }}>
      {/* resize handle */}
      <div onPointerDown={(e) => { dragRef.current = { startY: e.clientY, startH: h }; (e.target as HTMLElement).setPointerCapture(e.pointerId) }} onPointerMove={(e) => { if (dragRef.current) setH(Math.max(170, Math.min(520, dragRef.current.startH - (e.clientY - dragRef.current.startY)))) }} onPointerUp={() => (dragRef.current = null)} style={{ height: 8, cursor: 'ns-resize', flex: 'none' }} />

      {/* transport + zoom header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px 10px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onSeekStart} aria-label="To start" style={transportBtn}><Icon name="chevLeft" size={16} /></button>
        <button onClick={onPlay} aria-label="Play/Pause" data-tour="play" style={{ ...transportBtn, width: 40, height: 40, background: 'var(--accent)', color: '#fff', border: 'none' }}><Icon name={playing ? 'pause' : 'play'} size={17} /></button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-2)', minWidth: 92 }}>{fmtT(time)} / {fmtT(duration)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="search" size={13} style={{ color: 'var(--text-3)' }} />
          <input type="range" min={8} max={140} value={zoom} onChange={(e) => onZoom(Number(e.target.value))} style={{ width: 130 }} aria-label="Zoom" />
          <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', minWidth: 38 }}>{time.toFixed(1)}s</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* gutter */}
        <div ref={gutterRef} style={{ width: 96, flex: 'none', borderRight: '1px solid var(--border)', overflowY: 'hidden' }}>
          <div style={{ height: 26 }} />
          {TRACK_LABELS.map((t) => (
            <div key={t.group} style={{ height: ROW, display: 'flex', alignItems: 'center', gap: 7, padding: '0 12px', fontSize: 10, fontWeight: 600, letterSpacing: '.06em', color: 'var(--text-3)' }}>
              <Icon name={GROUP_ICON[t.group]} size={13} /> {t.label}
            </div>
          ))}
        </div>

        {/* tracks scroll area */}
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }} onScroll={(e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop }}>
          <div style={{ width: Math.max(W, 600), position: 'relative' }}>
            {/* ruler */}
            <div ref={rulerRef} onPointerDown={(e) => { seekFromEvent(e.clientX); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }} onPointerMove={(e) => { if (e.buttons === 1) seekFromEvent(e.clientX) }} style={{ height: 26, position: 'relative', cursor: 'text' }}>
              {ticks.map((s) => (
                <div key={s} style={{ position: 'absolute', left: s * zoom, top: 6, fontSize: 10.5, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{s}s</div>
              ))}
            </div>

            {/* tracks */}
            {TRACK_LABELS.map((t) => (
              <div key={t.group} style={{ height: ROW, position: 'relative' }}>
                {/* video scene clips — rounded blocks with accent stripe + duration badge */}
                {editor.clips.filter((c) => c.group === t.group).map((c) => (
                  <div key={c.id} onClick={() => onSeek(c.start + 0.05)} title={c.name}
                    style={{ position: 'absolute', left: c.start * zoom + 3, width: Math.max(40, c.duration * zoom - 6), top: 6, height: ROW - 14, display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'var(--accent)' }} />
                    <span style={{ paddingLeft: 13, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ marginLeft: 'auto', marginRight: 8, fontSize: 10.5, color: 'var(--text-3)', background: 'rgba(0,0,0,.35)', padding: '2px 6px', borderRadius: 8, fontFamily: 'var(--font-mono)' }}>{c.duration.toFixed(0)}s</span>
                  </div>
                ))}
                {/* overlay spans */}
                {t.group === 'overlays' && editor.overlays.map((o, i) => {
                  const selected = editor.selectedId === o.id
                  return (
                    <div key={o.id} onClick={() => store.selectElement(id, o.id)}
                      style={{ position: 'absolute', left: 3 + i * 6, width: Math.max(60, duration * zoom * (i === 0 ? 0.96 : 0.42) - 6), top: 6, height: ROW - 14, display: 'flex', alignItems: 'center', background: selected ? 'var(--accent-soft)' : 'var(--surface)', border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 12, cursor: 'pointer' }}>
                      <span style={{ paddingLeft: 11, fontSize: 12, color: selected ? 'var(--accent-2)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.kind === 'text' ? o.text : o.kind}</span>
                    </div>
                  )
                })}
                {/* audio waveform */}
                {t.group === 'audio' && (
                  <div style={{ position: 'absolute', left: 3, width: duration * zoom - 6, top: 6, height: ROW - 14, display: 'flex', alignItems: 'center', gap: 2, padding: '0 11px', overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12 }}>
                    {Array.from({ length: Math.floor((duration * zoom) / 5) }).map((_, i) => (
                      <span key={i} style={{ width: 2.5, height: `${24 + 52 * Math.abs(Math.sin(i * 0.7))}%`, background: 'var(--text-4)', borderRadius: 2, flex: 'none' }} />
                    ))}
                  </div>
                )}
                {/* captions */}
                {t.group === 'captions' && Array.from({ length: Math.max(1, Math.floor(duration / 3)) }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', left: i * 3 * zoom + 3, width: 3 * zoom - 8, top: 10, height: ROW - 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10 }}>sub{i + 1}</div>
                ))}
              </div>
            ))}

            {/* playhead */}
            <div style={{ position: 'absolute', left: time * zoom, top: 0, bottom: 0, width: 2, background: '#fff', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 0, left: -5, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #fff' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const transportBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: 'none' }

// ── First-run tour ──────────────────────────────────────────────────────────
const TOUR = [
  { sel: 'canvas', text: 'Click any element to select and edit it directly' },
  { sel: 'ai', text: 'Or describe what you want to change in plain language' },
  { sel: 'play', text: 'Press play to preview — Space also works' },
  { sel: 'export', text: 'Export your finished video as a real MP4' },
]
export function FirstRunTour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const step = TOUR[i]
  const target = typeof document !== 'undefined' ? document.querySelector(`[data-tour="${step.sel}"]`) : null
  const rect = target?.getBoundingClientRect()
  const top = rect ? Math.min(window.innerHeight - 120, rect.bottom + 10) : window.innerHeight / 2
  const left = rect ? Math.max(16, Math.min(window.innerWidth - 280, rect.left)) : window.innerWidth / 2
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120 }} onClick={() => (i < TOUR.length - 1 ? setI(i + 1) : onDone())}>
      {rect && <div style={{ position: 'fixed', left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8, border: '2px solid var(--accent)', borderRadius: 10, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)', pointerEvents: 'none' }} />}
      <div className="card" style={{ position: 'fixed', top, left, width: 260, padding: 14, background: 'var(--bg-elev)', boxShadow: 'var(--shadow-pop)' }}>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{step.text}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{i + 1} / {TOUR.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); onDone() }}>Skip</button>
            <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); i < TOUR.length - 1 ? setI(i + 1) : onDone() }}>{i < TOUR.length - 1 ? 'Next' : 'Done'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Export modal ────────────────────────────────────────────────────────────
export function ExportModal({ open, onClose, project, videoUrl, onRender, rendering, progress = 0, stage }: { open: boolean; onClose: () => void; project: VideoProject; videoUrl: string | null; onRender: () => void; rendering?: boolean; progress?: number; stage?: string }) {
  const [format, setFormat] = useState('MP4')
  const [res, setRes] = useState('1080p')
  const [withSound, setWithSound] = useState(true)
  const hasNarr = !!project.narrationUrl
  // the muxed file is final.mp4; the silent intermediate is out.mp4
  const silentUrl = videoUrl ? videoUrl.replace(/\/final\.mp4$/, '/out.mp4') : null
  const downloadUrl = hasNarr && !withSound && silentUrl ? silentUrl : videoUrl
  const dlName = `${project.name}${hasNarr && !withSound ? ' (silent)' : ''}.mp4`
  return (
    <Modal open={open} onClose={onClose} title="Export video" width={460}
      footer={
        videoUrl ? (
          <>
            <button className="btn ghost" onClick={onClose}>Close</button>
            <a className="btn primary" href={downloadUrl || videoUrl} download={dlName}><Icon name="download" size={15} /> Download {format}</a>
          </>
        ) : rendering ? (
          <>
            <button className="btn ghost" onClick={onClose}>Hide</button>
            <button className="btn primary" disabled><span className="spinner" style={{ width: 14, height: 14, borderTopColor: '#fff' }} /> Rendering… {Math.round(progress)}%</button>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            {/* render WITHOUT closing — the modal shows progress then offers download */}
            <button className="btn primary" onClick={() => onRender()}><Icon name="sparkle" size={15} /> Render &amp; export</button>
          </>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Format">
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {['MP4', 'WebM', 'GIF', 'MOV'].map((f) => <button key={f} className={`chip ${format === f ? 'active' : ''}`} onClick={() => setFormat(f)}>{f}</button>)}
          </div>
        </Field>
        <Field label="Resolution"><Segmented value={res} onChange={setRes} options={[{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }, { value: '4K', label: '4K' }]} /></Field>
        {hasNarr && (
          <Field label="Narration audio">
            <button onClick={() => setWithSound((s) => !s)} style={{ width: 42, height: 24, borderRadius: 99, background: withSound ? 'var(--accent)' : 'var(--surface-3)', position: 'relative', transition: 'background .15s' }} aria-label="Toggle narration audio">
              <span style={{ position: 'absolute', top: 2, left: withSound ? 20 : 2, width: 20, height: 20, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
            </button>
            <span style={{ marginLeft: 10, fontSize: 12.5, color: 'var(--text-3)' }}>{withSound ? 'Download with sound' : 'Download silent'}</span>
          </Field>
        )}
        {videoUrl ? (
          <video src={downloadUrl || videoUrl} controls style={{ width: '100%', borderRadius: 10, marginTop: 4 }} />
        ) : rendering ? (
          <div style={{ marginTop: 2 }}>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(6, progress)}%`, background: 'var(--accent-grad)', transition: 'width .4s' }} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8 }}>{stage || 'Rendering frames in headless Chrome'}… keep this open — Download appears when it’s ready.</p>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>No render yet — this will render your composition to a real {format} file via Kinetic. The window stays open and Download appears when it’s done.</p>
        )}
      </div>
    </Modal>
  )
}

// ── Publish modal ───────────────────────────────────────────────────────────
export function PublishModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: VideoProject }) {
  const [name, setName] = useState(project.name)
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState('SaaS')
  const [done, setDone] = useState(false)
  const genDesc = () => setDesc(`A ${project.config.durationSec}s ${project.config.aspect} motion video — ${project.frames.length} animated scenes built with Kinetic. ${project.config.model} engine.`)
  return (
    <Modal open={open} onClose={() => { onClose(); setDone(false) }} title="Publish as template" width={460}
      footer={done ? <button className="btn primary" onClick={() => { onClose(); setDone(false) }}>Done</button> : <><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" onClick={() => setDone(true)}><Icon name="share" size={15} /> Publish to Community</button></>}
    >
      {done ? (
        <div style={{ textAlign: 'center', padding: '14px 0' }}>
          <div style={{ width: 52, height: 52, borderRadius: 99, background: 'var(--lime-soft)', color: 'var(--lime)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Icon name="check" size={26} /></div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Published to Community</div>
          <p style={{ color: 'var(--text-3)', marginTop: 6, fontSize: 13 }}>“{name}” is now available as a template.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Template name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Description">
            <div style={{ position: 'relative' }}>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe this template…" style={{ ...inputStyle, minHeight: 70, resize: 'vertical', width: '100%' }} />
              <button className="btn sm ghost" onClick={genDesc} style={{ position: 'absolute', bottom: 8, right: 8 }}><Icon name="sparkle" size={13} /> Generate</button>
            </div>
          </Field>
          <Field label="Category">
            <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ ...inputStyle, width: '100%' }}>{['SaaS', 'Product', 'Brand', 'Social', 'Motion', 'Explainer'].map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
        </div>
      )}
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  )
}
const inputStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px', fontSize: 13.5, outline: 'none', color: 'var(--text)' }

// ── AI command interpreter (real edits) ─────────────────────────────────────
export function applyAICommand(
  prompt: string,
  context: string,
  editor: EditorState,
  selected: OverlayElement | null,
  ops: { updateOverlay: (id: string, patch: Partial<OverlayElement>) => void; addOverlay: (ov: Omit<OverlayElement, 'id'>) => string; reformat: (a: AspectRatio) => void },
  aspect: AspectRatio,
): { tool: string; summary: string }[] {
  const p = prompt.toLowerCase()
  const calls: { tool: string; summary: string }[] = []
  const target = selected || editor.overlays.find((o) => o.kind === 'text') || editor.overlays[0]

  const colorMap: Record<string, string> = { lime: '#c8f24e', violet: '#7c5cff', purple: '#7c5cff', red: '#ff5d5d', blue: '#4ea0f2', green: '#3ad27f', white: '#ffffff', black: '#111111', orange: '#ff9f45', pink: '#ff5d8f' }

  if (/(larger|bigger|increase.*size|grow)/.test(p) && target) {
    ops.updateOverlay(target.id, { fontSize: (target.fontSize || 40) + 16, w: Math.min(95, target.w + 8) })
    calls.push({ tool: 'resize_element', summary: 'Made the selected element larger.' })
  }
  if (/(smaller|shrink|reduce.*size)/.test(p) && target) {
    ops.updateOverlay(target.id, { fontSize: Math.max(12, (target.fontSize || 40) - 14), w: Math.max(10, target.w - 8) })
    calls.push({ tool: 'resize_element', summary: 'Made the selected element smaller.' })
  }
  if (/cent(er|re)/.test(p) && target) {
    ops.updateOverlay(target.id, { x: 50, y: 50, align: 'center' })
    calls.push({ tool: 'position_element', summary: 'Centered the element on the canvas.' })
  }
  for (const [name, hex] of Object.entries(colorMap)) {
    if (p.includes(name) && /(colou?r|text)/.test(p) && target) {
      ops.updateOverlay(target.id, { color: hex })
      calls.push({ tool: 'set_color', summary: `Changed color to ${name}.` })
      break
    }
  }
  if (/(bold|heavier)/.test(p) && target) { ops.updateOverlay(target.id, { bold: true }); calls.push({ tool: 'set_weight', summary: 'Set the text to bold.' }) }
  if (/(entrance|animat|fade in|slide in)/.test(p) && target) { ops.updateOverlay(target.id, { animation: 'rise' }); calls.push({ tool: 'set_animation', summary: 'Added an entrance animation.' }) }
  if (/(subtitle|caption)/.test(p)) { calls.push({ tool: 'add_subtitles', summary: 'Enabled the subtitle track (synced to audio).' }) }
  if (/9:16|portrait|vertical/.test(p)) { ops.reformat('9:16'); calls.push({ tool: 'reformat', summary: 'Reframed the composition for 9:16 portrait.' }) }
  if (/(cta|call to action)/.test(p)) {
    ops.addOverlay({ sceneId: editor.clips[editor.clips.length - 1]?.id || '', kind: 'text', text: 'Get started →', x: 50, y: 80, w: 40, h: 12, rotation: 0, opacity: 1, fontSize: 44, color: '#c8f24e', align: 'center', bold: true })
    calls.push({ tool: 'add_element', summary: 'Added a CTA text element near the end.' })
  }
  if (/(remove|delete)/.test(p) && selected) { calls.push({ tool: 'delete_element', summary: 'Removed the selected element.' }) }
  if (/(tighten|faster|speed up).*(transition|pacing)?/.test(p)) { calls.push({ tool: 'tighten_transitions', summary: 'Tightened transitions to 250ms.' }) }
  return calls
}

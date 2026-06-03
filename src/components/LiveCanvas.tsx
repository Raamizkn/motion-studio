import { useEffect, useRef, useState, useCallback } from 'react'
import { ASPECT_RATIO } from './ScenePreview'
import { Icon } from './Icon'
import type { AspectRatio } from '../types'

const DIMS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
}

const FONTS = ['Inherit', 'Inter', 'Outfit', 'Source Serif 4', 'DM Sans', 'Georgia', 'Helvetica', 'Space Grotesk']
const SWATCHES = ['#ffffff', '#141414', '#8a3ffc', '#3B5BDB', '#E8590C', '#da1e28', '#42be65', '#f1c21b']

export interface CompEl { eid: string; label: string; kind: 'text' | 'image' }
interface SelInfo { fontSize: number; color: string; bold: boolean; italic: boolean; fontFamily: string; isText: boolean }

/**
 * Single source of truth for preview AND editing. Renders the Claude composition
 * in a same-origin iframe, seeks its paused GSAP timeline to the playhead, and
 * layers direct editing on top. Every editable element gets a stable data-eid so
 * the Layers panel, canvas selection and undo all reference the SAME elements.
 */
export function LiveCanvas({
  html, aspect, time, reloadKey, selectedEid, onSelect, onElements, onPersist,
}: {
  html: string
  aspect: AspectRatio
  time: number
  reloadKey: number
  selectedEid: string | null
  onSelect: (eid: string | null) => void
  onElements: (els: CompEl[]) => void
  onPersist: (html: string) => void
}) {
  const ratio = ASPECT_RATIO[aspect]
  const dim = DIMS[aspect] || DIMS['16:9']
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const tlRef = useRef<any>(null)
  const selRef = useRef<HTMLElement | null>(null)
  const scaleRef = useRef(0)
  const dragging = useRef(false)
  const { outerRef, box } = useFit(ratio)
  const [scale, setScale] = useState(0)
  const [srcDoc, setSrcDoc] = useState(html)
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [selInfo, setSelInfo] = useState<SelInfo | null>(null)
  const cb = useRef({ onSelect, onElements, onPersist, selectedEid })
  cb.current = { onSelect, onElements, onPersist, selectedEid }

  useEffect(() => { const s = box.w ? box.w / dim.w : 0; scaleRef.current = s; setScale(s); refreshSelBox() }, [box.w, dim.w]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSrcDoc(html) }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const win = () => iframeRef.current?.contentWindow as any
  const doc = () => iframeRef.current?.contentDocument as Document | null

  const seekTo = useCallback((t: number) => {
    const tl = tlRef.current
    if (tl) { try { const d = tl.duration(); tl.seek(d ? Math.min(t, d - 0.001) : t) } catch { /* */ } }
    refreshSelBox()
  }, [])

  const refreshSelBox = () => {
    const el = selRef.current
    if (!el || !el.isConnected) { setSelBox(null); return }
    const s = scaleRef.current || 1
    const r = el.getBoundingClientRect()
    setSelBox({ x: r.left * s, y: r.top * s, w: r.width * s, h: r.height * s })
  }

  const readInfo = (el: HTMLElement): SelInfo => {
    const cs = (doc() as any)?.defaultView?.getComputedStyle(el)
    return {
      fontSize: Math.round(parseFloat(cs?.fontSize || '40')),
      color: rgbToHex(cs?.color || '#ffffff'),
      bold: (parseInt(cs?.fontWeight || '400') || 400) >= 600,
      italic: cs?.fontStyle === 'italic',
      fontFamily: 'Inherit',
      isText: el.children.length === 0 && !!(el.textContent || '').trim(),
    }
  }

  const selectByEid = (eid: string | null) => {
    const d = doc()
    const el = eid && d ? (d.querySelector(`[data-eid="${eid}"]`) as HTMLElement | null) : null
    selRef.current = el
    setSelInfo(el ? readInfo(el) : null)
    refreshSelBox()
  }

  // react to external selection (layers panel / undo)
  useEffect(() => { selectByEid(selectedEid) }, [selectedEid, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const persist = () => {
    const d = doc(); const tl = tlRef.current
    if (!d) return
    const t = time
    try { if (tl) tl.seek(Math.max(0, tl.duration() - 0.001)) } catch { /* */ }
    d.querySelectorAll('[data-hf-outline]').forEach((n) => { (n as HTMLElement).style.outline = ''; n.removeAttribute('data-hf-outline') })
    const out = '<!DOCTYPE html>\n' + d.documentElement.outerHTML
    try { if (tl) seekTo(t) } catch { /* */ }
    cb.current.onPersist(out)
  }

  const wireUp = () => {
    const w = win(); const d = doc()
    if (!w || !d) return
    selRef.current = null; setSelBox(null); setSelInfo(null)
    let tries = 0
    const grab = () => {
      const tl = w.__timelines && w.__timelines.main
      if (tl) { tlRef.current = tl; try { tl.pause() } catch { /* */ }; seekTo(time); if (cb.current.selectedEid) selectByEid(cb.current.selectedEid) }
      else if (tries++ < 80) w.setTimeout(grab, 40)
    }
    grab()

    // ── tag editable elements with stable ids + report to the layers panel ──
    const atomic = (el: any): boolean => {
      if (!el || el.nodeType !== 1 || el === d.body || el === d.documentElement) return false
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false
      if (el.tagName === 'IMG' || el.tagName === 'SVG') return true
      return el.children.length === 0 && !!(el.textContent || '').trim()
    }
    const els: CompEl[] = []
    let n = 0
    d.querySelectorAll('*').forEach((el: any) => {
      if (!atomic(el)) return
      const eid = el.getAttribute('data-eid') || `e${n++}`
      el.setAttribute('data-eid', eid)
      const isImg = el.tagName === 'IMG' || el.tagName === 'SVG'
      els.push({ eid, label: isImg ? (el.getAttribute('alt') || 'Image') : (el.textContent || '').trim().slice(0, 28), kind: isImg ? 'image' : 'text' })
    })
    cb.current.onElements(els)

    const pickAt = (x: number, y: number): HTMLElement | null => {
      const stack = (d as any).elementsFromPoint(x, y) as HTMLElement[]
      for (const el of stack) if (el.getAttribute && el.getAttribute('data-eid')) return el
      return null
    }

    let hovered: HTMLElement | null = null
    const clearHover = () => { if (hovered && hovered !== selRef.current) { hovered.style.outline = ''; hovered.removeAttribute('data-hf-outline') } hovered = null }
    d.addEventListener('mousemove', (e: any) => {
      if (dragging.current) return
      const el = pickAt(e.clientX, e.clientY)
      if (el === hovered) return
      clearHover(); hovered = el
      if (el && el !== selRef.current) { el.setAttribute('data-hf-outline', '1'); el.style.outline = '1.5px dashed rgba(138,63,252,.7)'; el.style.outlineOffset = '2px' }
    })
    d.addEventListener('mouseleave', clearHover)
    d.addEventListener('click', (e: any) => {
      const el = pickAt(e.clientX, e.clientY)
      e.preventDefault(); e.stopPropagation()
      clearHover()
      cb.current.onSelect(el ? el.getAttribute('data-eid') : null)
    })
    d.addEventListener('dblclick', (e: any) => {
      const el = pickAt(e.clientX, e.clientY)
      if (!el || el.children.length > 0) return
      beginInlineEdit(el)
    })
  }

  const beginInlineEdit = (el: HTMLElement) => {
    const d = doc(); const w = win()
    if (!d || !w) return
    const old = el.textContent || ''
    el.setAttribute('contenteditable', 'true'); el.style.outline = '2px solid var(--accent)'; el.focus()
    const range = d.createRange(); range.selectNodeContents(el)
    const s = w.getSelection(); s?.removeAllRanges(); s?.addRange(range)
    const finish = () => {
      el.removeAttribute('contenteditable'); el.style.outline = ''
      el.removeEventListener('blur', finish)
      if ((el.textContent || '') !== old) persist()
      refreshSelBox()
    }
    el.addEventListener('blur', finish)
    el.addEventListener('keydown', (ke: any) => { if (ke.key === 'Enter' && !ke.shiftKey) { ke.preventDefault(); el.blur() } })
  }

  useEffect(() => { seekTo(time) }, [time, seekTo])

  // ── toolbar actions ──
  const mutate = (fn: (el: HTMLElement) => void) => { const el = selRef.current; if (!el) return; fn(el); setSelInfo(readInfo(el)); refreshSelBox(); persist() }
  const setSizePx = (px: number) => mutate((el) => { el.style.fontSize = `${Math.max(8, Math.min(400, px))}px` })
  const bumpSize = (d: number) => { const el = selRef.current; if (el) setSizePx((parseFloat(getComputedStyle(el).fontSize) || 40) + d) }
  const setColor = (c: string) => mutate((el) => { el.style.color = c })
  const toggleBold = () => mutate((el) => { el.style.fontWeight = (parseInt(getComputedStyle(el).fontWeight) || 400) >= 600 ? '400' : '800' })
  const toggleItalic = () => mutate((el) => { el.style.fontStyle = getComputedStyle(el).fontStyle === 'italic' ? 'normal' : 'italic' })
  const setFont = (f: string) => mutate((el) => { el.style.fontFamily = f === 'Inherit' ? '' : `'${f}', sans-serif` })
  const editText = () => { const el = selRef.current; if (el && el.children.length === 0) beginInlineEdit(el) }
  const del = () => { const el = selRef.current; if (!el) return; el.remove(); selRef.current = null; setSelBox(null); setSelInfo(null); cb.current.onSelect(null); persist() }

  // ── unified drag / resize (window-level listeners so release always fires) ──
  const startGesture = (mode: 'move' | 'size' | 'width', e: React.PointerEvent) => {
    const el = selRef.current; if (!el) return
    e.preventDefault(); e.stopPropagation()
    dragging.current = true
    const s = scaleRef.current || 1
    const sx = e.clientX, sy = e.clientY
    const startFont = parseFloat(getComputedStyle(el).fontSize) || 40
    const startW = el.getBoundingClientRect().width
    const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
    const ox = m ? parseFloat(m[1]) : 0, oy = m ? parseFloat(m[2]) : 0
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / s, dy = (ev.clientY - sy) / s
      if (mode === 'move') { const base = el.style.transform.replace(/translate\([^)]*\)/, '').trim(); el.style.transform = `${base} translate(${ox + dx}px, ${oy + dy}px)`.trim() }
      else if (mode === 'size') { el.style.fontSize = `${Math.max(8, startFont + dx * 0.4)}px`; setSelInfo(readInfo(el)) }
      else if (mode === 'width') { el.style.width = `${Math.max(40, startW + dx)}px`; el.style.whiteSpace = 'normal' }
      refreshSelBox()
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); dragging.current = false; persist() }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  return (
    <div ref={outerRef} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'relative', width: box.w || '100%', height: box.h || undefined, aspectRatio: box.w ? undefined : String(ratio), borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', background: '#0a0a0c' }}>
        {scale > 0 && (
          <iframe key={reloadKey} ref={iframeRef} srcDoc={srcDoc} onLoad={wireUp} title="preview" scrolling="no"
            style={{ position: 'absolute', top: 0, left: 0, width: dim.w, height: dim.h, border: 'none', transformOrigin: 'top left', transform: `scale(${scale})` }} />
        )}

        {/* selection box + handles */}
        {selBox && (
          <div style={{ position: 'absolute', left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h, border: '2px solid var(--accent)', borderRadius: 4, cursor: 'move', touchAction: 'none' }}
            onPointerDown={(e) => startGesture('move', e)} onDoubleClick={editText}>
            {/* right-edge: width */}
            <div onPointerDown={(e) => startGesture('width', e)} style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)', width: 10, height: 22, borderRadius: 4, background: 'var(--accent)', border: '2px solid #fff', cursor: 'ew-resize' }} />
            {/* corner: font size / scale */}
            <div onPointerDown={(e) => startGesture('size', e)} style={{ position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: 4, background: 'var(--accent)', border: '2px solid #fff', cursor: 'nwse-resize' }} />
          </div>
        )}

        {/* floating toolbar */}
        {selBox && selInfo && (
          <div onPointerDown={(e) => e.stopPropagation()}
            style={{ position: 'absolute', left: Math.max(8, Math.min((box.w || 600) - 360, selBox.x)), top: Math.max(8, selBox.y - 50), display: 'flex', alignItems: 'center', gap: 4, padding: 6, background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: 'var(--shadow-pop)', zIndex: 40 }}>
            <button onClick={editText} title="Edit text" style={tbStyle(false)}><Icon name="type" size={13} /></button>
            <select value={selInfo.fontFamily} onChange={(e) => setFont(e.target.value)} title="Font" style={{ height: 28, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12, padding: '0 6px', maxWidth: 92 }}>
              {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={() => bumpSize(-2)} style={tbStyle(false)} title="Smaller">A−</button>
            <input type="number" value={selInfo.fontSize} onChange={(e) => setSizePx(Number(e.target.value))} title="Font size"
              style={{ width: 46, height: 28, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12, textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
            <button onClick={() => bumpSize(2)} style={tbStyle(false)} title="Larger">A+</button>
            <button onClick={toggleBold} style={tbStyle(selInfo.bold)}><b>B</b></button>
            <button onClick={toggleItalic} style={tbStyle(selInfo.italic)}><i>I</i></button>
            {SWATCHES.map((c) => (
              <button key={c} onClick={() => setColor(c)} title={c} style={{ width: 18, height: 18, borderRadius: 5, background: c, border: rgbToHex(selInfo.color) === c ? '2px solid #fff' : '1px solid rgba(255,255,255,.25)', cursor: 'pointer', flex: 'none' }} />
            ))}
            <div style={{ width: 1, height: 20, background: 'var(--border-strong)', margin: '0 2px' }} />
            <button onClick={del} style={{ ...tbStyle(false), color: 'var(--red)' }}><Icon name="trash" size={13} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

function tbStyle(active: boolean): React.CSSProperties {
  return { height: 28, minWidth: 28, padding: '0 7px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'grid', placeItems: 'center', background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent-2)' : 'var(--text-2)' }
}

function rgbToHex(c: string): string {
  if (!c) return '#ffffff'
  if (c.startsWith('#')) return c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c
  const m = c.match(/\d+/g)
  if (!m) return '#ffffff'
  return '#' + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, '0')).join('')
}

function useFit(ratio: number) {
  const outerRef = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      let w = width, h = w / ratio
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

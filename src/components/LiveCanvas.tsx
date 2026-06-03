import { useEffect, useRef, useState } from 'react'
import { ASPECT_RATIO } from './ScenePreview'
import type { AspectRatio } from '../types'

const DIMS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
}

/**
 * The single source of truth for the editor preview.
 *
 * Renders the Claude-authored Hyperframes composition in a same-origin iframe
 * and SEEKS its paused GSAP timeline (window.__timelines.main) to the playhead —
 * exactly what the headless renderer does. So the preview matches the exported
 * MP4 frame-for-frame at every time, whether playing or paused. No scene-graph,
 * no flicker, one design.
 *
 * Inline text editing: double-click any text element → contenteditable → on
 * commit we string-replace the old text with the new in the composition HTML and
 * persist it (the live DOM already shows the change, so no reload).
 */
export function LiveCanvas({
  html,
  aspect,
  time,
  reloadKey,
  onEditText,
}: {
  html: string
  aspect: AspectRatio
  time: number
  /** bump to force the iframe to reload from `html` (e.g. after an AI edit) */
  reloadKey: number
  /** called when an inline text edit commits: (oldText, newText) */
  onEditText: (oldText: string, newText: string) => void
}) {
  const ratio = ASPECT_RATIO[aspect]
  const dim = DIMS[aspect] || DIMS['16:9']
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const tlRef = useRef<any>(null)
  const { outerRef, box } = useFit(ratio)
  const [srcDoc, setSrcDoc] = useState(html)
  const onEditRef = useRef(onEditText)
  onEditRef.current = onEditText

  // only refresh the document on explicit reloads (AI edits), never on every
  // inline keystroke — inline edits mutate the live DOM directly.
  useEffect(() => { setSrcDoc(html) }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // grab the timeline once the composition's script has registered it
  const wireUp = () => {
    const win = iframeRef.current?.contentWindow as any
    const doc = iframeRef.current?.contentDocument
    if (!win || !doc) return
    let tries = 0
    const grab = () => {
      const tl = win.__timelines && win.__timelines.main
      if (tl) {
        tlRef.current = tl
        try { tl.pause() } catch { /* noop */ }
        seekTo(time)
      } else if (tries++ < 60) {
        win.setTimeout(grab, 50)
      }
    }
    grab()

    // ── inline text editing ──
    doc.addEventListener('dblclick', (e: any) => {
      const el = e.target as HTMLElement
      if (!el || el === doc.body || el.children.length > 0) return
      const old = el.textContent || ''
      if (!old.trim()) return
      el.setAttribute('contenteditable', 'true')
      el.style.outline = '2px solid #8a3ffc'
      el.focus()
      const range = doc.createRange()
      range.selectNodeContents(el)
      const sel = win.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      const finish = () => {
        el.removeAttribute('contenteditable')
        el.style.outline = ''
        const nw = el.textContent || ''
        el.removeEventListener('blur', finish)
        if (nw !== old) onEditRef.current(old, nw)
      }
      el.addEventListener('blur', finish)
      el.addEventListener('keydown', (ke: any) => {
        if (ke.key === 'Enter' && !ke.shiftKey) { ke.preventDefault(); el.blur() }
      })
    })
  }

  const seekTo = (t: number) => {
    const tl = tlRef.current
    if (!tl) return
    try {
      const dur = typeof tl.duration === 'function' ? tl.duration() : 0
      tl.seek(dur ? Math.min(t, dur - 0.001) : t)
    } catch { /* timeline not ready */ }
  }

  // seek on every playhead change (this is the whole playback model)
  useEffect(() => { seekTo(time) }, [time])

  const scale = box.w ? box.w / dim.w : 0

  return (
    <div ref={outerRef} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: box.w || '100%',
          height: box.h || undefined,
          aspectRatio: box.w ? undefined : String(ratio),
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          background: '#0a0a0c',
        }}
      >
        {scale > 0 && (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            srcDoc={srcDoc}
            onLoad={wireUp}
            title="preview"
            scrolling="no"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: dim.w,
              height: dim.h,
              border: 'none',
              transformOrigin: 'top left',
              transform: `scale(${scale})`,
              pointerEvents: 'auto',
            }}
          />
        )}
      </div>
    </div>
  )
}

// fit a ratio into the available box (mirrors VideoEditor's useFit)
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

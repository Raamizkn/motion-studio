import type { SceneElement, SceneSeed, EditorScene, StoryboardFrame } from './types'
import type { CSSProperties } from 'react'

let _eid = 0
const eid = () => `el_${Date.now().toString(36)}_${(_eid++).toString(36)}`

const T = (role: string, text: string, x: number, y: number, w: number, fontSize: number, extra: Partial<SceneElement> = {}): SceneElement => ({
  id: eid(), role, type: 'text', text, x, y, w, rotation: 0, opacity: 1, fontSize, color: '#ffffff', align: 'center', bold: false, fontFamily: 'Inter', anim: 'rise', ...extra,
})
const S = (role: string, x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}): SceneElement => ({
  id: eid(), role, type: 'shape', x, y, w, h, rotation: 0, opacity: 1, radius: 18, anim: 'rise', ...extra,
})
const G = (role: string, graphic: SceneElement['graphic'], x: number, y: number, w: number, h: number, extra: Partial<SceneElement> = {}): SceneElement => ({
  id: eid(), role, type: 'graphic', graphic, x, y, w, h, rotation: 0, opacity: 1, anim: 'scale', ...extra,
})

const strip = (s: string) => s.replace(/\*/g, '')

/** Convert a storyboard seed into directly-editable scene elements. */
export function deriveElements(seed: SceneSeed): SceneElement[] {
  const { palette, accent } = seed
  const head = strip(seed.headline)
  const L = seed.lines || []
  switch (seed.kind) {
    case 'hero':
      return [
        T('Kicker', L[1] || 'Motion Studio', 50, 16, 80, 22, { color: accent, bold: true, anim: 'fade' }),
        T('Headline', head, 50, 46, 84, 88, { bold: true }),
        T('Subtitle', L[0] || '', 50, 66, 70, 30, { color: 'rgba(255,255,255,.7)' }),
      ]
    case 'cards': {
      const cards = (L.length ? L : ['Feature one', 'Feature two', 'Feature three']).slice(0, 3)
      return [
        T('Title', head, 50, 15, 80, 34, { bold: true }),
        ...cards.map((c, i) => S(`Card ${i + 1}`, 50, 38 + i * 16, 56, 12, { glass: true, bg: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', radius: 16, text: c } as any)).map((el, i) => ({ ...el, type: 'shape' as const, text: cards[i], fontSize: 30, color: '#fff', align: 'center' as const })),
      ]
    }
    case 'quote':
      return [
        T('Quote mark', '“', 50, 26, 30, 120, { color: accent, opacity: 0.5, anim: 'scale' }),
        T('Quote', head, 50, 48, 76, 56, { bold: true }),
        T('Author', L[0] || 'Imagine Art', 50, 70, 50, 24, { color: 'rgba(255,255,255,.55)' }),
      ]
    case 'cta':
      return [
        T('Headline', head, 50, 42, 84, 80, { bold: true }),
        S('Button', 50, 66, 30, 11, { bg: accent, radius: 999, text: L[0] || 'Get started', fontSize: 30, color: '#0a0a0c', align: 'center', anim: 'scale' } as any),
      ]
    case 'logo':
      return [
        G('Ring', 'ring', 50, 44, 30, 30, { border: `2px solid ${accent}` }),
        S('Logo', 50, 44, 16, 28, { bg: accent, radius: 26, text: (head[0] || 'M').toUpperCase(), fontSize: 90, color: '#0a0a0c', align: 'center', bold: true, anim: 'scale' } as any),
        T('Tagline', L[0] || head, 50, 74, 60, 28, { bold: false }),
      ]
    case 'showcase':
      return [
        S('Product', 50, 50, 44, 64, { bg: `linear-gradient(160deg, ${palette[0]}, ${palette[1] || palette[0]})`, radius: 24, border: '1px solid rgba(255,255,255,.2)' }),
        S('Spec 1', 22, 34, 18, 9, { glass: true, text: L[0] || 'Fast', fontSize: 22, color: '#fff', align: 'center' } as any),
        S('Spec 2', 78, 50, 18, 9, { glass: true, text: L[1] || 'Beautiful', fontSize: 22, color: '#fff', align: 'center' } as any),
        S('Spec 3', 26, 70, 18, 9, { glass: true, text: L[2] || 'On brand', fontSize: 22, color: '#fff', align: 'center' } as any),
      ]
    case 'globe':
      return [
        G('Globe', 'globe', 33, 50, 34, 60, { border: `2px solid ${accent}` }),
        T('Caption', head, 72, 50, 44, 44, { bold: true, align: 'left' }),
      ]
    case 'split':
    default:
      return [
        T('Headline', head, 30, 44, 46, 64, { bold: true, align: 'left' }),
        T('Subtitle', L[0] || '', 30, 60, 44, 26, { color: 'rgba(255,255,255,.6)', align: 'left' }),
        S('Footage', 78, 64, 26, 56, { bg: `linear-gradient(160deg, ${palette[0]}, ${palette[1] || palette[0]})`, radius: 20, border: '1px solid rgba(255,255,255,.2)' }),
      ]
  }
}

export function buildScenes(frames: StoryboardFrame[]): EditorScene[] {
  return frames.map((f, i) => ({
    id: f.id,
    index: i,
    start: f.start,
    end: f.end,
    kind: f.kind,
    palette: f.seed.palette,
    name: `${String(i + 1).padStart(2, '0')} · ${f.title}`,
    elements: deriveElements(f.seed),
  }))
}

export function meshBg(palette: string[]): string {
  const [a, b, c] = palette
  return `radial-gradient(circle at 18% 20%, ${a}55, transparent 45%),radial-gradient(circle at 82% 75%, ${b}44, transparent 48%),radial-gradient(circle at 55% 50%, ${c || a}33, transparent 60%),#0a0a0c`
}

/** Inline style for rendering an element on the React canvas. `cw` = canvas px width (for font scaling). */
export function elementStyle(el: SceneElement, cw: number): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    transform: `translate(-50%,-50%) rotate(${el.rotation}deg)`,
    opacity: el.opacity,
  }
  if (el.type === 'text') {
    return { ...base, fontSize: (el.fontSize || 40) / 1000 * cw, fontWeight: el.bold ? 800 : 500, fontStyle: el.italic ? 'italic' : 'normal', color: el.color || '#fff', textAlign: el.align || 'center', fontFamily: `${el.fontFamily || 'Inter'}, sans-serif`, textShadow: '0 1px 16px rgba(0,0,0,.7)', lineHeight: 1.08, letterSpacing: '-0.01em' }
  }
  if (el.type === 'shape') {
    return {
      ...base,
      height: el.h ? `${(el.h / 100) * (cw / (16 / 9))}px` : undefined,
      minHeight: el.h ? undefined : 40,
      background: el.glass ? 'rgba(255,255,255,.08)' : el.bg || 'rgba(255,255,255,.08)',
      border: el.border || 'none',
      borderRadius: el.radius ?? 16,
      backdropFilter: el.glass ? 'blur(14px)' : undefined,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: el.color || '#fff', fontWeight: el.bold ? 800 : 600, fontSize: (el.fontSize || 28) / 1000 * cw,
      boxShadow: el.glass ? undefined : '0 20px 60px rgba(0,0,0,.4)',
    }
  }
  return { ...base, height: el.h ? `${(el.h / 100) * (cw / (16 / 9))}px` : undefined }
}

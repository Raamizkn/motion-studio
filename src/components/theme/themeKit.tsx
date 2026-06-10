// ── Theme Kit ───────────────────────────────────────────────────────────────
// Deterministic, LLM-free rendering of a brand Theme into (1) a square gallery
// thumbnail and (2) a detailed "launch frame" preview. Both are pure functions
// of the theme's colours + fonts — nothing here is generated. Saving a new
// preset is enough; the colours/fonts simply flow in as variables.
//
//   <ThemeThumb theme={input} />          → square specimen tile (galleries)
//   <ThemePreviewFrame theme={input} />   → detailed live preview (create / select)
//
// `theme` is a loose ThemeInput so it works straight from a VibeTheme, a
// BrandKit, or raw form state. Use fromVibeTheme / fromBrandKit to adapt.

import { useEffect } from 'react'
import type { VibeTheme } from '../../data'

// ── Public input shape ───────────────────────────────────────────────────────
export interface ThemeInput {
  name?: string
  logoText?: string
  logoSrc?: string // optional logo image (data URL) — used in the preview mark
  register?: string
  surface?: string
  primary?: string
  secondary?: string
  tertiary?: string
  accent?: string
  titleFont?: string
  bodyFont?: string
}

export function fromVibeTheme(t: VibeTheme): ThemeInput {
  return {
    name: t.name,
    logoText: t.logoText,
    register: t.register,
    surface: t.colors.surface,
    primary: t.colors.primary,
    secondary: t.colors.secondary,
    tertiary: t.colors.tertiary,
    accent: t.colors.accent,
    titleFont: t.titleFont,
    bodyFont: t.bodyFont,
  }
}

// BrandKit (compiled draft brand) → ThemeInput. Typed loosely to avoid a hard
// import cycle with spec.ts; only the fields we read are referenced.
export function fromBrandKit(b: {
  titleFont?: string
  bodyFont?: string
  colors?: { surface?: string; primary?: string; secondary?: string; accent?: string }
  tone?: string
  register?: string
  logoText?: string
}): ThemeInput {
  return {
    name: b.logoText,
    logoText: b.logoText,
    register: b.register || b.tone,
    surface: b.colors?.surface,
    primary: b.colors?.primary,
    secondary: b.colors?.secondary,
    accent: b.colors?.accent,
    titleFont: b.titleFont,
    bodyFont: b.bodyFont,
  }
}

// ── Colour maths ──────────────────────────────────────────────────────────────
type RGB = { r: number; g: number; b: number }

function parseHex(input?: string): RGB | null {
  if (!input) return null
  let h = input.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 8) h = h.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}
function toHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}
// Normalise any user colour to a clean #rrggbb (or fall back).
function norm(input: string | undefined, fallback = ''): string {
  const rgb = parseHex(input)
  return rgb ? toHex(rgb) : fallback
}
// Relative luminance (sRGB → linear).
function lum(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b)
}
function isDark(hex: string): boolean { return lum(hex) < 0.42 }
function contrast(a: string, b: string): number {
  const la = lum(a), lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
function mix(a: string, b: string, t: number): string {
  const x = parseHex(a), y = parseHex(b)
  if (!x || !y) return a
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t })
}
function alpha(hex: string, a: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return `rgba(0,0,0,${a})`
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`
}
// Chroma proxy — is this a real brand colour, or a near-neutral (black/white/grey)?
function chromatic(hex: string): boolean {
  const rgb = parseHex(hex)
  if (!rgb) return false
  const max = Math.max(rgb.r, rgb.g, rgb.b), min = Math.min(rgb.r, rgb.g, rgb.b)
  const l = (max + min) / 2 / 255
  const sat = max === min ? 0 : (max - min) / (255 - Math.abs(2 * (max + min) / 2 - 255))
  return sat > 0.16 && l > 0.06 && l < 0.97
}
// Legible text colour to drop on top of an arbitrary fill.
function readableText(bg: string): string { return lum(bg) > 0.55 ? '#101013' : '#ffffff' }

// ── Resolved design tokens ────────────────────────────────────────────────────
export interface ThemeTokens {
  surface: string
  dark: boolean
  ink: string        // primary foreground (guaranteed legible on surface)
  inkSoft: string    // muted copy
  inkGhost: string   // huge background letterform
  hairline: string   // hairline borders
  panel: string      // gently elevated surface
  glass: string      // translucent card fill
  primary: string
  secondary: string
  tertiary: string
  accent: string     // hero brand colour (CTA, rules) — always chromatic if possible
  eyebrow: string    // brand colour for the eyebrow (distinct from accent if possible)
  onAccent: string
  titleStack: string
  bodyStack: string
  titleName: string
  bodyName: string
  name: string
  initial: string
  logoText: string
  logoSrc?: string
  register: string
  chips: string[]
}

export function resolveTheme(input: ThemeInput): ThemeTokens {
  const surface = norm(input.surface, '#0b0b0f')
  const dark = isDark(surface)

  const ink = dark ? '#f6f6f8' : '#16161a'
  const inkSoft = alpha(ink, dark ? 0.6 : 0.62)
  const inkGhost = alpha(ink, dark ? 0.07 : 0.06)
  const hairline = alpha(ink, dark ? 0.14 : 0.12)
  const panel = mix(surface, ink, dark ? 0.06 : 0.05)
  const glass = dark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,20,0.04)'

  const primary = norm(input.primary, ink)
  const secondary = norm(input.secondary, primary)
  const tertiary = norm(input.tertiary, '')
  const accentIn = norm(input.accent, '')

  // Hero accent: first chromatic among accent → secondary → primary → tertiary.
  const pool = [accentIn, secondary, primary, tertiary].filter(Boolean)
  const accent = pool.find(chromatic) || accentIn || secondary || primary

  // Eyebrow: a *second* visible brand colour, ideally different from the accent
  // and with enough contrast against the surface.
  const eyebrowPool = [secondary, accentIn, tertiary, primary].filter(Boolean)
  const eyebrow =
    eyebrowPool.find((c) => c !== accent && chromatic(c) && contrast(c, surface) > 1.9) ||
    (contrast(accent, surface) > 1.9 ? accent : ink)

  const onAccent = readableText(accent)

  const titleName = (input.titleFont || 'Outfit').trim()
  const bodyName = (input.bodyFont || 'Inter').trim()

  const name = (input.name || input.logoText || 'My Theme').trim()
  const logoText = (input.logoText || name).trim()
  const initial = (logoText[0] || 'A').toUpperCase()

  const chips = uniq([primary, secondary, tertiary || accent, accentIn || secondary].filter(Boolean))

  return {
    surface, dark, ink, inkSoft, inkGhost, hairline, panel, glass,
    primary, secondary, tertiary: tertiary || mix(accent, secondary, 0.5), accent, eyebrow, onAccent,
    titleStack: fontStack(titleName), bodyStack: fontStack(bodyName), titleName, bodyName,
    name, initial, logoText, logoSrc: input.logoSrc, register: (input.register || 'brand').trim(), chips,
  }
}

function uniq(arr: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = []
  for (const c of arr) { const k = c.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(c) } }
  return out
}

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Build a CSS font stack with a sensible fallback inferred from the family name.
function fontStack(family: string): string {
  const f = family.trim()
  const lc = f.toLowerCase()
  const quoted = /\s/.test(f) ? `'${f}'` : f
  if (/(mono|code|consol|courier)/.test(lc)) return `${quoted}, var(--font-mono), ui-monospace, monospace`
  if (/(serif|times|georgia|garamond|playfair|lora|merriweather|pt serif|libre|caslon|didot|cormorant|spectral|fraunces)/.test(lc))
    return `${quoted}, Georgia, 'Times New Roman', serif`
  return `${quoted}, var(--font), system-ui, -apple-system, sans-serif`
}

// Families already bundled by global.css — no need to fetch again.
const PRELOADED = new Set([
  'google sans flex', 'google sans', 'inter', 'outfit', 'sometype mono',
  'source serif 4', 'space grotesk', 'archivo black',
])
// Locally-available system families — never fetched from Google.
const SYSTEM = new Set([
  'helvetica', 'helvetica neue', 'arial', 'arial black', 'system-ui', '-apple-system',
  'times', 'times new roman', 'georgia', 'courier', 'courier new', 'verdana', 'tahoma',
  'trebuchet ms', 'palatino', 'garamond', 'sans-serif', 'serif', 'monospace', 'ui-monospace',
])
const FETCHED = new Set<string>()

// Lazily fetch a Google font for any family not already available. Best-effort:
// a non-existent family just fails to load and the stack falls back. Each family
// gets its own <link>, so one failure never blocks the others.
export function ensureFont(family?: string) {
  if (typeof document === 'undefined') return
  const f = (family || '').trim()
  if (!f) return
  const key = f.toLowerCase()
  if (PRELOADED.has(key) || SYSTEM.has(key) || FETCHED.has(key)) return
  FETCHED.add(key)
  const fam = encodeURIComponent(f).replace(/%20/g, '+')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.dataset.themeFont = key
  link.href = `https://fonts.googleapis.com/css2?family=${fam}:wght@400;500;600;700;800&display=swap`
  // If the weighted request is rejected (single-weight families), retry plainly.
  link.onerror = () => {
    const plain = document.createElement('link')
    plain.rel = 'stylesheet'
    plain.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`
    document.head.appendChild(plain)
  }
  document.head.appendChild(link)
}

function useThemeFonts(t: ThemeTokens) {
  useEffect(() => { ensureFont(t.titleName); ensureFont(t.bodyName) }, [t.titleName, t.bodyName])
}

// Build a smooth multi-stop gradient from the theme's brand colours. Always
// returns something elegant: tonal fade for monochrome palettes, a 2–3 colour
// sweep otherwise. This is the "colours" signal — no hard swatch strips.
function paletteGradient(t: ThemeTokens, angle = 150): { css: string; on: string } {
  const chroma = uniq([t.accent, t.secondary, t.tertiary, t.primary].filter(chromatic))
  let stops: string[]
  if (chroma.length >= 2) stops = chroma.slice(0, 3)
  else if (chroma.length === 1) stops = [chroma[0], mix(chroma[0], t.surface, 0.62)] // single hue → fade to surface
  else stops = [mix(t.ink, t.surface, 0.35), t.surface] // pure monochrome → quiet tonal fade
  const on = readableText(mix(stops[0], stops[stops.length - 1], 0.5))
  return { css: `linear-gradient(${angle}deg, ${stops.join(', ')})`, on }
}

function padChips(chips: string[]): string[] {
  const out = chips.slice(0, 4)
  while (out.length < 4) out.push(out[out.length - 1] || '#888')
  return out
}

// Product cutouts shipped with the app (transparent PNGs in /public/products).
// The preview composites one of these so the frame reads as a real product
// launch. The product stays constant across themes — only colour/type vary.
export const THEME_PRODUCTS: Record<string, string> = {
  headphones: '/products/headphones.png',
  airpods: '/products/airpods.png',
}
export type ProductKey = keyof typeof THEME_PRODUCTS

// ─────────────────────────────────────────────────────────────────────────────
//  THUMBNAIL — explicit-colour square specimen for the gallery
// ─────────────────────────────────────────────────────────────────────────────
// The palette is shown EXPLICITLY (solid swatches, not a blend), layered by
// priority so the dominant colours read first; the theme name is set in its
// title face and a quiet caption names the fonts. Several treatments, all
// uniform and driven only by the resolved colours + fonts. Container-query
// sized so one component reads from ≈80px up to large cards.
//   strip    — name + brand mark, hard 4-swatch base (the original)
//   priority — name, proportional colour bar (width = priority)
//   dots     — name, row of colour dots sized by priority
//   priority — name, proportional colour bar (width = priority) — default
//   rail     — proportional colour spine on the left + type
//   columns  — full-height proportional colour columns + a type band
//   blocks   — asymmetric colour mosaic (priority by block area)
//   corner   — primary corner field nesting the rest (priority by area)
//   quadrant — even 2×2 colour grid in the corner
//   arch     — nested rainbow arches rising from the base
//   bauhaus  — circle/square/triangle/bar primitives in a row
//   diagonal — colour wedges split on the diagonal
//   glow-*   — a soft palette bloom on a black/white field (5 origins)
export type ThumbVariant =
  | 'priority' | 'rail' | 'columns' | 'blocks' | 'corner'
  | 'quadrant' | 'arch' | 'bauhaus' | 'diagonal'
  | 'glow-bottom' | 'glow-top' | 'glow-side' | 'glow-corner' | 'glow-spot'

// Palette in priority order (primary → accent), always 4 entries.
function priorityPalette(t: ThemeTokens): string[] { return padChips(t.chips) }

// Bloom origins for the 'glow-*' thumbnails — a soft light source in the
// palette colours fading into a contrasting black/white field.
const GLOWS: Record<string, { x: string; y: string; w: string; h: string; top: boolean; max: string; star?: boolean }> = {
  'glow-bottom': { x: '50%', y: '116%', w: '135%', h: '92%', top: true, max: '82%' },
  'glow-top': { x: '50%', y: '-16%', w: '135%', h: '92%', top: false, max: '82%' },
  'glow-side': { x: '120%', y: '50%', w: '95%', h: '140%', top: true, max: '62%' },
  'glow-corner': { x: '112%', y: '114%', w: '125%', h: '115%', top: true, max: '64%' },
  'glow-spot': { x: '40%', y: '74%', w: '74%', h: '64%', top: true, max: '70%', star: true },
}

export function ThemeThumb({ theme, radius = 16, variant = 'priority' }: { theme: ThemeInput; radius?: number; variant?: ThumbVariant }) {
  const t = resolveTheme(theme)
  useThemeFonts(t)
  const pal = priorityPalette(t)
  const fonts = `${t.titleName} · ${t.bodyName}`
  const tint = `radial-gradient(76% 60% at 86% 6%, ${alpha(t.accent, t.dark ? 0.2 : 0.13)}, transparent 60%)`
  const shell: React.CSSProperties = { position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: radius, overflow: 'hidden', background: t.surface, containerType: 'inline-size' as const }

  // shared type block (name + font caption) used by several variants
  const TypeBlock = ({ color = t.ink }: { color?: string }) => (
    <>
      <div style={{ fontFamily: t.titleStack, fontWeight: 800, fontSize: '12.5cqw', lineHeight: 1.02, letterSpacing: '0.005em', color, overflowWrap: 'break-word' as const }}>{t.name}</div>
      <div style={{ fontFamily: t.bodyStack, fontSize: '5.2cqw', color: alpha(color, 0.66), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fonts}</div>
    </>
  )

  if (variant === 'rail') {
    const weights = [1.7, 1.15, 0.82, 0.6]
    return (
      <div style={shell}>
        {/* proportional colour spine on the left */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '20cqw', display: 'flex', flexDirection: 'column' }}>
          {pal.map((c, i) => <span key={i} style={{ flex: weights[i], background: c }} />)}
        </div>
        <div style={{ position: 'absolute', left: '20cqw', right: 0, top: 0, bottom: 0, background: tint, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '3cqw' }}>
          <TypeBlock />
        </div>
      </div>
    )
  }

  if (variant === 'corner') {
    // colour field kept to a true bottom-right corner; type sits in the clear
    // top band so the caption never sinks into the swatches.
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, background: tint }} />
        <div style={{ position: 'absolute', right: 0, bottom: 0, width: '50cqw', height: '50cqw', background: pal[0], borderTopLeftRadius: '13cqw' }} />
        <div style={{ position: 'absolute', right: 0, bottom: 0, width: '33cqw', height: '33cqw', background: pal[1], borderTopLeftRadius: '11cqw' }} />
        <div style={{ position: 'absolute', right: 0, bottom: 0, width: '19cqw', height: '19cqw', background: pal[2], borderTopLeftRadius: '8cqw' }} />
        <div style={{ position: 'absolute', right: 0, bottom: 0, width: '9cqw', height: '9cqw', background: pal[3] }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', gap: '3cqw', maxWidth: '82%' }}>
          <div style={{ fontFamily: t.titleStack, fontWeight: 800, fontSize: '12cqw', lineHeight: 1.02, letterSpacing: '0.005em', color: t.ink, overflowWrap: 'break-word' as const }}>{t.name}</div>
          <div style={{ fontFamily: t.bodyStack, fontSize: '5.2cqw', color: t.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fonts}</div>
        </div>
      </div>
    )
  }

  if (variant === 'columns') {
    const weights = [1.7, 1.15, 0.82, 0.6]
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          {pal.map((c, i) => <span key={i} style={{ flex: weights[i], background: c }} />)}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '9cqw 10cqw', background: t.surface, borderTop: `1px solid ${t.hairline}`, display: 'flex', flexDirection: 'column', gap: '2.4cqw' }}>
          <TypeBlock />
        </div>
      </div>
    )
  }

  if (variant === 'blocks') {
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, background: tint }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', gap: '3cqw' }}><TypeBlock /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42cqw', display: 'flex', gap: '0' }}>
          <span style={{ flex: 1.6, background: pal[0] }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ flex: 1.2, background: pal[1] }} />
            <div style={{ flex: 1, display: 'flex' }}>
              <span style={{ flex: 1, background: pal[2] }} />
              <span style={{ flex: 1, background: pal[3] }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'quadrant') {
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, background: tint }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', gap: '3cqw', maxWidth: '88%' }}>
          <div style={{ fontFamily: t.titleStack, fontWeight: 800, fontSize: '12cqw', lineHeight: 1.02, color: t.ink, overflowWrap: 'break-word' as const }}>{t.name}</div>
          <div style={{ fontFamily: t.bodyStack, fontSize: '5.2cqw', color: t.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fonts}</div>
        </div>
        <div style={{ position: 'absolute', right: 0, bottom: 0, width: '52cqw', height: '52cqw', borderTopLeftRadius: '13cqw', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
          {pal.map((c, i) => <span key={i} style={{ background: c }} />)}
        </div>
      </div>
    )
  }

  if (variant === 'arch') {
    const arches = pal.map((c, i) => ({ c, w: 92 - i * 21, h: 47 - i * 9 }))
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, background: tint }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', gap: '3cqw' }}><TypeBlock /></div>
        {arches.map((a, i) => (
          <div key={i} style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: `${a.w}cqw`, height: `${a.h}cqw`, background: a.c, borderRadius: '999cqw 999cqw 0 0' }} />
        ))}
      </div>
    )
  }

  if (variant === 'bauhaus') {
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, background: tint }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', gap: '3cqw' }}><TypeBlock /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 10cqw 11cqw', display: 'flex', alignItems: 'flex-end', gap: '4cqw' }}>
          <span style={{ width: '23cqw', height: '23cqw', borderRadius: '50%', background: pal[0], flex: 'none' }} />
          <span style={{ width: '21cqw', height: '21cqw', borderRadius: '3.5cqw', background: pal[1], flex: 'none' }} />
          <span style={{ width: '24cqw', height: '22cqw', background: pal[2], flex: 'none', clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
          <span style={{ width: '9cqw', height: '24cqw', borderRadius: '99cqw', background: pal[3], flex: 'none' }} />
        </div>
      </div>
    )
  }

  if (variant === 'diagonal') {
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, background: tint }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', gap: '3cqw' }}><TypeBlock /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '46cqw', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: pal[0] }} />
          <div style={{ position: 'absolute', inset: 0, background: pal[1], clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: pal[2], clipPath: 'polygon(100% 0, 100% 58%, 52% 0)' }} />
          <div style={{ position: 'absolute', inset: 0, background: pal[3], clipPath: 'polygon(100% 100%, 100% 64%, 64% 100%)' }} />
        </div>
      </div>
    )
  }

  if (variant.startsWith('glow')) {
    const cfg = GLOWS[variant]
    const field = t.dark ? '#08080b' : '#fbfbfc'
    const txt = t.dark ? '#ffffff' : '#0c0c0e'
    const [a, b] = shapeColors(t)
    const bloom = t.dark
      ? `radial-gradient(${cfg.w} ${cfg.h} at ${cfg.x} ${cfg.y}, rgba(255,255,255,0.92), ${a} 22%, ${b} 48%, transparent 78%)`
      : `radial-gradient(${cfg.w} ${cfg.h} at ${cfg.x} ${cfg.y}, ${a}, ${b} 44%, transparent 74%)`
    return (
      <div style={{ ...shell, background: field }}>
        <div style={{ position: 'absolute', inset: 0, background: bloom }} />
        {cfg.star && (
          <svg viewBox="0 0 24 24" style={{ position: 'absolute', left: '34cqw', top: '54cqw', width: '12cqw', height: '12cqw', filter: 'drop-shadow(0 0 4cqw rgba(255,255,255,0.8))' }} aria-hidden>
            <path d="M12 0c1 6 5 10 11 12-6 2-10 6-11 12-1-6-5-10-11-12C7 10 11 6 12 0Z" fill="#fff" />
          </svg>
        )}
        <div style={{ position: 'absolute', inset: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', justifyContent: cfg.top ? 'flex-start' : 'flex-end', gap: '2.6cqw' }}>
          <div style={{ maxWidth: cfg.max, fontFamily: t.titleStack, fontWeight: 800, fontSize: '10.5cqw', lineHeight: 1.05, letterSpacing: '0.015em', textTransform: 'uppercase', color: txt, overflowWrap: 'break-word' as const }}>{t.name}</div>
          <div style={{ fontFamily: t.bodyStack, fontSize: '5.2cqw', color: alpha(txt, 0.6), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fonts}</div>
        </div>
      </div>
    )
  }

  // 'priority' (default) — name + font caption on top, palette as a
  // proportional colour bar below (widest swatch = highest priority).
  const weights = [1.7, 1.15, 0.82, 0.6]
  return (
    <div style={shell}>
      <div style={{ position: 'absolute', inset: 0, background: tint }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', gap: '3cqw' }}><TypeBlock /></div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '30cqw', display: 'flex' }}>
        {pal.map((c, i) => <span key={i} style={{ flex: weights[i], background: c }} />)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PREVIEW FRAME — clean product-launch card
// ─────────────────────────────────────────────────────────────────────────────
// Deliberately uncluttered: a solid surface field, the headline in the title
// face (lead in ink, tail in the accent), a sub-line in the body face, and the
// palette carried by BIG decorative shapes behind a real product cutout —
// organic blobs, a sweeping arc, a colour-blocked panel, or orbiting circles.
// Uniform across themes; only the colours and the two typefaces change.
//   meta.shape: 'arc' (default) · 'blobs' · 'panel' · 'orbit'
export interface PreviewMeta {
  headline?: string
  sub?: string
  durationSec?: number
  /** 'headphones' | 'airpods' | a URL | 'none' */
  product?: ProductKey | 'none' | string
  shape?: 'arc' | 'blobs' | 'panel' | 'orbit'
}

// Three brand colours for the big shapes — falls back to accent tints when a
// palette is mostly neutral, so monochrome themes still get shapely depth.
function shapeColors(t: ThemeTokens): [string, string, string] {
  const chroma = uniq([t.accent, t.secondary, t.tertiary, t.primary].filter(chromatic))
  const a = chroma[0] || t.accent
  const b = chroma[1] || mix(a, t.surface, 0.5)
  const c = chroma[2] || mix(a, t.dark ? '#ffffff' : '#000000', 0.3)
  return [a, b, c]
}

// All shapes live in the LOWER half of the frame so the headline (top band)
// always sits on the clear surface. The product sits on top of them.
function PreviewShapes({ variant, t }: { variant: NonNullable<PreviewMeta['shape']>; t: ThemeTokens }) {
  const [a, b, c] = shapeColors(t)
  const disc = (s: number, pos: React.CSSProperties, bg: string, extra: React.CSSProperties = {}): React.CSSProperties =>
    ({ position: 'absolute', width: `${s}cqw`, height: `${s}cqw`, borderRadius: '50%', background: bg, ...pos, ...extra })

  if (variant === 'blobs') {
    return (
      <>
        <div style={{ position: 'absolute', right: '-12cqw', bottom: '-16cqw', width: '66cqw', height: '66cqw', background: a, borderRadius: '58% 42% 47% 53% / 53% 50% 50% 47%' }} />
        <div style={{ position: 'absolute', left: '-10cqw', bottom: '6cqw', width: '34cqw', height: '34cqw', background: b, borderRadius: '50% 50% 46% 54% / 55% 45% 55% 45%' }} />
        <div style={{ position: 'absolute', left: '30cqw', bottom: '-8cqw', width: '18cqw', height: '18cqw', background: c, borderRadius: '54% 46% 50% 50% / 48% 52% 48% 52%' }} />
      </>
    )
  }
  if (variant === 'panel') {
    return (
      <>
        <div style={{ position: 'absolute', right: '-6cqw', bottom: '6cqw', width: '60cqw', height: '56cqw', background: a, borderRadius: '9cqw' }} />
        <div style={disc(30, { left: '-8cqw', bottom: '-8cqw' }, b)} />
        <div style={disc(9, { left: '24cqw', bottom: '18cqw' }, c)} />
      </>
    )
  }
  if (variant === 'orbit') {
    return (
      <>
        <div style={disc(96, { right: '-26cqw', bottom: '-32cqw' }, a)} />
        <div style={disc(40, { right: '30cqw', bottom: '6cqw' }, 'transparent', { border: `3cqw solid ${b}` })} />
        <div style={disc(13, { left: '8cqw', bottom: '14cqw' }, c)} />
      </>
    )
  }
  // 'arc' (default) — one big sweeping disc + a soft accompanying circle
  return (
    <>
      <div style={disc(106, { right: '-28cqw', bottom: '-34cqw' }, a)} />
      <div style={disc(30, { left: '-8cqw', bottom: '-4cqw' }, b)} />
      <div style={disc(10, { left: '20cqw', bottom: '12cqw' }, c)} />
    </>
  )
}

export function ThemePreviewFrame({ theme, meta = {}, className }: { theme: ThemeInput; meta?: PreviewMeta; className?: string }) {
  const t = resolveTheme(theme)
  useThemeFonts(t)
  const shape = meta.shape ?? 'arc'
  const on = t.ink
  const onSoft = t.inkSoft

  const headline = meta.headline ?? (meta.durationSec ? `A ${meta.durationSec}-second launch, in motion` : 'Your product, in motion')
  const sub = meta.sub ?? 'See how your type & colour carry across a real frame.'
  const productKey = meta.product ?? 'headphones'
  const productSrc = productKey === 'none' ? '' : (THEME_PRODUCTS[productKey] ?? productKey)

  // two-tone headline — bold lead, accent tail.
  const hw = headline.split(' ')
  const cut = Math.ceil(hw.length / 2)
  const lead = hw.slice(0, cut).join(' ')
  const tail = hw.slice(cut).join(' ')

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', background: t.surface, color: on, containerType: 'inline-size' as const }}>
      {/* big colour shapes — the palette, expressed graphically */}
      <PreviewShapes variant={shape} t={t} />

      {/* product cutout — seated bottom-right, on top of the shapes */}
      {productSrc && (
        <img src={productSrc} alt="" style={{ position: 'absolute', right: '-8cqw', bottom: '-6cqw', width: '66cqw', height: 'auto', zIndex: 1, filter: `drop-shadow(0 8cqw 11cqw ${alpha('#000000', 0.4)})`, pointerEvents: 'none' }} />
      )}

      {/* hero copy — title face + body face, top band (clear of the shapes) */}
      <div style={{ position: 'relative', zIndex: 2, padding: '9cqw 8.5cqw', display: 'flex', flexDirection: 'column', gap: '3.6cqw', maxWidth: '86%' }}>
        <div style={{ fontFamily: t.titleStack, fontWeight: 700, fontSize: '11cqw', lineHeight: 1.02, letterSpacing: '-0.025em' }}>
          <span style={{ color: on }}>{lead}</span>{tail && <> <span style={{ color: t.accent }}>{tail}</span></>}
        </div>
        <div style={{ fontFamily: t.bodyStack, fontSize: '3.5cqw', lineHeight: 1.5, color: onSoft, maxWidth: '64%' }}>{sub}</div>
      </div>
    </div>
  )
}

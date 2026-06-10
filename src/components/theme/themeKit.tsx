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

// Frosted-glass tokens that read on either a light or dark gradient field.
function glassTokens(on: string) {
  const light = on === '#ffffff' // gradient is dark → white text → faint light glass
  return {
    plate: light ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.5)',
    plateBorder: light ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)',
    pill: light ? 'rgba(255,255,255,0.15)' : 'rgba(20,20,24,0.1)',
    pillBorder: light ? 'rgba(255,255,255,0.34)' : 'rgba(20,20,24,0.18)',
  }
}

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
//   stack    — name, fanned deck of colour cards (priority by size/stack)
//   columns  — full-height proportional colour columns + a type band
//   blocks   — asymmetric colour mosaic (priority by block area)
export type ThumbVariant = 'strip' | 'priority' | 'stack' | 'columns' | 'blocks'

// Palette in priority order (primary → accent), always 4 entries.
function priorityPalette(t: ThemeTokens): string[] { return padChips(t.chips) }

export function ThemeThumb({ theme, radius = 16, variant = 'strip' }: { theme: ThemeInput; radius?: number; variant?: ThumbVariant }) {
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

  if (variant === 'priority') {
    const weights = [1.7, 1.15, 0.82, 0.6] // width ∝ priority
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

  if (variant === 'stack') {
    // fanned deck — primary largest at the back, accent smallest at the front
    const cards = [
      { c: pal[0], s: 52, x: 30, y: 30, r: -8 },
      { c: pal[1], s: 46, x: 44, y: 40, r: -2 },
      { c: pal[2], s: 40, x: 58, y: 50, r: 5 },
      { c: pal[3], s: 34, x: 70, y: 60, r: 12 },
    ]
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, background: tint }} />
        {cards.map((k, i) => (
          <div key={i} style={{ position: 'absolute', left: `${k.x}%`, top: `${k.y}%`, width: `${k.s}cqw`, height: `${k.s}cqw`, borderRadius: '7cqw', background: k.c, transform: `translate(-50%,-50%) rotate(${k.r}deg)`, boxShadow: `0 4cqw 9cqw ${alpha('#000', t.dark ? 0.5 : 0.22)}`, border: `1.5px solid ${alpha(t.dark ? '#fff' : '#000', 0.08)}` }} />
        ))}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '11cqw 10cqw', display: 'flex', flexDirection: 'column', gap: '3cqw', maxWidth: '74%' }}><TypeBlock /></div>
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

  // 'strip' (default) — the original: brand mark, name in the title face, a
  // font caption, ghost letterform, and a hard 4-swatch palette base.
  return (
    <div style={shell}>
      <div style={{ position: 'absolute', inset: 0, background: tint }} />
      <div aria-hidden style={{ position: 'absolute', right: '-6%', bottom: '-20%', fontFamily: t.titleStack, fontWeight: 800, fontSize: '90cqw', lineHeight: 1, color: t.inkGhost, letterSpacing: '-0.04em', pointerEvents: 'none' }}>{t.initial}</div>
      <div style={{ position: 'absolute', inset: 0, padding: '9cqw 9cqw 0', display: 'flex', flexDirection: 'column' }}>
        <span style={{ width: '17cqw', height: '17cqw', flex: 'none', borderRadius: '4.6cqw', background: t.logoSrc ? t.panel : t.accent, color: t.onAccent, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          {t.logoSrc ? <img src={t.logoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontFamily: t.titleStack, fontWeight: 800, fontSize: '9.5cqw', lineHeight: 1 }}>{t.initial}</span>}
        </span>
        <div style={{ marginTop: 'auto', paddingBottom: '10cqw', display: 'flex', flexDirection: 'column', gap: '2.6cqw' }}>
          <div style={{ fontFamily: t.titleStack, fontWeight: 800, fontSize: '13cqw', lineHeight: 1, letterSpacing: '0.01em', textTransform: 'uppercase', color: t.ink, overflowWrap: 'break-word' as const }}>{t.name}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3cqw', minWidth: 0 }}>
            <span style={{ fontFamily: t.titleStack, fontSize: '6cqw', fontWeight: 600, color: t.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.titleName}</span>
            <span style={{ width: '1.3cqw', height: '1.3cqw', borderRadius: '50%', background: t.accent, flex: 'none' }} />
            <span style={{ fontFamily: t.bodyStack, fontSize: '6cqw', color: t.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.bodyName}</span>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', height: '8cqw' }}>
        {pal.map((c, i) => <span key={i} style={{ flex: 1, background: c }} />)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  PREVIEW FRAME — clean product-launch card
// ─────────────────────────────────────────────────────────────────────────────
// Deliberately uncluttered: a palette-gradient field, the headline in the title
// face (two-tone), a sub-line in the body face, and a real product cutout
// bleeding off the corner. Uniform across themes — only the gradient, the two
// typefaces, and the text colour change. A pure function of the tokens.
export interface PreviewMeta {
  headline?: string
  sub?: string
  durationSec?: number
  /** 'headphones' | 'airpods' | a URL | 'none' */
  product?: ProductKey | 'none' | string
}

export function ThemePreviewFrame({ theme, meta = {}, className }: { theme: ThemeInput; meta?: PreviewMeta; className?: string }) {
  const t = resolveTheme(theme)
  useThemeFonts(t)
  const g = paletteGradient(t, 145)
  const on = g.on
  const onSoft = alpha(on, 0.66)

  const headline = meta.headline ?? (meta.durationSec ? `A ${meta.durationSec}-second launch, in motion` : 'Your product, in motion')
  const sub = meta.sub ?? 'See how your type & colour carry across a real frame.'
  const productKey = meta.product ?? 'headphones'
  const productSrc = productKey === 'none' ? '' : (THEME_PRODUCTS[productKey] ?? productKey)

  // two-tone headline — bold lead, softer tail (the gradient-card look).
  const hw = headline.split(' ')
  const cut = Math.ceil(hw.length / 2)
  const lead = hw.slice(0, cut).join(' ')
  const tail = hw.slice(cut).join(' ')

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden', background: g.css, color: on, containerType: 'inline-size' as const }}>
      {/* atmosphere */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(82% 56% at 14% 2%, rgba(255,255,255,0.2), transparent 56%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 44%, ${alpha('#000000', on === '#ffffff' ? 0.34 : 0.08)} 100%)`, pointerEvents: 'none' }} />

      {/* product cutout — seated bottom-right, bleeding off the edge */}
      {productSrc && (
        <>
          <div style={{ position: 'absolute', right: '2cqw', bottom: '0cqw', width: '74cqw', height: '50cqw', background: 'radial-gradient(50% 50% at 60% 70%, rgba(255,255,255,0.22), transparent 70%)', pointerEvents: 'none' }} />
          <img src={productSrc} alt="" style={{ position: 'absolute', right: '-8cqw', bottom: '-6cqw', width: '68cqw', height: 'auto', filter: `drop-shadow(0 8cqw 10cqw ${alpha('#000000', 0.42)})`, pointerEvents: 'none' }} />
        </>
      )}

      {/* hero copy — title face + body face, top-left */}
      <div style={{ position: 'relative', zIndex: 2, padding: '10cqw 8.5cqw', display: 'flex', flexDirection: 'column', gap: '4cqw', maxWidth: '72%' }}>
        <div style={{ fontFamily: t.titleStack, fontWeight: 700, fontSize: '11.5cqw', lineHeight: 1.0, letterSpacing: '-0.025em' }}>
          <span style={{ color: on }}>{lead}</span>{tail && <> <span style={{ color: alpha(on, 0.5) }}>{tail}</span></>}
        </div>
        <div style={{ fontFamily: t.bodyStack, fontSize: '3.6cqw', lineHeight: 1.5, color: onSoft }}>{sub}</div>
      </div>
    </div>
  )
}

function Arrow({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" style={{ width: '3cqw', height: '3cqw' }} aria-hidden>
      <path d="M3 8h9M8.5 4l4 4-4 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

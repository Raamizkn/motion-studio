import type {
  StudioTemplate,
  VideoProjectConfig,
  StoryboardFrame,
  SceneSeed,
  SceneKind,
  TransitionKind,
  EditorState,
  TimelineClip,
  EditorLayer,
  OverlayElement,
  ModelTier,
  AspectRatio,
} from './types'
import { buildScenes } from './sceneModel'

// ── Palettes ──────────────────────────────────────────────────────────────
export const PALETTES: Record<string, string[]> = {
  violet: ['#7c5cff', '#c44bff', '#4e7bff'],
  ocean: ['#2dd4bf', '#3b82f6', '#6366f1'],
  sunset: ['#ff6b6b', '#ff9f45', '#ffd93d'],
  lime: ['#c8f24e', '#3ad27f', '#2dd4bf'],
  rose: ['#ff5d8f', '#ff8fb1', '#c44bff'],
  mono: ['#e5e5e5', '#9c9c9c', '#5c5c5c'],
}

export const MODELS: { id: ModelTier; name: string; desc: string; tier: string; render: string }[] = [
  { id: 'standard', name: 'Kinetic Standard', desc: 'Fast generation, great for drafts', tier: 'Standard', render: '~40s' },
  { id: 'pro', name: 'Kinetic Pro', desc: 'Higher quality, richer animations', tier: 'Pro', render: '~90s' },
  { id: 'cinema', name: 'Kinetic Cinema', desc: 'Max quality · 3D assets · premium render', tier: 'Cinema', render: '~3m' },
]

export const TRANSITIONS: { id: TransitionKind; label: string }[] = [
  { id: 'cut', label: 'Cut' },
  { id: 'fade', label: 'Fade' },
  { id: 'slide', label: 'Slide' },
  { id: 'wipe', label: 'Wipe' },
  { id: 'zoom', label: 'Zoom' },
]

const seed = (kind: SceneKind, palette: string[], headline: string, lines: string[]): SceneSeed => ({
  kind,
  palette,
  headline,
  lines,
  accent: palette[0],
})

// editorial register palette (ink · accent blue · accent orange · paper)
const PALETTES_EDITORIAL = ['#141414', '#3B5BDB', '#E8590C', '#F5F2EC']

// ── Seed templates ──────────────────────────────────────────────────────────
export const TEMPLATES: StudioTemplate[] = [
  {
    id: 'yc-editorial',
    name: 'Editorial Launch',
    description: 'Prestige editorial film — warm paper, serif display, quiet confidence',
    category: 'Brand',
    tags: ['editorial', 'launch', 'serif', 'premium'],
    durationSec: 20,
    aspect: '16:9',
    model: 'cinema',
    isNew: true,
    register: 'editorial',
    themeId: 'editorial',
    config: { aspect: '16:9', durationSec: 20, model: 'cinema', palette: [PALETTES_EDITORIAL[0], PALETTES_EDITORIAL[1], PALETTES_EDITORIAL[2]], transition: 'fade' },
    seed: seed('hero', PALETTES_EDITORIAL, 'Built for the people who *make* things', ['Introducing', '2025']),
    brief:
      'A 20-second editorial launch film in the register of a prestige tech announcement (Y Combinator / Stripe Press). ' +
      'Warm paper background (#F5F2EC), near-black serif display type (Source Serif 4) with a single decisive accent, hard-offset shadows, and subtle film grain. ' +
      'Beat 1: a small uppercase kicker label fades in. Beat 2: a large serif statement builds line-by-line (the final word emphasised in the accent colour). ' +
      'Beat 3: a centred editorial pull-quote with a thin rule. Beat 4: a restrained feature/data beat — a few numbers or short phrases that count up or stagger in. ' +
      'Beat 5: a final brand lockup with the mark and a quiet motto, holding still on the last frame. ' +
      'Confident, calm, premium. No glossy SaaS gradients, no neon glow — typography and timing carry it.',
  },
  {
    id: 'saas-explainer',
    name: 'SaaS Explainer',
    description: 'Dark cinematic product walkthrough — glass cards, accent glow, tight geometric sans',
    category: 'SaaS',
    tags: ['feature', 'walkthrough', 'product'],
    durationSec: 30,
    aspect: '16:9',
    model: 'standard',
    isNew: true,
    register: 'product',
    config: { aspect: '16:9', durationSec: 30, model: 'standard', palette: PALETTES.violet, transition: 'fade' },
    seed: seed('hero', PALETTES.violet, 'Ship *faster*', ['The all-in-one workspace', 'New']),
    brief:
      'A 30s modern product explainer in a dark cinematic SaaS register (#0a0a0c base, mesh radial-gradient backdrops, glassmorphism cards with backdrop-blur, soft long shadows, accent glow). ' +
      'Tight geometric sans (Outfit/Inter 700–900), huge headline opener, then 3 feature beats as glass cards sliding in with staggered captions, a quick UI-mock moment, and a CTA lockup. Smooth, confident, techy.',
  },
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'Hero reveal with floating spec callouts and a punchy CTA',
    category: 'Product',
    tags: ['launch', 'hero', 'specs'],
    durationSec: 20,
    aspect: '16:9',
    model: 'pro',
    register: 'product',
    config: { aspect: '16:9', durationSec: 20, model: 'pro', palette: PALETTES.ocean, transition: 'slide' },
    seed: seed('showcase', PALETTES.ocean, 'Meet the new flagship', ['Lightning fast', 'All-day battery', 'Built to last']),
    brief:
      'A 20s product launch film, dark premium product register with a cool ocean accent. A device/product stand-in (drawn in CSS) floats in with parallax; spec callouts draw on with thin connector lines; ' +
      'a hero stat pops, then a clean CTA lockup. Cinematic depth, soft glow, restrained motion — Apple-keynote energy.',
  },
  {
    id: 'founder-story',
    name: 'Founder Story',
    description: 'Minimal, spacious brand story — clean type, generous negative space',
    category: 'Brand',
    tags: ['story', 'minimal', 'brand'],
    durationSec: 30,
    aspect: '16:9',
    model: 'pro',
    register: 'minimal',
    config: { aspect: '16:9', durationSec: 30, model: 'pro', palette: PALETTES.mono, transition: 'fade' },
    seed: seed('split', PALETTES.mono, 'It started with a problem', ['Our mission']),
    brief:
      'A 30s founder/brand story in a minimal luxury register: near-white surface, near-black ink, a single restrained accent, lots of negative space, clean grotesque sans, hairline rules. ' +
      'Slow, deliberate text reveals — one calm statement per beat — building to a quiet mission line and a small wordmark. Editorial calm, no clutter, no glow.',
  },
  {
    id: 'social-ad',
    name: 'Social Ad',
    description: 'Loud color-block vertical ad — oversized type, hard cuts, springy motion',
    category: 'Social',
    tags: ['ad', '9:16', 'bold'],
    durationSec: 15,
    aspect: '9:16',
    model: 'standard',
    isNew: true,
    register: 'bold',
    config: { aspect: '9:16', durationSec: 15, model: 'standard', palette: PALETTES.sunset, transition: 'zoom' },
    seed: seed('hero', PALETTES.sunset, 'Summer *sale*', ['Up to 50% off', 'Limited']),
    brief:
      'A punchy 15s vertical (9:16) social ad in a bold consumer register: full-bleed saturated colour blocks that swap on hard beats, OVERSIZED heavy display type that scales/springs in, a price/offer slam, ' +
      'and a sticker-style CTA. High energy, snappy springy easing, brand-poster look. Make it scroll-stopping.',
  },
  {
    id: 'motion-intro',
    name: 'Motion Intro',
    description: 'Fast logo sting — kinetic type, blinds wipe, accent flash',
    category: 'Motion',
    tags: ['logo', 'intro', 'sting'],
    durationSec: 8,
    aspect: '16:9',
    model: 'cinema',
    register: 'product',
    config: { aspect: '16:9', durationSec: 8, model: 'cinema', palette: PALETTES.violet, transition: 'zoom' },
    seed: seed('logo', PALETTES.violet, 'Motion', ['Powered by Kinetic']),
    brief:
      'An 8s logo sting on a dark base: a column blinds wipe reveals a kinetic wordmark that assembles letter-by-letter, a warm accent flash, a subtle 3D settle, and a final hold on the mark with a tagline. Crisp, premium, fast.',
  },
  {
    id: 'brand-showcase',
    name: 'Brand Showcase',
    description: 'Square brand montage — bento grid of proof cards with parallax',
    category: 'Brand',
    tags: ['brand', 'square', 'bento'],
    durationSec: 12,
    aspect: '1:1',
    model: 'pro',
    register: 'product',
    config: { aspect: '1:1', durationSec: 12, model: 'pro', palette: PALETTES.lime, transition: 'wipe' },
    seed: seed('globe', PALETTES.lime, 'The world is the workspace', []),
    brief:
      'A 12s square (1:1) brand showcase: a bento grid of proof cards (CSS-drawn) animates in with rotationY + stagger and gentle parallax through the hold, a fresh lime accent, then collapses into a centered wordmark. Modern, crafted, confident.',
  },
  {
    id: 'app-showcase',
    name: 'App Showcase',
    description: 'Vertical phone-mockup walkthrough with screen transitions',
    category: 'Product',
    tags: ['app', '9:16', 'mockup'],
    durationSec: 25,
    aspect: '9:16',
    model: 'standard',
    register: 'product',
    config: { aspect: '9:16', durationSec: 25, model: 'standard', palette: PALETTES.ocean, transition: 'slide' },
    seed: seed('showcase', PALETTES.ocean, 'Your day, organized', ['Tasks', 'Focus', 'Flow']),
    brief:
      'A 25s vertical (9:16) app showcase: a CSS phone frame holds center; its screen swaps through 3 feature views with slide transitions while floating captions name each; a hero stat, then a download CTA. Clean product motion, soft glow.',
  },
  {
    id: 'keynote-deck',
    name: 'Keynote Presentation',
    description: 'Animated slide deck — agenda, section dividers, build-on bullets',
    category: 'Presentation',
    tags: ['deck', 'slides', 'keynote'],
    durationSec: 30,
    aspect: '16:9',
    model: 'standard',
    isNew: true,
    register: 'presentation',
    config: { aspect: '16:9', durationSec: 30, model: 'standard', palette: PALETTES.ocean, transition: 'slide' },
    seed: seed('cards', PALETTES.ocean, 'Q3 in review', ['Highlights', 'Roadmap', 'Asks']),
    brief:
      'A 30s animated keynote deck in a clean presentation register: a title slide, an agenda, two content slides with build-on bullet points and a simple chart, a section divider, and a closing slide. ' +
      'Consistent slide grid, page numbers, a single accent, crisp slide-to-slide transitions (push/wipe). Looks like a polished investor/keynote deck, not a movie.',
  },
  {
    id: 'pitch-deck',
    name: 'Pitch Deck',
    description: 'Startup pitch slides — problem, solution, traction, ask',
    category: 'Presentation',
    tags: ['pitch', 'startup', 'slides'],
    durationSec: 24,
    aspect: '16:9',
    model: 'standard',
    register: 'presentation',
    config: { aspect: '16:9', durationSec: 24, model: 'standard', palette: PALETTES.violet, transition: 'slide' },
    seed: seed('cards', PALETTES.violet, 'The problem is real', ['Solution', 'Traction', 'Raise']),
    brief:
      'A 24s startup pitch presentation: numbered slides — Problem, Solution, How it works, Traction (with one growth chart), and The Ask. Clean deck layout with a consistent footer, big slide headlines, supporting sub-points building in, confident push transitions. A modern VC-deck look.',
  },
  {
    id: 'data-story',
    name: 'Data Story',
    description: 'Infographic film — animated charts, counters and labeled stats',
    category: 'Infographic',
    tags: ['data', 'charts', 'stats'],
    durationSec: 24,
    aspect: '16:9',
    model: 'standard',
    isNew: true,
    register: 'infographic',
    config: { aspect: '16:9', durationSec: 24, model: 'standard', palette: PALETTES.ocean, transition: 'fade' },
    seed: seed('cards', PALETTES.ocean, 'The numbers are in', ['+212% growth', '1.3M users', '4.9★']),
    brief:
      'A 24s data-story infographic: animated bar and line charts that draw on (SVG stroke-dashoffset), big seek-safe counters that step up to their final values, labeled stat callouts, and a takeaway line. ' +
      'Crisp grid, clear axis labels, a 2-colour data palette, generous whitespace. Reads like a beautiful animated infographic, information-first.',
  },
  {
    id: 'stat-reel',
    name: 'Stat Reel',
    description: 'Vertical stat reel — punchy counters and proof for social',
    category: 'Infographic',
    tags: ['stats', '9:16', 'reel'],
    durationSec: 15,
    aspect: '9:16',
    model: 'standard',
    register: 'infographic',
    config: { aspect: '9:16', durationSec: 15, model: 'standard', palette: PALETTES.lime, transition: 'zoom' },
    seed: seed('cards', PALETTES.lime, 'By the numbers', ['98% retention', '2× faster', '#1 rated']),
    brief:
      'A 15s vertical (9:16) stat reel: three big numbers, one per beat, each counting up fast with a supporting label and a small drawn icon/ring, on alternating bold backgrounds, ending on a proof line + handle. Snappy, social-native, data-led.',
  },
  {
    id: 'quote-poster',
    name: 'Quote Poster',
    description: 'Animated typographic poster — one big idea, kinetic type',
    category: 'Poster',
    tags: ['poster', 'quote', 'type'],
    durationSec: 10,
    aspect: '1:1',
    model: 'standard',
    isNew: true,
    register: 'poster',
    config: { aspect: '1:1', durationSec: 10, model: 'standard', palette: PALETTES.rose, transition: 'fade' },
    seed: seed('quote', PALETTES.rose, 'Make something people want', ['']),
    brief:
      'A 10s square (1:1) animated typographic poster: a single bold statement set in HUGE display type, words revealing with kinetic per-word motion, one accent word, a thin rule and a small attribution. ' +
      'Poster-grade composition and negative space — feels like a moving print poster, not a slideshow.',
  },
  {
    id: 'drop-poster',
    name: 'Product Drop',
    description: 'Vertical hype poster — countdown energy, oversized type slam',
    category: 'Poster',
    tags: ['poster', 'drop', '9:16'],
    durationSec: 8,
    aspect: '9:16',
    model: 'standard',
    register: 'poster',
    config: { aspect: '9:16', durationSec: 8, model: 'standard', palette: PALETTES.sunset, transition: 'zoom' },
    seed: seed('hero', PALETTES.sunset, 'The drop is *here*', ['03 · 14', 'Set a reminder']),
    brief:
      'An 8s vertical (9:16) hype/drop poster: oversized type that slams in on the beat, a date/time lockup, a colour-block background with grain, and a "set a reminder" sticker CTA. Streetwear-drop energy, high contrast, kinetic.',
  },
]

export const TEMPLATE_CATEGORIES = ['All', 'Brand', 'SaaS', 'Product', 'Presentation', 'Infographic', 'Poster', 'Social', 'Motion'] as const

// ── Mock website scrape ─────────────────────────────────────────────────────
const SCRAPE_PRESETS: Record<string, { title: string; desc: string; palette: string[] }> = {
  default: { title: 'Acme Inc.', desc: 'The modern way to build', palette: PALETTES.violet },
}
export function scrapeWebsite(url: string): { title: string; description: string; colors: string[] } {
  const host = (() => {
    try {
      return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '')
    } catch {
      return url
    }
  })()
  const name = host.split('.')[0] || 'Site'
  const paletteKeys = Object.keys(PALETTES)
  const pick = PALETTES[paletteKeys[host.length % paletteKeys.length]]
  return {
    title: name.charAt(0).toUpperCase() + name.slice(1),
    description: `${name.charAt(0).toUpperCase() + name.slice(1)} — extracted from ${host}`,
    colors: pick,
  }
}

// ── Storyboard generation (deterministic "AI") ──────────────────────────────
const phrasesFromPrompt = (prompt: string): string[] => {
  const words = prompt.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
  if (!words.length) return ['Your big idea', 'In motion', 'Get started']
  const chunks: string[] = []
  for (let i = 0; i < words.length && chunks.length < 6; i += 3) {
    chunks.push(words.slice(i, i + 3).join(' '))
  }
  return chunks
}

const SCENE_PLANS: Record<number, SceneKind[]> = {
  2: ['logo', 'cta'],
  3: ['hero', 'cards', 'cta'],
  4: ['hero', 'showcase', 'cards', 'cta'],
  5: ['hero', 'split', 'cards', 'quote', 'cta'],
}
function planFor(duration: number): SceneKind[] {
  const n = duration <= 10 ? 2 : duration <= 18 ? 3 : duration <= 35 ? 4 : 5
  return SCENE_PLANS[n]
}

let _id = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(_id++).toString(36)}`

export function generateStoryboard(config: VideoProjectConfig): StoryboardFrame[] {
  const plan = planFor(config.durationSec)
  const palette = config.palette?.length ? config.palette : PALETTES.violet
  const phrases = phrasesFromPrompt(config.prompt)
  const brandTitle = config.brand?.title
  const seg = config.durationSec / plan.length

  const headlineFor = (kind: SceneKind, i: number): string => {
    switch (kind) {
      case 'hero':
        return brandTitle ? `*${brandTitle}*` : `*${phrases[0] || 'Your idea'}*`
      case 'cta':
        return phrases[phrases.length - 1] || 'Get started today'
      case 'quote':
        return phrases[1] || 'Built for people who care'
      case 'logo':
        return brandTitle || 'Motion'
      case 'globe':
        return phrases[i] || 'One platform, everywhere'
      default:
        return phrases[i] || phrases[0] || 'In motion'
    }
  }
  const linesFor = (kind: SceneKind): string[] => {
    if (kind === 'cards' || kind === 'showcase') return phrases.slice(0, 3)
    if (kind === 'cta') return ['Get started']
    if (kind === 'hero') return [config.brand?.description || phrases[1] || 'Made with Motion Studio', 'New']
    return phrases.slice(0, 2)
  }

  return plan.map((kind, i) => {
    const start = +(i * seg).toFixed(1)
    const end = +((i + 1) * seg).toFixed(1)
    const s: SceneSeed = {
      kind,
      palette,
      headline: headlineFor(kind, i),
      lines: linesFor(kind),
      accent: palette[0],
    }
    return {
      id: uid('frame'),
      index: i,
      start,
      end,
      kind,
      title: SCENE_TITLES[kind],
      copy: kind === 'hero' ? [s.headline.replace(/\*/g, ''), s.lines[0]] : s.lines.filter(Boolean),
      notes: SCENE_NOTES[kind],
      transition: config.transition,
      assetIds: [],
      seed: s,
    }
  })
}

const SCENE_TITLES: Record<SceneKind, string> = {
  hero: 'Brand Intro',
  cards: 'Feature Beats',
  quote: 'Testimonial',
  cta: 'Call to Action',
  logo: 'Logo Reveal',
  showcase: 'Product Showcase',
  globe: 'Global Reach',
  split: 'B-roll + Copy',
}
const SCENE_NOTES: Record<SceneKind, string> = {
  hero: 'Headline scales in with blur clear, subtitle follows. Kicker pinned top.',
  cards: 'One glass card per beat — enter, hold while the line plays, exit.',
  quote: 'Centred quote with oversized mark, attribution fades up.',
  cta: 'Bold CTA with glowing pill button, arrow nudges right.',
  logo: 'Logo flips in on Y axis, ring pulse out, tagline tracks in.',
  showcase: 'Product frame rises with sheen sweep, spec chips stagger in.',
  globe: 'Wireframe globe centres then slides left, copy tracks in right.',
  split: 'Footage collapses to corner card, copy holds left.',
}

export function defaultConfig(overrides: Partial<VideoProjectConfig> = {}): VideoProjectConfig {
  return {
    prompt: '',
    model: 'standard',
    aspect: '16:9',
    durationSec: 30,
    fps: 30,
    quality: 'standard',
    transition: 'fade',
    palette: PALETTES.violet,
    assetIds: [],
    ...overrides,
  }
}

// ── Editor state derived from a storyboard ─────────────────────────────────
const CLIP_COLORS = ['#7c5cff', '#3b82f6', '#2dd4bf', '#ff6b6b', '#c8f24e']

export function buildEditorState(frames: StoryboardFrame[], config: VideoProjectConfig): EditorState {
  const duration = frames.length ? frames[frames.length - 1].end : config.durationSec
  const clips: TimelineClip[] = frames.map((f, i) => ({
    id: uid('clip'),
    track: 0,
    group: 'video',
    name: `${String(i + 1).padStart(2, '0')} · ${f.title}`,
    start: f.start,
    duration: +(f.end - f.start).toFixed(2),
    color: CLIP_COLORS[i % CLIP_COLORS.length],
    transition: f.transition,
    seed: f.seed,
  }))

  const overlays: OverlayElement[] = []
  // a logo overlay across the whole video — uses an uploaded image asset if present
  const logoAsset = (config.assets || []).find((a) => a.type.startsWith('image/'))
  overlays.push({
    id: uid('ov'),
    sceneId: clips[0]?.id ?? '',
    kind: logoAsset ? 'image' : 'logo',
    text: config.brand?.title || 'LOGO',
    src: logoAsset?.dataUrl,
    x: 9,
    y: 11,
    w: logoAsset ? 10 : 14,
    h: 10,
    rotation: 0,
    opacity: 0.95,
    color: config.palette[0],
    animation: 'fade',
  })
  // (no auto title overlay — scene elements now own the editable headline/subtitle)

  const layers: EditorLayer[] = [
    ...clips.map((c) => ({ id: c.id, group: 'video' as const, name: c.name, visible: true, locked: false })),
    ...overlays.map((o) => ({
      id: o.id,
      group: 'overlays' as const,
      name: o.kind === 'logo' || o.kind === 'image' ? `Logo — ${o.text}` : `Text — ${o.text}`,
      visible: true,
      locked: false,
    })),
    { id: uid('au'), group: 'audio', name: 'Background Music', visible: true, locked: false },
    { id: uid('au'), group: 'audio', name: 'Voice Over', visible: true, locked: false },
    { id: uid('cap'), group: 'captions', name: 'Subtitles', visible: true, locked: false },
  ]

  return { clips, layers, overlays, scenes: buildScenes(frames), duration, selectedId: null }
}

export { uid }

// ── Vibe Motion flow configs ───────────────────────────────────────────────

export type FlowType = 'presentations' | 'text-motion' | 'infographics' | 'posters' | 'create-new'

export interface FlowConfig {
  id: FlowType
  title: string
  subtitle: string
  description: string
  palette: string[]
  aspect: AspectRatio
  durationSec: number
  transition: TransitionKind
  promptPlaceholder: string
  assistSuggestions: string[]
  quickFields: FlowField[]
}

export interface FlowField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'radio'
  placeholder?: string
  options?: { value: string; label: string }[]
  defaultValue?: string
}

// ── Themes (brand design systems Claude builds the video from) ──────────────
export interface VibeTheme {
  id: string
  name: string
  /** visual register Claude should commit to */
  register: string
  colors: { surface: string; primary: string; secondary: string; tertiary?: string; accent?: string }
  titleFont: string
  bodyFont: string
  logoText?: string
  styleNotes?: string
  builtin?: boolean
}

export const BUILTIN_THEMES: VibeTheme[] = [
  {
    id: 'editorial',
    name: 'Editorial Press',
    register: 'editorial / institutional',
    colors: { surface: '#F5F2EC', primary: '#141414', secondary: '#3B5BDB', tertiary: '#8A8575', accent: '#E8590C' },
    titleFont: 'Source Serif 4',
    bodyFont: 'DM Sans',
    styleNotes: 'Warm paper surface, near-black ink, oversized serif display, 2–4px solid borders, HARD offset shadows (not blurred), hairline rules, paper grain, ghost background words, proof-dense. The YC register.',
    builtin: true,
  },
  {
    id: 'midnight',
    name: 'Midnight Product',
    register: 'modern product / tech',
    colors: { surface: '#0a0a0c', primary: '#ffffff', secondary: '#8a3ffc', tertiary: '#a56eff', accent: '#4e7bff' },
    titleFont: 'Outfit',
    bodyFont: 'Inter',
    styleNotes: 'Dark cinematic base, radial mesh-gradient backdrops, glassmorphism cards, soft long shadows, accent glow, tight geometric sans 700–900.',
    builtin: true,
  },
  {
    id: 'sunrise',
    name: 'Sunrise Bold',
    register: 'playful / consumer',
    colors: { surface: '#FFF8F0', primary: '#1a1208', secondary: '#FF6B35', tertiary: '#F7B801', accent: '#7B2FF7' },
    titleFont: 'Outfit',
    bodyFont: 'DM Sans',
    styleNotes: 'Bright warm surface, rounded forms, bold color blocks, springy back.out motion, big friendly type.',
    builtin: true,
  },
  {
    id: 'mono',
    name: 'Mono Minimal',
    register: 'minimal / luxury',
    colors: { surface: '#0d0d0d', primary: '#fafafa', secondary: '#fafafa', tertiary: '#6a6a6a', accent: '#d4af37' },
    titleFont: 'Outfit',
    bodyFont: 'Inter',
    styleNotes: 'Near-black surface, single restrained metallic accent, vast negative space, slow confident motion, thin hairlines, monochrome with one gold accent.',
    builtin: true,
  },
]

export const FLOW_CONFIGS: Record<FlowType, FlowConfig> = {
  presentations: {
    id: 'presentations',
    title: 'Presentation Video',
    subtitle: 'Smooth controlled motion for modern slides',
    description: 'Slide-by-slide video with animated transitions, charts, and professional typography.',
    palette: PALETTES.violet,
    aspect: '16:9',
    durationSec: 30,
    transition: 'slide',
    promptPlaceholder: 'e.g. A 6-slide investor deck for our Series A fundraise with financial charts…',
    assistSuggestions: [
      'A corporate quarterly earnings presentation with animated bar charts',
      'A 5-slide product roadmap deck with timeline animations',
      'An investor pitch with market size charts and growth projections',
      'A team onboarding presentation with step-by-step animations',
      'A competitive analysis slide with animated comparison tables',
    ],
    quickFields: [
      { id: 'topic', label: 'Presentation topic', type: 'textarea', placeholder: 'What is your presentation about? Who is the audience?' },
      { id: 'slides', label: 'Number of slides', type: 'radio', options: [{ value: '4', label: '4 slides' }, { value: '6', label: '6 slides' }, { value: '8', label: '8 slides' }, { value: '12', label: '12 slides' }], defaultValue: '6' },
      { id: 'style', label: 'Visual style', type: 'radio', options: [{ value: 'corporate', label: 'Corporate' }, { value: 'minimal', label: 'Minimal' }, { value: 'bold', label: 'Bold' }, { value: 'creative', label: 'Creative' }], defaultValue: 'corporate' },
    ],
  },
  'text-motion': {
    id: 'text-motion',
    title: 'Visual Text Motion',
    subtitle: 'Bring text to life with expressive animations',
    description: 'Cinematic animated text sequences — titles, quotes, lower thirds, and kinetic typography.',
    palette: PALETTES.sunset,
    aspect: '9:16',
    durationSec: 15,
    transition: 'fade',
    promptPlaceholder: 'e.g. Animated title sequence for "Inspire" with typewriter effect on dark background…',
    assistSuggestions: [
      'Typewriter animation revealing "Inspire" on a moody dark background',
      'Kinetic typography for a product launch announcement',
      'Animated quote card with staggered word reveal',
      'Bold title card with glitch effect for a tech brand',
      'Minimal word-by-word fade for a motivational message',
    ],
    quickFields: [
      { id: 'text', label: 'Your text or message', type: 'textarea', placeholder: 'Enter the text you want to animate — a headline, quote, or message…' },
      { id: 'animation', label: 'Animation style', type: 'radio', options: [{ value: 'typewriter', label: 'Typewriter' }, { value: 'kinetic', label: 'Kinetic' }, { value: 'fade', label: 'Word Fade' }, { value: 'glitch', label: 'Glitch' }], defaultValue: 'typewriter' },
      { id: 'background', label: 'Background', type: 'radio', options: [{ value: 'dark', label: 'Dark' }, { value: 'gradient', label: 'Gradient' }, { value: 'photo', label: 'Photo' }, { value: 'minimal', label: 'Minimal' }], defaultValue: 'dark' },
    ],
  },
  infographics: {
    id: 'infographics',
    title: 'Animated Infographic',
    subtitle: 'Data and visuals that tell a story',
    description: 'Animated charts, stats, timelines, and data visualizations that engage and inform.',
    palette: PALETTES.ocean,
    aspect: '16:9',
    durationSec: 20,
    transition: 'wipe',
    promptPlaceholder: 'e.g. Animated bar chart showing quarterly revenue growth with 3D pie chart for market share…',
    assistSuggestions: [
      'Animated bar chart comparing Q1–Q4 revenue with growth arrows',
      'World map with animated data points showing global reach',
      'Step-by-step process diagram with numbered animations',
      'Timeline infographic for company milestones 2020–2024',
      'Animated pie chart with percentage callouts for market data',
    ],
    quickFields: [
      { id: 'data', label: 'Data / content to visualize', type: 'textarea', placeholder: 'Paste your data, stats, or describe what you want to visualize…' },
      { id: 'chartType', label: 'Primary chart type', type: 'radio', options: [{ value: 'bar', label: 'Bar Chart' }, { value: 'pie', label: 'Pie Chart' }, { value: 'timeline', label: 'Timeline' }, { value: 'map', label: 'Map' }], defaultValue: 'bar' },
      { id: 'tone', label: 'Tone', type: 'radio', options: [{ value: 'corporate', label: 'Corporate' }, { value: 'editorial', label: 'Editorial' }, { value: 'playful', label: 'Playful' }], defaultValue: 'corporate' },
    ],
  },
  posters: {
    id: 'posters',
    title: 'Animated Poster',
    subtitle: 'Effortlessly create posters for your brand',
    description: 'Eye-catching animated posters, social cards, and promotional visuals.',
    palette: PALETTES.rose,
    aspect: '9:16',
    durationSec: 10,
    transition: 'zoom',
    promptPlaceholder: 'e.g. A vibrant event poster for a music festival with animated neon elements…',
    assistSuggestions: [
      'Neon-accented event poster with animated glow effects',
      'Minimal product showcase poster with floating elements',
      'Bold typographic poster for a fashion brand launch',
      'Seasonal sale poster with confetti and price animations',
      'Music release poster with waveform visualizer and album art',
    ],
    quickFields: [
      { id: 'purpose', label: 'Poster purpose', type: 'text', placeholder: 'e.g. Event promotion, product launch, sale announcement…' },
      { id: 'style', label: 'Visual style', type: 'radio', options: [{ value: 'bold', label: 'Bold' }, { value: 'minimal', label: 'Minimal' }, { value: 'neon', label: 'Neon' }, { value: 'editorial', label: 'Editorial' }], defaultValue: 'bold' },
      { id: 'format', label: 'Format', type: 'radio', options: [{ value: '9:16', label: 'Portrait (9:16)' }, { value: '1:1', label: 'Square (1:1)' }, { value: '16:9', label: 'Landscape (16:9)' }], defaultValue: '9:16' },
    ],
  },
  'create-new': {
    id: 'create-new',
    title: 'Create from Scratch',
    subtitle: 'Build any motion video you want',
    description: 'Full creative control — custom prompt, format, engine, and timeline.',
    palette: PALETTES.lime,
    aspect: '16:9',
    durationSec: 30,
    transition: 'fade',
    promptPlaceholder: 'Describe the video you want to create…',
    assistSuggestions: [
      'A 30-second brand story video with cinematic transitions',
      'A social media ad with product highlights and a CTA',
      'An explainer video breaking down a complex concept',
      'A motion logo reveal with particle effects',
      'A customer testimonial video with animated quote cards',
    ],
    quickFields: [
      { id: 'prompt', label: 'Describe your video', type: 'textarea', placeholder: 'What do you want to create?' },
    ],
  },
}

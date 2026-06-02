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

// ── Seed templates ──────────────────────────────────────────────────────────
export const TEMPLATES: StudioTemplate[] = [
  {
    id: 'saas-explainer',
    name: 'SaaS Explainer',
    description: 'Feature walkthrough with screenshot overlays and animated cards',
    category: 'SaaS',
    tags: ['feature', 'walkthrough', 'cards'],
    durationSec: 30,
    aspect: '16:9',
    model: 'standard',
    isNew: true,
    config: { aspect: '16:9', durationSec: 30, model: 'standard', palette: PALETTES.violet, transition: 'fade' },
    seed: seed('hero', PALETTES.violet, 'Ship *faster*', ['The all-in-one workspace', 'New']),
  },
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'Hero image with floating specs and CTA',
    category: 'Product',
    tags: ['launch', 'hero', 'specs'],
    durationSec: 20,
    aspect: '16:9',
    model: 'pro',
    config: { aspect: '16:9', durationSec: 20, model: 'pro', palette: PALETTES.ocean, transition: 'slide' },
    seed: seed('showcase', PALETTES.ocean, 'Meet the new flagship', ['Lightning fast', 'All-day battery', 'Built to last']),
  },
  {
    id: 'founder-story',
    name: 'Founder Story',
    description: 'Talking-head overlay with subtitle cards and b-roll',
    category: 'Brand',
    tags: ['story', 'subtitles', 'b-roll'],
    durationSec: 45,
    aspect: '16:9',
    model: 'pro',
    config: { aspect: '16:9', durationSec: 45, model: 'pro', palette: PALETTES.rose, transition: 'fade' },
    seed: seed('split', PALETTES.rose, 'It started with a problem', ['Our mission']),
  },
  {
    id: 'social-ad',
    name: 'Social Ad',
    description: 'Bold text-on-video with branding elements',
    category: 'Social',
    tags: ['ad', '9:16', 'bold'],
    durationSec: 15,
    aspect: '9:16',
    model: 'standard',
    isNew: true,
    config: { aspect: '9:16', durationSec: 15, model: 'standard', palette: PALETTES.sunset, transition: 'zoom' },
    seed: seed('hero', PALETTES.sunset, 'Summer *sale*', ['Up to 50% off', 'Limited']),
  },
  {
    id: 'motion-intro',
    name: 'Motion Intro',
    description: 'Logo reveal with 3D rotation and particle background',
    category: 'Motion',
    tags: ['logo', '3d', 'intro'],
    durationSec: 8,
    aspect: '16:9',
    model: 'cinema',
    config: { aspect: '16:9', durationSec: 8, model: 'cinema', palette: PALETTES.violet, transition: 'zoom' },
    seed: seed('logo', PALETTES.violet, 'Motion', ['Powered by Kinetic']),
  },
  {
    id: 'brand-showcase',
    name: 'Brand Showcase',
    description: 'Website screenshot to animated brand showcase',
    category: 'Brand',
    tags: ['brand', 'square', 'palette'],
    durationSec: 12,
    aspect: '1:1',
    model: 'pro',
    config: { aspect: '1:1', durationSec: 12, model: 'pro', palette: PALETTES.lime, transition: 'wipe' },
    seed: seed('globe', PALETTES.lime, 'The world is the workspace', []),
  },
  {
    id: 'app-showcase',
    name: 'App Showcase',
    description: 'Phone mockup with screen recording overlay',
    category: 'Product',
    tags: ['app', '9:16', 'mockup'],
    durationSec: 25,
    aspect: '9:16',
    model: 'standard',
    config: { aspect: '9:16', durationSec: 25, model: 'standard', palette: PALETTES.ocean, transition: 'slide' },
    seed: seed('showcase', PALETTES.ocean, 'Your day, organized', ['Tasks', 'Focus', 'Flow']),
  },
  {
    id: 'event-announcement',
    name: 'Event Announcement',
    description: 'Countdown + card animation with date and venue',
    category: 'Explainer',
    tags: ['event', 'countdown', 'cards'],
    durationSec: 18,
    aspect: '16:9',
    model: 'standard',
    config: { aspect: '16:9', durationSec: 18, model: 'standard', palette: PALETTES.rose, transition: 'fade' },
    seed: seed('cards', PALETTES.rose, 'You are invited', ['March 14', 'San Francisco', 'RSVP now']),
  },
]

export const TEMPLATE_CATEGORIES = ['All', 'SaaS', 'Product', 'Brand', 'Social', 'Motion', 'Explainer'] as const

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

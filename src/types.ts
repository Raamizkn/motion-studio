// ── Core domain types for Motion Studio ──────────────────────────────────

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5'
export type ModelTier = 'standard' | 'pro' | 'cinema'
export type TransitionKind = 'cut' | 'fade' | 'slide' | 'wipe' | 'zoom'
export type ProjectStatus =
  | 'setup'
  | 'storyboard_ready'
  | 'composing'
  | 'rendering'
  | 'complete'
  | 'error'

/** Optional AI-generated voiceover/narration config. */
export interface VoiceoverConfig {
  enabled: boolean
  /** voice persona, e.g. 'warm', 'energetic', 'calm-narrator' */
  style?: string
  /** the spoken script — authored by Claude or the user */
  script?: string
}

export interface BrandData {
  title: string
  description: string
  colors: string[]
  screenshot?: string // gradient css used as a stand-in screenshot
}

export interface VideoProjectConfig {
  prompt: string
  websiteUrl?: string
  brand?: BrandData
  model: ModelTier
  aspect: AspectRatio
  durationSec: number
  fps: 24 | 30 | 60
  quality: 'draft' | 'standard' | 'high' | 'cinema'
  transition: TransitionKind
  palette: string[]
  templateId?: string
  assetIds: string[]
  assets?: UploadedAsset[]
  /** id of the VibeTheme (brand design system) Claude composes from */
  themeId?: string
  /** AI voiceover/narration request */
  voiceover?: VoiceoverConfig
  /** which Vibe Motion flow created this project */
  flow?: string
}

export type SceneKind =
  | 'hero'
  | 'cards'
  | 'quote'
  | 'cta'
  | 'logo'
  | 'showcase'
  | 'globe'
  | 'split'

export interface StoryboardFrame {
  id: string
  index: number
  start: number
  end: number
  kind: SceneKind
  title: string
  copy: string[]
  notes: string
  transition: TransitionKind
  assetIds: string[]
  /** seed params for the live animated HTML preview */
  seed: SceneSeed
}

export interface SceneSeed {
  kind: SceneKind
  palette: string[]
  headline: string
  lines: string[]
  accent: string
}

// ── Editable scene graph ────────────────────────────────────────────────────
// Every scene is HTML; these are its directly-editable parts on the canvas.
export type SceneElementType = 'text' | 'shape' | 'image' | 'graphic'
export type GraphicKind = 'globe' | 'ring' | 'frame' | 'bars'

export interface SceneElement {
  id: string
  role: string // human label shown in layers / "Editing:" — e.g. "Headline"
  type: SceneElementType
  text?: string
  src?: string
  graphic?: GraphicKind
  x: number // center %, 0–100
  y: number
  w: number // width %
  h?: number // height % (shapes/graphics; text is auto)
  rotation: number
  opacity: number
  // text
  fontSize?: number
  fontFamily?: string
  color?: string
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  // shape
  bg?: string
  radius?: number
  border?: string
  glass?: boolean
  anim?: string // entrance animation key
}

export interface EditorScene {
  id: string
  index: number
  start: number
  end: number
  kind: SceneKind
  palette: string[]
  name: string
  elements: SceneElement[]
}

export interface VideoProject {
  id: string
  name: string
  status: ProjectStatus
  config: VideoProjectConfig
  frames: StoryboardFrame[]
  createdAt: number
  updatedAt: number
  thumbnail?: SceneSeed
  /** full Claude-authored Hyperframes composition (the actual render source) */
  composedHtml?: string
  /** one-line summary of what Claude composed */
  composeSummary?: string
  /** generated narration audio (served from /renders/audio/...) */
  narrationUrl?: string
  /** the spoken narration script, with rough per-line timing */
  narrationScript?: NarrationLine[]
  /** measured length of the narration audio in seconds */
  narrationDuration?: number
  /** voice persona used for the current narration */
  narrationVoice?: string
}

export interface NarrationLine {
  /** approximate start time in seconds */
  t: number
  text: string
}

export interface StudioTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  tags: string[]
  durationSec: number
  aspect: AspectRatio
  model: ModelTier
  isNew?: boolean
  config: Partial<VideoProjectConfig>
  seed: SceneSeed
  /** rich brief handed to Claude when this template is used (drives compose) */
  brief?: string
  /** built-in theme this template composes with */
  themeId?: string
  /** visual register — also drives the template card's preview style */
  register?: 'editorial' | 'product' | 'bold' | 'minimal'
}

export type TemplateCategory =
  | 'SaaS'
  | 'Product'
  | 'Brand'
  | 'Social'
  | 'Motion'
  | 'Explainer'

// ── Editor types ─────────────────────────────────────────────────────────

export type LayerGroup = 'video' | 'overlays' | 'audio' | 'captions'

export interface EditorLayer {
  id: string
  group: LayerGroup
  name: string
  visible: boolean
  locked: boolean
}

export type OverlayKind = 'text' | 'image' | 'card' | 'logo'

export interface OverlayElement {
  id: string
  sceneId: string // which scene/clip it belongs to
  kind: OverlayKind
  text?: string
  src?: string // data URL for image/logo overlays
  x: number // % of canvas
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  fontSize?: number
  fontFamily?: string
  color?: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  italic?: boolean
  animation?: string
}

export interface UploadedAsset {
  id: string
  name: string
  type: string // mime
  dataUrl: string
}

export interface TimelineClip {
  id: string
  track: number
  group: LayerGroup
  name: string
  start: number
  duration: number
  color: string
  transition?: TransitionKind
  seed?: SceneSeed
}

export interface EditorState {
  clips: TimelineClip[]
  layers: EditorLayer[]
  overlays: OverlayElement[]
  scenes: EditorScene[]
  duration: number
  selectedId: string | null // element id (scene element or overlay)
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  toolCalls?: { tool: string; summary: string }[]
}

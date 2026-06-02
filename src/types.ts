// ── Core domain types for Motion Studio ──────────────────────────────────

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5'
export type ModelTier = 'standard' | 'pro' | 'cinema'
export type TransitionKind = 'cut' | 'fade' | 'slide' | 'wipe' | 'zoom'
export type ProjectStatus =
  | 'setup'
  | 'storyboard_ready'
  | 'rendering'
  | 'complete'
  | 'error'

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

export interface VideoProject {
  id: string
  name: string
  status: ProjectStatus
  config: VideoProjectConfig
  frames: StoryboardFrame[]
  createdAt: number
  updatedAt: number
  thumbnail?: SceneSeed
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
  x: number // % of canvas
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  fontSize?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  italic?: boolean
  animation?: string
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
  duration: number
  selectedId: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  text: string
  toolCalls?: { tool: string; summary: string }[]
}

// ── GenSpec: the single source of truth for the Storyboard-Grid engine ──────
//
// The whole pipeline compiles structured inputs into ONE GenSpec object, then
// derives grid geometry, a mega-prompt, frame slices and a video plan from it.
// Stages A–C (compile → geometry → prompt) are pure, deterministic client
// functions; stages D–F (grid image → split → video) go through the stub
// server plugin today and swap to real models later without touching this type.

import { fitBeatsToN } from './engine/sceneGrammars'
import { computeGrid } from './engine/gridGeometry'

export type UseCase =
  | 'saas_explainer'
  | 'physical_ad'
  | 'pitch'
  | 'app_launch'
  | 'brand_manifesto'

export type GridAspect = '16:9' | '9:16' | '1:1'
export type Pacing = 'even' | 'accelerate' | 'hero_weighted'
export type ClipJoin = 'interpolate' | 'cut'

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export interface BrandKit {
  titleFont: string
  bodyFont: string
  colors: { surface: string; primary: string; secondary: string; accent?: string }
  tone: string
  logoText?: string
  logoDataUrl?: string
  register?: string
}

export interface ProductRef {
  assetIds: string[]
  images: { id: string; name: string; dataUrl: string }[]
  description?: string
}

export interface CanvasSpec {
  aspect: GridAspect
  width: number
  height: number
  durationSec: number
  frameCount: number
}

export interface VisualStyle {
  templateId: string
  treatment: string
  pacing: Pacing
  transitions: ClipJoin[]
  notes?: string
}

export interface FrameSlice {
  id: string
  index: number
  beat: string
  role: string
  sceneDesc: string
  productPose: string
  copyText: string
  textZone: 'none' | 'top' | 'bottom' | 'left' | 'right'
  cell?: { col: number; row: number; box: BBox }
  stub?: { register: string; kicker: string; title: string }
}

export interface VideoClipGroup {
  id: string
  frameIds: string[]
  join: ClipJoin
  start: number
  duration: number
}

export interface VideoPlan {
  model: 'seedance' | 'kling'
  mode: 'keyframe' | 'single'
  clips: VideoClipGroup[]
  segmentSeconds: number[]
  totalDuration: number
}

export interface GenSpec {
  version: 1
  useCase: UseCase
  brand: BrandKit
  product: ProductRef
  canvas: CanvasSpec
  style: VisualStyle
  frames: FrameSlice[]
  video: VideoPlan | null
}

// ── Use-case catalog (drives scene grammar + suggested style/model) ─────────
export interface UseCaseDef {
  id: UseCase
  title: string
  blurb: string
  register: string
  suggestedTemplateId: string
  suggestedTreatment: string
  suggestedPacing: Pacing
  suggestedAspect: GridAspect
  model: 'seedance' | 'kling'
  icon: string
}

export const USE_CASES: UseCaseDef[] = [
  {
    id: 'saas_explainer',
    title: 'SaaS Explainer',
    blurb: 'Walk through a product UI — feature beats, glass cards, confident tech motion.',
    register: 'product',
    suggestedTemplateId: 'saas-explainer',
    suggestedTreatment: 'Dark cinematic UI walkthrough, glass cards, accent glow',
    suggestedPacing: 'even',
    suggestedAspect: '16:9',
    model: 'kling',
    icon: 'sparkle',
  },
  {
    id: 'physical_ad',
    title: 'Physical Product Ad',
    blurb: 'Hero a real product — dramatic poses, lighting, lifestyle and a punchy CTA.',
    register: 'poster',
    suggestedTemplateId: 'product-launch',
    suggestedTreatment: 'Studio-lit hero product with dramatic poses and depth',
    suggestedPacing: 'hero_weighted',
    suggestedAspect: '9:16',
    model: 'seedance',
    icon: 'image',
  },
  {
    id: 'pitch',
    title: 'Pitch / Deck',
    blurb: 'Problem → solution → traction → ask. Clean slide grammar with a single accent.',
    register: 'presentation',
    suggestedTemplateId: 'pitch-deck',
    suggestedTreatment: 'Clean presentation slides, consistent grid, one accent',
    suggestedPacing: 'even',
    suggestedAspect: '16:9',
    model: 'kling',
    icon: 'apps',
  },
  {
    id: 'app_launch',
    title: 'App Launch',
    blurb: 'Show the app in motion — screen swaps, captions, a hero stat and a download CTA.',
    register: 'product',
    suggestedTemplateId: 'app-showcase',
    suggestedTreatment: 'Phone frame, screen swaps, floating captions, soft glow',
    suggestedPacing: 'accelerate',
    suggestedAspect: '9:16',
    model: 'kling',
    icon: 'play',
  },
  {
    id: 'brand_manifesto',
    title: 'Brand Manifesto',
    blurb: 'A bold statement film — oversized type, kinetic words, one big idea.',
    register: 'bold',
    suggestedTemplateId: 'quote-poster',
    suggestedTreatment: 'Oversized kinetic type, color-blocking, statement-led',
    suggestedPacing: 'hero_weighted',
    suggestedAspect: '1:1',
    model: 'seedance',
    icon: 'type',
  },
]

export function useCaseDef(useCase: UseCase): UseCaseDef {
  return USE_CASES.find((u) => u.id === useCase) || USE_CASES[0]
}

// Final-render dimensions per aspect (the video output, not the grid cells).
const CANVAS_DIMS: Record<GridAspect, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
}

// ── Stage A: compile structured inputs into a GenSpec ───────────────────────
export interface CompileInputs {
  useCase: UseCase
  brand: BrandKit
  product: ProductRef
  aspect: GridAspect
  durationSec: number
  frameCount: number
  style: Pick<VisualStyle, 'templateId' | 'treatment' | 'pacing' | 'transitions' | 'notes'>
}

export function compileSpec(inputs: CompileInputs): GenSpec {
  const dims = CANVAS_DIMS[inputs.aspect]
  const canvas: CanvasSpec = {
    aspect: inputs.aspect,
    width: dims.w,
    height: dims.h,
    durationSec: inputs.durationSec,
    frameCount: Math.max(1, Math.floor(inputs.frameCount)),
  }

  // Stage B geometry → attach each beat to its cell.
  const grid = computeGrid(canvas.frameCount, canvas.aspect)
  // Scene grammar → beats fitted to N.
  const frames = fitBeatsToN(inputs.useCase, canvas.frameCount, inputs.brand).map((f, i) => {
    const cell = grid.cells[i]
    const col = i % grid.cols
    const row = Math.floor(i / grid.cols)
    // Deterministic id by position so per-frame nonces stay stable as the wizard
    // recompiles the spec on every input change.
    return {
      ...f,
      id: `frame_${i}`,
      index: i,
      cell: cell ? { col, row, box: cell } : undefined,
    }
  })

  return {
    version: 1,
    useCase: inputs.useCase,
    brand: inputs.brand,
    product: inputs.product,
    canvas,
    style: { ...inputs.style },
    frames,
    video: null,
  }
}

export function defaultBrand(): BrandKit {
  return {
    titleFont: 'Outfit',
    bodyFont: 'Inter',
    colors: { surface: '#0a0a0c', primary: '#ffffff', secondary: '#8a3ffc', accent: '#4e7bff' },
    tone: 'modern product / tech',
    register: 'modern product / tech',
  }
}

export function defaultSpec(useCase: UseCase = 'saas_explainer'): GenSpec {
  const def = useCaseDef(useCase)
  return compileSpec({
    useCase,
    brand: defaultBrand(),
    product: { assetIds: [], images: [] },
    aspect: def.suggestedAspect,
    durationSec: 15,
    frameCount: 9,
    style: {
      templateId: def.suggestedTemplateId,
      treatment: def.suggestedTreatment,
      pacing: def.suggestedPacing,
      transitions: [],
      notes: '',
    },
  })
}

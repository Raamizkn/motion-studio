// ── Stub engine ─────────────────────────────────────────────────────────────
// Deterministic, seeded stand-ins for the model-backed stages (D: grid image,
// E: split, F: video plan). Everything is derived from hash(spec)+nonces so the
// same inputs always produce the same "generated" output (no Math.random at
// render time). Frame visuals are rendered client-side by TemplatePreview, so
// stubFrameVisual just returns its props. When real models are wired, these
// functions stay as the offline fallback / preview path.

import type { GenSpec, FrameSlice, BrandKit, VideoPlan, VideoClipGroup, Pacing } from '../spec'
import { useCaseDef } from '../spec'

// Stable 32-bit string hash (FNV-1a-ish).
export function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function seedFromSpec(spec: GenSpec, nonce = 0): number {
  const key = JSON.stringify({
    u: spec.useCase,
    c: spec.brand.colors,
    t: spec.style.treatment,
    n: spec.canvas.frameCount,
    a: spec.canvas.aspect,
    f: spec.frames.map((f) => f.beat),
  })
  return hashStr(`${key}#${nonce}`)
}

// Small deterministic PRNG (mulberry32) seeded by an integer.
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ASPECT_NUM: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 }

type PReg = 'editorial' | 'product' | 'bold' | 'minimal' | 'infographic' | 'poster' | 'presentation'

export interface FrameVisual {
  register: PReg
  palette: string[]
  title: string
  kicker: string
  ratio: number
}

// Build the palette TemplatePreview expects [accentA, accentB, surface], rotated
// slightly per-frame from the seed so panels read as distinct frames of one film.
function framePalette(brand: BrandKit, seed: number): string[] {
  const c = brand.colors
  const pool = [c.secondary, c.accent || c.primary, c.primary, c.surface].filter(Boolean) as string[]
  const r = rng(seed)
  // keep the two lead colours stable-ish but allow a deterministic swap for variety
  const swap = r() > 0.6
  const a = swap ? pool[1] || pool[0] : pool[0]
  const b = swap ? pool[0] : pool[1] || pool[0]
  return [a, b, c.surface]
}

/**
 * Stage E stub — per-frame visual props for TemplatePreview.
 * frameNonce lets a single frame be "regenerated" without disturbing the others.
 */
export function stubFrameVisual(
  slice: FrameSlice,
  brand: BrandKit,
  spec: GenSpec,
  gridNonce = 0,
  frameNonce = 0,
): FrameVisual {
  const seed = seedFromSpec(spec, gridNonce) ^ hashStr(`${slice.id}#${frameNonce}`)
  const register = (slice.stub?.register as PReg) || 'product'
  return {
    register,
    palette: framePalette(brand, seed),
    title: slice.stub?.title || slice.copyText || slice.role,
    kicker: slice.stub?.kicker || '',
    ratio: ASPECT_NUM[spec.canvas.aspect] || 16 / 9,
  }
}

// ── Stage F stub — the video plan (model routing + clip grouping + timing) ──

function pacingWeights(pacing: Pacing, n: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [1]
  const w: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) // 0..1
    if (pacing === 'accelerate') {
      w.push(1.6 - 0.9 * t) // earlier beats hold longer, pace quickens toward the end
    } else if (pacing === 'hero_weighted') {
      // first and last clips heaviest (the hero beats), middle lighter
      const edge = Math.min(i, n - 1 - i) / ((n - 1) / 2 || 1) // 0 at edges, 1 in middle
      w.push(1.6 - 0.7 * edge)
    } else {
      w.push(1) // even
    }
  }
  return w
}

function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const raw = weights.map((w) => (w / sum) * total)
  // round to 1 decimal, push remainder onto the last segment so it sums exactly
  const rounded = raw.map((x) => Math.round(x * 10) / 10)
  const drift = Math.round((total - rounded.reduce((a, b) => a + b, 0)) * 10) / 10
  if (rounded.length) rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + drift) * 10) / 10
  return rounded
}

let _cid = 0
const cid = () => `clip_${(_cid++).toString(36)}`

export function stubVideoPlan(spec: GenSpec): VideoPlan {
  const def = useCaseDef(spec.useCase)
  const model = def.model // saas/pitch/app → kling; physical_ad/brand → seedance
  const mode: VideoPlan['mode'] = model === 'kling' ? 'keyframe' : 'single'
  const frames = spec.frames
  const total = spec.canvas.durationSec

  const clips: VideoClipGroup[] = []
  if (mode === 'keyframe' && frames.length >= 2) {
    // interpolate between adjacent keyframes → N-1 morph clips
    for (let i = 0; i < frames.length - 1; i++) {
      clips.push({ id: cid(), frameIds: [frames[i].id, frames[i + 1].id], join: 'interpolate', start: 0, duration: 0 })
    }
  } else {
    // single: each frame becomes its own hard-cut clip
    for (const f of frames) clips.push({ id: cid(), frameIds: [f.id], join: 'cut', start: 0, duration: 0 })
  }

  const segs = distribute(total, pacingWeights(spec.style.pacing, clips.length))
  let t = 0
  clips.forEach((c, i) => {
    c.start = Math.round(t * 10) / 10
    c.duration = segs[i] ?? 0
    t += c.duration
  })

  return { model, mode, clips, segmentSeconds: segs, totalDuration: total }
}

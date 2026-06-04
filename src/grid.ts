// ── Client-side stub for the Storyboard-Grid engine ─────────────────────────
// IMPORTANT: this runs ENTIRELY in the browser — no server, no fetch — so it
// works identically in local dev and on static hosts (Vercel). The phased
// progress is driven by a timer; the "model" outputs (grid image + split
// frames + video) are rendered client-side (TemplatePreview), so there is
// nothing to fetch. When real models are wired, swap these functions to call
// a serverless endpoint (e.g. /api Vercel function) — callers never change.

import type { GenSpec, VideoPlan } from './spec'

export type GridKind = 'image' | 'video'

export interface GridStatus {
  status: 'rendering' | 'complete' | 'error' | 'unknown'
  progress: number
  stage: string
  url: string | null
  error: string | null
}

// Phase labels — shared with the modal's PhasedProgress so the stepper matches.
export const IMAGE_PHASES = ['Computing grid geometry', 'Assembling mega-prompt', 'Generating storyboard', 'Receiving split frames']
export const VIDEO_PHASES = ['Routing video model', 'Planning clip segments', 'Synthesising clips', 'Stitching timeline']

// Stage D — no-op in the stub (frames render client-side). Returns the job id.
export async function startGridImage(id: string, _spec: GenSpec): Promise<string> {
  void _spec
  return id
}

// Stage F — no-op in the stub. The editor plays the storyboard client-side.
export async function startGridVideo(id: string, _spec: GenSpec, _plan: VideoPlan): Promise<string> {
  void _spec; void _plan
  return id
}

export async function getGridStatus(_id: string, _kind: GridKind): Promise<GridStatus> {
  return { status: 'complete', progress: 100, stage: 'Complete', url: null, error: null }
}

// Drive a job through its phases on a timer, then complete. Pure client-side.
export function pollGrid(_id: string, kind: GridKind, onTick: (s: GridStatus) => void): () => void {
  const phases = kind === 'image' ? IMAGE_PHASES : VIDEO_PHASES
  const steps = phases.length * 3
  let stopped = false
  let i = 0
  const tick = () => {
    if (stopped) return
    i++
    const pct = Math.min(99, Math.round((i / steps) * 100))
    const phaseIdx = Math.min(phases.length - 1, Math.floor((pct / 100) * phases.length))
    onTick({ status: 'rendering', progress: pct, stage: phases[phaseIdx], url: null, error: null })
    if (i >= steps) {
      onTick({ status: 'complete', progress: 100, stage: 'Complete', url: null, error: null })
      return
    }
    setTimeout(tick, 200)
  }
  setTimeout(tick, 200)
  return () => { stopped = true }
}

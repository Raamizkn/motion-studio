// ── Client bridge for the Storyboard-Grid engine ────────────────────────────
// Mirrors src/render.ts. Today it talks to the stub gridPlugin (/api/grid/*);
// when real models are wired the plugin internals change but this surface — and
// every caller in the modal — stays identical.

import type { GenSpec, VideoPlan } from './spec'
import { computeGrid } from './engine/gridGeometry'

export type GridKind = 'image' | 'video'

export interface GridStatus {
  status: 'rendering' | 'complete' | 'error' | 'unknown'
  progress: number
  stage: string
  url: string | null
  error: string | null
}

/** Stage D — kick off the single grid image. Returns the job id (= project id). */
export async function startGridImage(id: string, spec: GenSpec): Promise<string> {
  const grid = computeGrid(spec.canvas.frameCount, spec.canvas.aspect)
  const res = await fetch('/api/grid/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, spec, grid }),
  })
  if (!res.ok) throw new Error(`Grid image failed to start (${res.status})`)
  return id
}

/** Stage F — kick off the video from the plan. Returns the job id (= project id). */
export async function startGridVideo(id: string, spec: GenSpec, plan: VideoPlan): Promise<string> {
  const res = await fetch('/api/grid/video', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, plan, spec }),
  })
  if (!res.ok) throw new Error(`Grid video failed to start (${res.status})`)
  return id
}

export async function getGridStatus(id: string, kind: GridKind): Promise<GridStatus> {
  const res = await fetch(`/api/grid/status?id=${encodeURIComponent(id)}&kind=${kind}`)
  if (!res.ok) return { status: 'unknown', progress: 0, stage: '', url: null, error: null }
  return res.json()
}

/** Poll until complete/error. Calls onTick with each status. Returns a stopper. */
export function pollGrid(id: string, kind: GridKind, onTick: (s: GridStatus) => void): () => void {
  let stop = false
  const loop = async () => {
    while (!stop) {
      const s = await getGridStatus(id, kind)
      onTick(s)
      if (s.status === 'complete' || s.status === 'error' || s.status === 'unknown') break
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  loop()
  return () => {
    stop = true
  }
}

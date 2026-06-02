import type { VideoProject } from './types'
import { buildCompositionFromScenes } from './composition'
import { useStore } from './store'
import { buildEditorState } from './data'

export interface RenderStatus {
  status: 'rendering' | 'complete' | 'error' | 'unknown'
  progress: number
  stage: string
  url: string | null
  error: string | null
}

/** Kick off a real Kinetic render on the backend. Returns the job id. */
export async function startRender(project: VideoProject): Promise<string> {
  // render the exact scene graph the editor canvas shows (elements + overlays)
  const editor = useStore.getState().editors[project.id] || buildEditorState(project.frames, project.config)
  const { html, meta } = buildCompositionFromScenes(editor.scenes, project.config, project.name, editor.overlays)
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: project.id, html, meta }),
  })
  if (!res.ok) throw new Error(`Render failed to start (${res.status})`)
  return project.id
}

export async function getRenderStatus(id: string): Promise<RenderStatus> {
  const res = await fetch(`/api/render/status?id=${encodeURIComponent(id)}`)
  if (!res.ok) return { status: 'unknown', progress: 0, stage: '', url: null, error: null }
  return res.json()
}

/** Poll until complete/error. Calls onTick with each status. */
export function pollRender(id: string, onTick: (s: RenderStatus) => void): () => void {
  let stop = false
  const loop = async () => {
    while (!stop) {
      const s = await getRenderStatus(id)
      onTick(s)
      if (s.status === 'complete' || s.status === 'error' || s.status === 'unknown') break
      await new Promise((r) => setTimeout(r, 900))
    }
  }
  loop()
  return () => {
    stop = true
  }
}

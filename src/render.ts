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

const DIMS: Record<string, { w: number; h: number }> = {
  '16:9': { w: 1920, h: 1080 },
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
}

/** Kick off a real Kinetic render on the backend. Returns the job id. */
export async function startRender(project: VideoProject): Promise<string> {
  let html: string
  let meta: { id: string; name: string; duration: number; fps: number; width: number; height: number }

  if (project.composedHtml) {
    // Claude authored a full Hyperframes composition — render it verbatim.
    const dim = DIMS[project.config.aspect] || DIMS['16:9']
    html = project.composedHtml
    meta = {
      id: 'main',
      name: project.name,
      duration: project.config.durationSec,
      fps: project.config.fps,
      width: dim.w,
      height: dim.h,
    }
  } else {
    // legacy: render the scene graph the editor canvas shows (elements + overlays)
    const editor = useStore.getState().editors[project.id] || buildEditorState(project.frames, project.config)
    ;({ html, meta } = buildCompositionFromScenes(editor.scenes, project.config, project.name, editor.overlays))
  }

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

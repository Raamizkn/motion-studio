import { create } from 'zustand'
import type {
  VideoProject,
  VideoProjectConfig,
  StoryboardFrame,
  EditorState,
  OverlayElement,
  TimelineClip,
} from './types'
import { generateStoryboard, buildEditorState, uid } from './data'

const LS_KEY = 'motion-studio/projects/v1'

function load(): VideoProject[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}
function persist(projects: VideoProject[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(projects))
  } catch {
    /* ignore quota */
  }
}

interface Store {
  projects: VideoProject[]
  editors: Record<string, EditorState>
  // undo/redo stacks per project
  history: Record<string, { past: EditorState[]; future: EditorState[] }>

  createProject: (name: string, config: VideoProjectConfig) => VideoProject
  getProject: (id: string) => VideoProject | undefined
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  duplicateProject: (id: string) => void
  setStatus: (id: string, status: VideoProject['status']) => void
  setFrames: (id: string, frames: StoryboardFrame[]) => void
  updateFrame: (id: string, frameId: string, patch: Partial<StoryboardFrame>) => void
  reorderFrames: (id: string, frameIds: string[]) => void
  addFrame: (id: string, afterIndex: number) => void
  deleteFrame: (id: string, frameId: string) => void

  ensureEditor: (id: string) => EditorState
  getEditor: (id: string) => EditorState | undefined
  selectElement: (id: string, elId: string | null) => void
  updateOverlay: (id: string, ovId: string, patch: Partial<OverlayElement>, snapshot?: boolean) => void
  updateClip: (id: string, clipId: string, patch: Partial<TimelineClip>) => void
  toggleLayer: (id: string, layerId: string, key: 'visible' | 'locked') => void
  renameLayer: (id: string, layerId: string, name: string) => void
  moveLayer: (id: string, dragId: string, overId: string) => void
  deleteOverlay: (id: string, ovId: string) => void
  addOverlay: (id: string, ov: Omit<OverlayElement, 'id'>) => string
  snapshot: (id: string) => void
  undo: (id: string) => void
  redo: (id: string) => void
  canUndo: (id: string) => boolean
  canRedo: (id: string) => boolean
}

export const useStore = create<Store>((set, get) => ({
  projects: load(),
  editors: {},
  history: {},

  createProject: (name, config) => {
    const now = Date.now()
    const frames = generateStoryboard(config)
    const project: VideoProject = {
      id: uid('proj'),
      name,
      status: 'storyboard_ready',
      config,
      frames,
      createdAt: now,
      updatedAt: now,
      thumbnail: frames[0]?.seed,
    }
    const projects = [project, ...get().projects]
    persist(projects)
    set({ projects })
    return project
  },

  getProject: (id) => get().projects.find((p) => p.id === id),

  renameProject: (id, name) =>
    set((s) => {
      const projects = s.projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p))
      persist(projects)
      return { projects }
    }),

  deleteProject: (id) =>
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id)
      persist(projects)
      return { projects }
    }),

  duplicateProject: (id) =>
    set((s) => {
      const src = s.projects.find((p) => p.id === id)
      if (!src) return s
      const copy: VideoProject = {
        ...structuredClone(src),
        id: uid('proj'),
        name: `${src.name} copy`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const projects = [copy, ...s.projects]
      persist(projects)
      return { projects }
    }),

  setStatus: (id, status) =>
    set((s) => {
      const projects = s.projects.map((p) => (p.id === id ? { ...p, status, updatedAt: Date.now() } : p))
      persist(projects)
      return { projects }
    }),

  setFrames: (id, frames) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id ? { ...p, frames, thumbnail: frames[0]?.seed, updatedAt: Date.now() } : p,
      )
      persist(projects)
      return { projects }
    }),

  updateFrame: (id, frameId, patch) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id
          ? { ...p, frames: p.frames.map((f) => (f.id === frameId ? { ...f, ...patch } : f)), updatedAt: Date.now() }
          : p,
      )
      persist(projects)
      return { projects }
    }),

  reorderFrames: (id, frameIds) =>
    set((s) => {
      const projects = s.projects.map((p) => {
        if (p.id !== id) return p
        const map = new Map(p.frames.map((f) => [f.id, f]))
        const frames = frameIds.map((fid, i) => ({ ...map.get(fid)!, index: i }))
        return { ...p, frames, updatedAt: Date.now() }
      })
      persist(projects)
      return { projects }
    }),

  addFrame: (id, afterIndex) =>
    set((s) => {
      const projects = s.projects.map((p) => {
        if (p.id !== id) return p
        const base = p.frames[afterIndex] ?? p.frames[p.frames.length - 1]
        const dur = base ? base.end - base.start : 5
        const nf: StoryboardFrame = {
          id: uid('frame'),
          index: afterIndex + 1,
          start: base?.end ?? 0,
          end: (base?.end ?? 0) + dur,
          kind: 'cards',
          title: 'New Scene',
          copy: ['New scene', 'Edit me'],
          notes: 'One glass card per beat — enter, hold, exit.',
          transition: p.config.transition,
          assetIds: [],
          seed: { kind: 'cards', palette: p.config.palette, headline: 'New scene', lines: ['New scene', 'Edit me'], accent: p.config.palette[0] },
        }
        const frames = [...p.frames]
        frames.splice(afterIndex + 1, 0, nf)
        return { ...p, frames: reindex(frames), updatedAt: Date.now() }
      })
      persist(projects)
      return { projects }
    }),

  deleteFrame: (id, frameId) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id ? { ...p, frames: reindex(p.frames.filter((f) => f.id !== frameId)), updatedAt: Date.now() } : p,
      )
      persist(projects)
      return { projects }
    }),

  ensureEditor: (id) => {
    const existing = get().editors[id]
    if (existing) return existing
    const project = get().projects.find((p) => p.id === id)
    const es = project ? buildEditorState(project.frames, project.config) : { clips: [], layers: [], overlays: [], duration: 0, selectedId: null }
    set((s) => ({ editors: { ...s.editors, [id]: es }, history: { ...s.history, [id]: { past: [], future: [] } } }))
    return es
  },

  getEditor: (id) => get().editors[id],

  selectElement: (id, elId) =>
    set((s) => ({ editors: { ...s.editors, [id]: { ...s.editors[id], selectedId: elId } } })),

  updateOverlay: (id, ovId, patch, snapshot) =>
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const next = { ...es, overlays: es.overlays.map((o) => (o.id === ovId ? { ...o, ...patch } : o)) }
      const history = snapshot ? pushHistory(s.history, id, es) : s.history
      return { editors: { ...s.editors, [id]: next }, history }
    }),

  updateClip: (id, clipId, patch) =>
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const next = { ...es, clips: es.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) }
      return { editors: { ...s.editors, [id]: next }, history: pushHistory(s.history, id, es) }
    }),

  toggleLayer: (id, layerId, key) =>
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const next = { ...es, layers: es.layers.map((l) => (l.id === layerId ? { ...l, [key]: !l[key] } : l)) }
      return { editors: { ...s.editors, [id]: next } }
    }),

  renameLayer: (id, layerId, name) =>
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const next = { ...es, layers: es.layers.map((l) => (l.id === layerId ? { ...l, name } : l)) }
      return { editors: { ...s.editors, [id]: next } }
    }),

  moveLayer: (id, dragId, overId) =>
    set((s) => {
      const es = s.editors[id]
      if (!es || dragId === overId) return s
      const drag = es.layers.find((l) => l.id === dragId)
      const over = es.layers.find((l) => l.id === overId)
      if (!drag || !over || drag.group !== over.group) return s // only reorder within a group
      const layers = [...es.layers]
      const from = layers.indexOf(drag)
      layers.splice(from, 1)
      const to = layers.indexOf(over)
      layers.splice(to, 0, drag)
      // keep overlays array order in sync (drives z-index on canvas)
      const ovOrder = layers.filter((l) => l.group === 'overlays').map((l) => l.id)
      const overlays = [...es.overlays].sort((a, b) => ovOrder.indexOf(a.id) - ovOrder.indexOf(b.id))
      return { editors: { ...s.editors, [id]: { ...es, layers, overlays } }, history: pushHistory(s.history, id, es) }
    }),

  deleteOverlay: (id, ovId) =>
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const next = {
        ...es,
        overlays: es.overlays.filter((o) => o.id !== ovId),
        layers: es.layers.filter((l) => l.id !== ovId),
        selectedId: es.selectedId === ovId ? null : es.selectedId,
      }
      return { editors: { ...s.editors, [id]: next }, history: pushHistory(s.history, id, es) }
    }),

  addOverlay: (id, ov) => {
    const newId = uid('ov')
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const overlay: OverlayElement = { ...ov, id: newId }
      const layer = { id: newId, group: 'overlays' as const, name: ov.kind === 'text' ? `Text — ${ov.text}` : `${ov.kind}`, visible: true, locked: false }
      const next = { ...es, overlays: [...es.overlays, overlay], layers: [...es.layers, layer], selectedId: newId }
      return { editors: { ...s.editors, [id]: next }, history: pushHistory(s.history, id, es) }
    })
    return newId
  },

  snapshot: (id) => set((s) => ({ history: pushHistory(s.history, id, s.editors[id]) })),

  undo: (id) =>
    set((s) => {
      const h = s.history[id]
      const es = s.editors[id]
      if (!h?.past.length || !es) return s
      const prev = h.past[h.past.length - 1]
      return {
        editors: { ...s.editors, [id]: prev },
        history: { ...s.history, [id]: { past: h.past.slice(0, -1), future: [es, ...h.future] } },
      }
    }),

  redo: (id) =>
    set((s) => {
      const h = s.history[id]
      const es = s.editors[id]
      if (!h?.future.length || !es) return s
      const next = h.future[0]
      return {
        editors: { ...s.editors, [id]: next },
        history: { ...s.history, [id]: { past: [...h.past, es], future: h.future.slice(1) } },
      }
    }),

  canUndo: (id) => !!get().history[id]?.past.length,
  canRedo: (id) => !!get().history[id]?.future.length,
}))

function reindex(frames: StoryboardFrame[]): StoryboardFrame[] {
  return frames.map((f, i) => ({ ...f, index: i }))
}

function pushHistory(
  history: Record<string, { past: EditorState[]; future: EditorState[] }>,
  id: string,
  es: EditorState | undefined,
) {
  if (!es) return history
  const h = history[id] || { past: [], future: [] }
  return { ...history, [id]: { past: [...h.past, es].slice(-50), future: [] } }
}

import { create } from 'zustand'
import type {
  VideoProject,
  VideoProjectConfig,
  StoryboardFrame,
  EditorState,
  OverlayElement,
  TimelineClip,
  SceneElement,
  NarrationLine,
} from './types'
import type { VibeTheme } from './data'
import { generateStoryboard, buildEditorState, uid } from './data'

const LS_KEY = 'motion-studio/projects/v1'
const THEME_KEY = 'motion-studio/themes/v1'

function loadThemes(): VibeTheme[] {
  try {
    return JSON.parse(localStorage.getItem(THEME_KEY) || '[]')
  } catch {
    return []
  }
}
function persistThemes(themes: VibeTheme[]) {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(themes))
  } catch {
    /* ignore quota */
  }
}

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
  userThemes: VibeTheme[]
  addTheme: (theme: Omit<VibeTheme, 'id' | 'builtin'>) => VibeTheme
  deleteTheme: (id: string) => void
  editors: Record<string, EditorState>
  // undo/redo stacks per project
  history: Record<string, { past: EditorState[]; future: EditorState[] }>

  createProject: (name: string, config: VideoProjectConfig) => VideoProject
  getProject: (id: string) => VideoProject | undefined
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  duplicateProject: (id: string) => void
  setStatus: (id: string, status: VideoProject['status']) => void
  setComposedHtml: (id: string, html: string, summary?: string) => void
  setNarration: (id: string, narration: { url: string; script?: NarrationLine[]; duration?: number; voice?: string } | null) => void
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
  duplicateOverlay: (id: string, ovId: string) => string | null
  addAsset: (id: string, asset: { id: string; name: string; type: string; dataUrl: string }) => void
  updateSceneElement: (id: string, elId: string, patch: Partial<SceneElement>, snapshot?: boolean) => void
  addSceneElement: (id: string, sceneId: string, el: SceneElement) => void
  deleteSceneElement: (id: string, elId: string) => void
  duplicateSceneElement: (id: string, elId: string) => string | null
  reorderSceneElement: (id: string, sceneId: string, dragId: string, overId: string) => void
  snapshot: (id: string) => void
  undo: (id: string) => void
  redo: (id: string) => void
  canUndo: (id: string) => boolean
  canRedo: (id: string) => boolean
}

export const useStore = create<Store>((set, get) => ({
  projects: load(),
  userThemes: loadThemes(),
  editors: {},
  history: {},

  addTheme: (theme) => {
    const created: VibeTheme = { ...theme, id: uid('theme'), builtin: false }
    const userThemes = [created, ...get().userThemes]
    persistThemes(userThemes)
    set({ userThemes })
    return created
  },

  deleteTheme: (id) =>
    set((s) => {
      const userThemes = s.userThemes.filter((t) => t.id !== id)
      persistThemes(userThemes)
      return { userThemes }
    }),

  createProject: (name, config) => {
    const now = Date.now()
    const frames = generateStoryboard(config)
    const project: VideoProject = {
      id: uid('proj'),
      name,
      status: 'setup',
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

  setComposedHtml: (id, html, summary) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id ? { ...p, composedHtml: html, composeSummary: summary ?? p.composeSummary, updatedAt: Date.now() } : p,
      )
      persist(projects)
      return { projects }
    }),

  setNarration: (id, narration) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              narrationUrl: narration?.url,
              narrationScript: narration?.script ?? (narration ? p.narrationScript : undefined),
              narrationDuration: narration?.duration ?? (narration ? p.narrationDuration : undefined),
              narrationVoice: narration?.voice ?? (narration ? p.narrationVoice : undefined),
              updatedAt: Date.now(),
            }
          : p,
      )
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
    const es = project ? buildEditorState(project.frames, project.config) : { clips: [], layers: [], overlays: [], scenes: [], duration: 0, selectedId: null }
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

  duplicateOverlay: (id, ovId) => {
    const newId = uid('ov')
    let ok = false
    set((s) => {
      const es = s.editors[id]
      const src = es?.overlays.find((o) => o.id === ovId)
      if (!es || !src) return s
      ok = true
      const copy: OverlayElement = { ...src, id: newId, x: Math.min(94, src.x + 4), y: Math.min(94, src.y + 4) }
      const layer = { id: newId, group: 'overlays' as const, name: `${es.layers.find((l) => l.id === ovId)?.name || src.kind} copy`, visible: true, locked: false }
      const next = { ...es, overlays: [...es.overlays, copy], layers: [...es.layers, layer], selectedId: newId }
      return { editors: { ...s.editors, [id]: next }, history: pushHistory(s.history, id, es) }
    })
    return ok ? newId : null
  },

  addAsset: (id, asset) =>
    set((s) => {
      const projects = s.projects.map((p) =>
        p.id === id ? { ...p, config: { ...p.config, assets: [...(p.config.assets || []), asset], assetIds: [...p.config.assetIds, asset.id] }, updatedAt: Date.now() } : p,
      )
      persist(projects)
      return { projects }
    }),

  updateSceneElement: (id, elId, patch, snapshot) =>
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const scenes = es.scenes.map((sc) => ({ ...sc, elements: sc.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)) }))
      const history = snapshot ? pushHistory(s.history, id, es) : s.history
      return { editors: { ...s.editors, [id]: { ...es, scenes } }, history }
    }),

  addSceneElement: (id, sceneId, el) =>
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const scenes = es.scenes.map((sc) => (sc.id === sceneId ? { ...sc, elements: [...sc.elements, el] } : sc))
      return { editors: { ...s.editors, [id]: { ...es, scenes, selectedId: el.id } }, history: pushHistory(s.history, id, es) }
    }),

  deleteSceneElement: (id, elId) =>
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const scenes = es.scenes.map((sc) => ({ ...sc, elements: sc.elements.filter((e) => e.id !== elId) }))
      return { editors: { ...s.editors, [id]: { ...es, scenes, selectedId: es.selectedId === elId ? null : es.selectedId } }, history: pushHistory(s.history, id, es) }
    }),

  duplicateSceneElement: (id, elId) => {
    const newId = uid('el')
    let ok = false
    set((s) => {
      const es = s.editors[id]
      if (!es) return s
      const scenes = es.scenes.map((sc) => {
        const src = sc.elements.find((e) => e.id === elId)
        if (!src) return sc
        ok = true
        return { ...sc, elements: [...sc.elements, { ...src, id: newId, x: Math.min(94, src.x + 4), y: Math.min(94, src.y + 4), role: `${src.role} copy` }] }
      })
      if (!ok) return s
      return { editors: { ...s.editors, [id]: { ...es, scenes, selectedId: newId } }, history: pushHistory(s.history, id, es) }
    })
    return ok ? newId : null
  },

  reorderSceneElement: (id, sceneId, dragId, overId) =>
    set((s) => {
      const es = s.editors[id]
      if (!es || dragId === overId) return s
      const scenes = es.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc
        const els = [...sc.elements]
        const from = els.findIndex((e) => e.id === dragId)
        const to = els.findIndex((e) => e.id === overId)
        if (from < 0 || to < 0) return sc
        const [m] = els.splice(from, 1)
        els.splice(to, 0, m)
        return { ...sc, elements: els }
      })
      return { editors: { ...s.editors, [id]: { ...es, scenes } }, history: pushHistory(s.history, id, es) }
    }),

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

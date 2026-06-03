import type { VideoProjectConfig, StoryboardFrame, SceneSeed, SceneKind, OverlayElement, AspectRatio } from './types'
import { generateStoryboard as fallbackStoryboard, uid } from './data'
import { SCENE_LABELS } from './scene'

/**
 * Client-side AI bridge. All calls go through the Vite dev plugin which
 * proxies to Gemini server-side (keeps the API key off the wire). Every call
 * falls back to a deterministic local generator on failure so the UI never
 * breaks if the API is down or the key is missing.
 */

export interface AIStatus { provider: 'claude' | 'gemini' | 'fallback'; model?: string; genModel?: string; editModel?: string; ready: boolean }

export async function aiStatus(): Promise<AIStatus> {
  try {
    const r = await fetch('/api/ai/status')
    return await r.json()
  } catch { return { provider: 'fallback', ready: false } }
}

// ── Claude brain: compose & edit full Hyperframes compositions ──────────────
export interface ComposeResult {
  ok: boolean
  html?: string
  summary: string
  duration?: number
  scenes?: string[]
  error?: string
  fallback?: boolean
}

/** Ask Claude to author a complete, render-ready Hyperframes composition. */
export async function composeVideoAI(input: {
  prompt: string
  flow?: string
  aspect: AspectRatio
  durationSec: number
  palette: string[]
  brand?: { title?: string; description?: string }
}): Promise<ComposeResult> {
  try {
    const r = await fetch('/api/ai/compose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await r.json()
    if (!data.ok || !data.html) return { ok: false, summary: '', error: data.error || 'compose failed', fallback: true }
    return data as ComposeResult
  } catch (e) {
    return { ok: false, summary: '', error: String((e as Error)?.message || e), fallback: true }
  }
}

/** Ask Claude to rewrite an existing composition per a natural-language edit. */
export async function editCompositionAI(html: string, prompt: string): Promise<ComposeResult> {
  try {
    const r = await fetch('/api/ai/edit-composition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html, prompt }),
    })
    const data = await r.json()
    if (!data.ok || !data.html) return { ok: false, summary: '', error: data.error || 'edit failed' }
    return data as ComposeResult
  } catch (e) {
    return { ok: false, summary: '', error: String((e as Error)?.message || e) }
  }
}

// ── Storyboard generation ───────────────────────────────────────────────────
export async function generateStoryboardAI(config: VideoProjectConfig): Promise<{ frames: StoryboardFrame[]; source: 'gemini' | 'fallback' }> {
  try {
    const r = await fetch('/api/ai/storyboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: config.prompt,
        durationSec: config.durationSec,
        aspect: config.aspect,
        model: config.model,
        brand: config.brand,
      }),
    })
    const data = await r.json()
    if (!data.ok || !Array.isArray(data.scenes) || !data.scenes.length) throw new Error('no scenes')
    const palette = config.palette
    const seg = config.durationSec / data.scenes.length
    const frames: StoryboardFrame[] = data.scenes.map((s: any, i: number) => {
      const kind: SceneKind = (['hero','cards','quote','cta','logo','showcase','globe','split'] as SceneKind[]).includes(s.kind) ? s.kind : 'cards'
      const copy: string[] = Array.isArray(s.copy) ? s.copy.slice(0, 3) : []
      const headline = String(s.headline || s.title || copy[0] || 'Scene')
      const seed: SceneSeed = { kind, palette, headline, lines: copy.length ? copy : [headline], accent: palette[0] }
      const start = +(i * seg).toFixed(1)
      const end = +((i + 1) * seg).toFixed(1)
      return {
        id: uid('frame'),
        index: i,
        start,
        end,
        kind,
        title: s.title || SCENE_LABELS[kind],
        copy: copy.length ? copy : [headline.replace(/\*/g, '')],
        notes: s.notes || '',
        transition: config.transition,
        assetIds: [],
        seed,
      }
    })
    return { frames, source: 'gemini' }
  } catch {
    return { frames: fallbackStoryboard(config), source: 'fallback' }
  }
}

// ── Per-frame regeneration ──────────────────────────────────────────────────
export async function regenerateFrameAI(frame: StoryboardFrame, prompt: string, palette: string[]): Promise<{ patch: Partial<StoryboardFrame>; source: 'gemini' | 'fallback' }> {
  try {
    const r = await fetch('/api/ai/regenerate-frame', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, frame, palette }),
    })
    const data = await r.json()
    if (!data.ok || !data.scene) throw new Error('no scene')
    const s = data.scene
    const kind: SceneKind = (['hero','cards','quote','cta','logo','showcase','globe','split'] as SceneKind[]).includes(s.kind) ? s.kind : frame.kind
    const copy: string[] = Array.isArray(s.copy) ? s.copy.slice(0, 3) : frame.copy
    const headline = String(s.headline || copy[0] || frame.seed.headline)
    return {
      patch: {
        kind,
        title: s.title || SCENE_LABELS[kind],
        copy,
        notes: s.notes || frame.notes,
        seed: { ...frame.seed, kind, headline, lines: copy.length ? copy : frame.seed.lines, palette },
      },
      source: 'gemini',
    }
  } catch {
    return { patch: localRegenFallback(frame, prompt), source: 'fallback' }
  }
}

function localRegenFallback(frame: StoryboardFrame, prompt: string): Partial<StoryboardFrame> {
  const p = prompt.toLowerCase()
  const order: SceneKind[] = ['hero', 'cards', 'showcase', 'split', 'quote', 'globe', 'logo', 'cta']
  let kind = frame.kind
  for (const k of order) if (p.includes(k)) kind = k
  if (kind === frame.kind) kind = order[(order.indexOf(frame.kind) + 1) % order.length]
  const copy = prompt.length > 4 && !order.some((k) => p.includes(k))
    ? prompt.split(/[.,]/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
    : frame.copy
  return {
    kind,
    title: SCENE_LABELS[kind],
    copy: copy.length ? copy : frame.copy,
    seed: { ...frame.seed, kind, lines: copy, headline: kind === 'hero' ? `*${copy[0] || frame.seed.headline.replace(/\*/g, '')}*` : (copy[0] || frame.seed.headline) },
  }
}

// ── Editor commands ────────────────────────────────────────────────────────
export type EditCall =
  | { tool: 'resize_element'; target: string; fontSize?: number; width?: number }
  | { tool: 'position_element'; target: string; x: number; y: number }
  | { tool: 'set_color'; target: string; color: string }
  | { tool: 'set_weight'; target: string; bold: boolean }
  | { tool: 'set_animation'; target: string; animation: string }
  | { tool: 'add_element'; text: string }
  | { tool: 'delete_element'; target: string }
  | { tool: 'add_subtitles' }
  | { tool: 'tighten_transitions' }
  | { tool: 'reformat'; aspect: AspectRatio }

export interface EditResult { summary: string; calls: EditCall[]; source: 'gemini' | 'fallback' }

export async function editorCommandAI(
  prompt: string,
  context: string,
  selected: OverlayElement | null,
  overlays: OverlayElement[],
  aspect: AspectRatio,
): Promise<EditResult> {
  try {
    const r = await fetch('/api/ai/edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, context, selected, overlays, aspect }),
    })
    const data = await r.json()
    if (!data.ok || !Array.isArray(data.calls)) throw new Error('no calls')
    const calls = repairCalls(data.calls as EditCall[], prompt, selected)
    return { summary: data.summary || 'Applied your edit.', calls, source: 'gemini' }
  } catch {
    return { ...localEditFallback(prompt, selected), source: 'fallback' }
  }
}

// Gemini sometimes drops required args (color, fontSize). Repair them from the
// user's prompt so the edit still applies correctly.
const COLOR_WORDS: [RegExp, string][] = [
  [/\b(electric |bright )?(violet|purple)\b/i, '#8a3ffc'],
  [/\b(red|crimson|scarlet)\b/i, '#da1e28'],
  [/\b(blue|azure|sky)\b/i, '#0088ff'],
  [/\b(green|lime|mint)\b/i, '#42be65'],
  [/\b(yellow|amber|gold)\b/i, '#f1c21b'],
  [/\b(orange)\b/i, '#ff9f45'],
  [/\b(pink|magenta|rose)\b/i, '#ff5d8f'],
  [/\b(white|cream)\b/i, '#ffffff'],
  [/\b(black|dark)\b/i, '#171717'],
]
function inferColor(prompt: string): string | null {
  const hex = prompt.match(/#[0-9a-fA-F]{6}/)?.[0]
  if (hex) return hex
  for (const [re, hexv] of COLOR_WORDS) if (re.test(prompt)) return hexv
  return null
}
function inferSize(prompt: string, selected: OverlayElement | null): number | null {
  const base = selected?.fontSize || 40
  const pct = prompt.match(/(\d+)\s*%/)
  if (pct && /(larger|bigger|grow|increase)/i.test(prompt)) return Math.round(base * (1 + Number(pct[1]) / 100))
  if (pct && /(smaller|shrink|reduce)/i.test(prompt)) return Math.round(base * (1 - Number(pct[1]) / 100))
  if (/(bigger|larger|grow|huge|massive)/i.test(prompt)) return Math.min(180, base + 18)
  if (/(smaller|shrink|reduce|tiny)/i.test(prompt)) return Math.max(12, base - 14)
  return null
}
function repairCalls(calls: EditCall[], prompt: string, selected: OverlayElement | null): EditCall[] {
  const out: EditCall[] = []
  for (const c of calls) {
    const call = { ...c } as any
    if (call.tool === 'set_color' && !call.color) {
      const inferred = inferColor(prompt)
      if (!inferred) continue // skip if we can't determine the color
      call.color = inferred
    }
    if (call.tool === 'resize_element' && !call.fontSize && !call.width) {
      const fs = inferSize(prompt, selected)
      if (fs) call.fontSize = fs
      else continue
    }
    if (call.tool === 'position_element' && (call.x == null || call.y == null)) {
      // default to center if not specified
      call.x = call.x ?? 50
      call.y = call.y ?? 50
    }
    if (call.tool === 'reformat' && !call.aspect) {
      if (/9:16|portrait|vertical/i.test(prompt)) call.aspect = '9:16'
      else if (/1:1|square/i.test(prompt)) call.aspect = '1:1'
      else if (/16:9|landscape|horizontal/i.test(prompt)) call.aspect = '16:9'
      else continue
    }
    if (call.tool === 'add_element' && !call.text) call.text = 'New text'
    out.push(call)
  }
  return out
}

function localEditFallback(prompt: string, selected: OverlayElement | null): { summary: string; calls: EditCall[] } {
  const p = prompt.toLowerCase()
  const calls: EditCall[] = []
  const target = selected ? 'selected' : 'first'
  if (/(larger|bigger|grow)/.test(p)) calls.push({ tool: 'resize_element', target, fontSize: (selected?.fontSize || 40) + 16 })
  if (/(smaller|shrink)/.test(p)) calls.push({ tool: 'resize_element', target, fontSize: Math.max(12, (selected?.fontSize || 40) - 14) })
  if (/cent(er|re)/.test(p)) calls.push({ tool: 'position_element', target, x: 50, y: 50 })
  if (/(subtitle|caption)/.test(p)) calls.push({ tool: 'add_subtitles' })
  if (/9:16|portrait/.test(p)) calls.push({ tool: 'reformat', aspect: '9:16' })
  if (/(cta|call to action)/.test(p)) calls.push({ tool: 'add_element', text: 'Get started →' })
  if (/(remove|delete)/.test(p) && selected) calls.push({ tool: 'delete_element', target })
  if (/bold/.test(p)) calls.push({ tool: 'set_weight', target, bold: true })
  const colorMap: Record<string, string> = { purple: '#8a3ffc', violet: '#a56eff', white: '#ffffff', black: '#171717', red: '#da1e28', blue: '#0088ff', green: '#42be65' }
  for (const [n, hex] of Object.entries(colorMap)) if (p.includes(n) && /(color|colour|text)/.test(p)) { calls.push({ tool: 'set_color', target, color: hex }); break }
  return { summary: calls.length ? `Applied ${calls.length} edit${calls.length === 1 ? '' : 's'}.` : 'I tweaked the composition.', calls }
}

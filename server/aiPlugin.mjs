import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── .env loader (no dotenv dep) ────────────────────────────────────────────
function loadEnv() {
  const p = path.join(ROOT, '.env')
  if (!fs.existsSync(p)) return
  const text = fs.readFileSync(p, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

const API_KEY = process.env.GEMINI_API_KEY || ''
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const URL_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

function json(res, code, obj) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(obj))
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

// ── Gemini call helper ─────────────────────────────────────────────────────
async function gemini(prompt, schema, systemInstruction) {
  if (!API_KEY) throw new Error('missing-key')
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2400,
      ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
    },
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
  }
  const res = await fetch(`${URL_BASE}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`gemini ${res.status}: ${text.slice(0, 240)}`)
  let data
  try { data = JSON.parse(text) } catch { throw new Error('non-json gemini response') }
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!out) throw new Error('empty gemini response')
  if (schema) {
    try { return JSON.parse(out) } catch { throw new Error('gemini returned non-json despite schema') }
  }
  return out
}

// ── Schemas ────────────────────────────────────────────────────────────────
const SCENE_KINDS = ['hero', 'cards', 'quote', 'cta', 'logo', 'showcase', 'globe', 'split']

const STORYBOARD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: SCENE_KINDS },
          title: { type: 'string' },
          headline: { type: 'string' },
          copy: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        required: ['kind', 'title', 'headline', 'copy'],
      },
    },
  },
  required: ['scenes'],
}

const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    calls: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tool: {
            type: 'string',
            enum: ['resize_element', 'position_element', 'set_color', 'set_weight', 'set_animation', 'add_element', 'delete_element', 'add_subtitles', 'tighten_transitions', 'reformat'],
          },
          target: { type: 'string', enum: ['selected', 'last', 'first', 'all_text', 'none'] },
          // tool-specific args
          fontSize: { type: 'number' },
          width: { type: 'number' },
          x: { type: 'number' },
          y: { type: 'number' },
          color: { type: 'string' },
          bold: { type: 'boolean' },
          text: { type: 'string' },
          aspect: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'] },
          animation: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['tool'],
      },
    },
  },
  required: ['summary', 'calls'],
}

// ── System prompts ─────────────────────────────────────────────────────────
const STORYBOARD_SYSTEM = `You are the creative director inside Imagine Art Motion Studio.
You plan storyboards for the Kinetic motion-graphics engine that renders HTML/CSS to MP4.

Quality rules:
- Each scene's headline is 2–6 words. Use *asterisks* around the most important word for emphasis ("Ship *faster*").
- Copy array: 1–3 short phrases per scene, 2–6 words each, NEVER full sentences.
- Sentence case for everything. No emoji. No marketing fluff.
- One concept per scene. Pace it for the requested duration.
- Pick scene kinds that match the moment:
  hero = headline opener · cards = feature beats (3 max) · quote = testimonial
  cta = closer with action verb · logo = brand reveal · showcase = product hero
  globe = global/everywhere · split = b-roll with copy
- Open with hero or logo. Close with cta. Don't repeat the same kind twice in a row.
- Notes: one terse sentence on the motion intent.

Match the requested duration with the right number of scenes:
  ≤10s → 2 scenes · 11–18s → 3 · 19–35s → 4 · 36s+ → 5`

const EDIT_SYSTEM = `You are the editor agent inside Imagine Art Motion Studio.
The user describes a change. You translate it into structured tool calls.
Reply ONLY with the schema. ALWAYS include the required args for the tool you pick.

Tools — pick exactly the args listed for each (do NOT include unrelated fields):

resize_element     → { tool, target, fontSize?: number (8–200), width?: number (5–95) }
                     For "larger" without a number, add ~50% to current fontSize.
position_element   → { tool, target, x: number (0–100), y: number (0–100) }
set_color          → { tool, target, color: "#RRGGBB"  ← REQUIRED hex string }
set_weight         → { tool, target, bold: true|false }
set_animation      → { tool, target, animation: "fade"|"rise"|"slide"|"scale" }
add_element        → { tool, text: string }                ← creates new text element
delete_element     → { tool, target }
add_subtitles      → { tool }
tighten_transitions→ { tool }
reformat           → { tool, aspect: "16:9"|"9:16"|"1:1"|"4:5" }

target: "selected" | "last" | "first" | "all_text" | "none"
Default target = "selected" when a user has a selection.

Examples:
"make this bigger"               → [{tool:"resize_element",target:"selected",fontSize:64}]
"change color to lime green"     → [{tool:"set_color",target:"selected",color:"#42be65"}]
"center the title"               → [{tool:"position_element",target:"selected",x:50,y:50}]
"add a get started button"       → [{tool:"add_element",text:"Get started"}]
"make it 9:16"                   → [{tool:"reformat",aspect:"9:16"}]
"make the title bigger and purple" → [{tool:"resize_element",target:"selected",fontSize:64},{tool:"set_color",target:"selected",color:"#8a3ffc"}]

Summary: one short past-tense sentence. Return 1–3 calls. Never invent tools.`

// ── Plugin ─────────────────────────────────────────────────────────────────
export function aiPlugin() {
  return {
    name: 'motion-studio-ai',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        if (req.method === 'GET' && url === '/api/ai/status') {
          return json(res, 200, { provider: API_KEY ? 'gemini' : 'fallback', model: MODEL, ready: !!API_KEY })
        }

        if (req.method === 'POST' && url === '/api/ai/storyboard') {
          try {
            const { prompt, durationSec, aspect, model, brand } = await readBody(req)
            const sceneTarget = durationSec <= 10 ? 2 : durationSec <= 18 ? 3 : durationSec <= 35 ? 4 : 5
            const user = [
              `User prompt: ${prompt}`,
              `Duration: ${durationSec}s · Aspect: ${aspect} · Engine: ${model}`,
              brand?.title ? `Brand extracted from website: ${brand.title} — ${brand.description || ''}` : '',
              `Generate exactly ${sceneTarget} scenes.`,
            ].filter(Boolean).join('\n')
            const out = await gemini(user, STORYBOARD_SCHEMA, STORYBOARD_SYSTEM)
            return json(res, 200, { ok: true, ...out })
          } catch (e) {
            return json(res, 200, { ok: false, error: String(e?.message || e), fallback: true })
          }
        }

        if (req.method === 'POST' && url === '/api/ai/edit') {
          try {
            const { prompt, context, selected, overlays, aspect } = await readBody(req)
            const user = [
              `User instruction: ${prompt}`,
              `Context scope: ${context}`,
              `Current aspect: ${aspect}`,
              selected ? `Selected element: ${JSON.stringify({ kind: selected.kind, text: selected.text, fontSize: selected.fontSize, color: selected.color, x: selected.x, y: selected.y })}` : `Selected element: none`,
              `Existing overlays: ${overlays?.length || 0}`,
            ].join('\n')
            const out = await gemini(user, EDIT_SCHEMA, EDIT_SYSTEM)
            return json(res, 200, { ok: true, ...out })
          } catch (e) {
            return json(res, 200, { ok: false, error: String(e?.message || e), fallback: true })
          }
        }

        if (req.method === 'POST' && url === '/api/ai/regenerate-frame') {
          try {
            const { prompt, frame, palette } = await readBody(req)
            const schema = {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: SCENE_KINDS },
                title: { type: 'string' },
                headline: { type: 'string' },
                copy: { type: 'array', items: { type: 'string' } },
                notes: { type: 'string' },
              },
              required: ['kind', 'headline', 'copy'],
            }
            const user = [
              `Existing scene: ${JSON.stringify({ kind: frame.kind, headline: frame.seed.headline, copy: frame.copy })}`,
              `Change requested: ${prompt}`,
              `Keep the duration the same. Apply the user's intent. Return the full updated scene.`,
            ].join('\n')
            const out = await gemini(user, schema, STORYBOARD_SYSTEM)
            return json(res, 200, { ok: true, scene: out })
          } catch (e) {
            return json(res, 200, { ok: false, error: String(e?.message || e), fallback: true })
          }
        }

        next()
      })
    },
  }
}

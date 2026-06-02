/**
 * Motion Studio — production server (Railway / Render)
 * Serves the built Vite frontend + API routes for AI and render pipeline.
 * Hyperframes render runs via `npx hyperframes render` using the system
 * Chrome set by PUPPETEER_EXECUTABLE_PATH in the Docker image.
 */
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const express = require('express')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const WORK = path.join(ROOT, '.renders')
const PORT = Number(process.env.PORT || 3000)

// ── .env loader ────────────────────────────────────────────────────────────
function loadEnv() {
  const p = path.join(ROOT, '.env')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i.exec(line)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = val
  }
}
loadEnv()

const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// ── In-memory render job registry ─────────────────────────────────────────
const jobs = new Map()

function diskStatus(id) {
  for (const rel of [`${id}/out.mp4`, `${id}/renders/out.mp4`]) {
    if (fs.existsSync(path.join(WORK, rel)))
      return { status: 'complete', progress: 100, stage: 'Complete', url: `/renders/${rel}`, error: null }
  }
  return null
}

function startRenderJob({ id, html, meta }) {
  const dir = path.join(WORK, id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2))

  const job = { id, status: 'rendering', progress: 0, stage: 'Starting', url: null, error: null }
  jobs.set(id, job)

  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
  }

  const child = spawn('npx', ['--yes', 'hyperframes@latest', 'render', '-o', 'out.mp4', '--fps', String(meta.fps || 30)], {
    cwd: dir, env,
  })

  const onData = (buf) => {
    const s = buf.toString()
    job.stage = (s.match(/\d+%\s+([A-Za-z][A-Za-z ./]+)/)?.[1] || job.stage).trim()
    const pct = Number(s.match(/(\d{1,3})%/)?.[1] || 0)
    if (pct > job.progress) job.progress = Math.min(99, pct)
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('close', (code) => {
    const file = path.join(dir, 'out.mp4')
    if (code === 0 && fs.existsSync(file)) {
      job.status = 'complete'; job.progress = 100; job.stage = 'Complete'
      job.url = `/renders/${id}/out.mp4`
    } else {
      job.status = 'error'; job.error = `Render exited ${code}`
    }
  })
  child.on('error', (err) => { job.status = 'error'; job.error = String(err) })
}

// ── Gemini helper ──────────────────────────────────────────────────────────
async function gemini(prompt, schema, system) {
  if (!GEMINI_KEY) throw new Error('missing-key')
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2400, ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  }
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`gemini ${res.status}: ${text.slice(0, 200)}`)
  const out = JSON.parse(text)?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!out) throw new Error('empty response')
  return schema ? JSON.parse(out) : out
}

const SCENE_KINDS = ['hero', 'cards', 'quote', 'cta', 'logo', 'showcase', 'globe', 'split']

const STORYBOARD_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    scenes: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string', enum: SCENE_KINDS }, title: { type: 'string' }, headline: { type: 'string' }, copy: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['kind', 'title', 'headline', 'copy'] } },
  },
  required: ['scenes'],
}

const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    calls: { type: 'array', items: { type: 'object', properties: { tool: { type: 'string', enum: ['resize_element','position_element','set_color','set_weight','set_animation','add_element','delete_element','add_subtitles','tighten_transitions','reformat'] }, target: { type: 'string' }, fontSize: { type: 'number' }, width: { type: 'number' }, x: { type: 'number' }, y: { type: 'number' }, color: { type: 'string' }, bold: { type: 'boolean' }, text: { type: 'string' }, aspect: { type: 'string' }, animation: { type: 'string' } }, required: ['tool'] } },
  },
  required: ['summary', 'calls'],
}

const STORYBOARD_SYS = `You are the creative director inside Imagine Art Motion Studio.
Plan storyboards for the Kinetic motion-graphics engine (HTML/CSS to MP4).
Rules: 2–6 word headline, *asterisks* on key word. Copy = 1–3 short phrases, 2–6 words each.
Sentence case. No emoji. One concept per scene.
hero=opener · cards=features · quote=testimonial · cta=closer · logo=brand reveal · showcase=product · globe=global · split=b-roll
Open with hero/logo. Close with cta. Don't repeat same kind twice in a row.
≤10s→2 scenes · 11–18s→3 · 19–35s→4 · 36s+→5`

const EDIT_SYS = `You are the editor agent inside Imagine Art Motion Studio.
Translate user instructions into structured tool calls. ALWAYS include required args.
Tools:
resize_element → {tool, target, fontSize?:number(8-200), width?:number(5-95)}
position_element → {tool, target, x:number(0-100), y:number(0-100)}
set_color → {tool, target, color:"#RRGGBB"}
set_weight → {tool, target, bold:boolean}
set_animation → {tool, target, animation:"fade"|"rise"|"slide"|"scale"}
add_element → {tool, text:string}
delete_element → {tool, target}
add_subtitles → {tool}
tighten_transitions → {tool}
reformat → {tool, aspect:"16:9"|"9:16"|"1:1"|"4:5"}
target: "selected"|"last"|"first"|"all_text"|"none"
Summary: one past-tense sentence. Return 1-3 calls.`

// ── Express app ────────────────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '10mb' }))

// ── Render API ─────────────────────────────────────────────────────────────
app.post('/api/render', (req, res) => {
  const { id, html, meta } = req.body || {}
  if (!id || !html || !meta) return res.status(400).json({ error: 'id, html, meta required' })
  startRenderJob({ id, html, meta })
  res.status(202).json({ id, status: 'rendering' })
})

app.get('/api/render/status', (req, res) => {
  const { id } = req.query
  const job = id && jobs.get(id)
  if (job) return res.json({ status: job.status, progress: job.progress, stage: job.stage, url: job.url, error: job.error })
  if (id) {
    const disk = diskStatus(id)
    if (disk) return res.json(disk)
  }
  res.status(404).json({ status: 'unknown' })
})

// Serve rendered MP4s — WITH HTTP range support so video seeking works
app.use('/renders', (req, res, next) => {
  const file = path.join(WORK, req.path)
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
  const stat = fs.statSync(file)
  res.setHeader('content-type', 'video/mp4')
  res.setHeader('accept-ranges', 'bytes')
  const m = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range)
  if (m) {
    const start = parseInt(m[1], 10)
    const end = m[2] ? parseInt(m[2], 10) : stat.size - 1
    res.statusCode = 206
    res.setHeader('content-range', `bytes ${start}-${end}/${stat.size}`)
    res.setHeader('content-length', end - start + 1)
    return fs.createReadStream(file, { start, end }).pipe(res)
  }
  res.setHeader('content-length', stat.size)
  fs.createReadStream(file).pipe(res)
})

// ── AI API ─────────────────────────────────────────────────────────────────
app.get('/api/ai/status', (_req, res) =>
  res.json({ provider: GEMINI_KEY ? 'gemini' : 'fallback', model: GEMINI_MODEL, ready: !!GEMINI_KEY })
)

app.post('/api/ai/storyboard', async (req, res) => {
  try {
    const { prompt, durationSec, aspect, model, brand } = req.body
    const n = durationSec <= 10 ? 2 : durationSec <= 18 ? 3 : durationSec <= 35 ? 4 : 5
    const user = [`User prompt: ${prompt}`, `Duration: ${durationSec}s · Aspect: ${aspect} · Engine: ${model}`, brand?.title ? `Brand: ${brand.title} — ${brand.description || ''}` : '', `Generate exactly ${n} scenes.`].filter(Boolean).join('\n')
    const out = await gemini(user, STORYBOARD_SCHEMA, STORYBOARD_SYS)
    res.json({ ok: true, ...out })
  } catch (e) {
    res.json({ ok: false, error: e.message, fallback: true })
  }
})

app.post('/api/ai/edit', async (req, res) => {
  try {
    const { prompt, context, selected, overlays, aspect } = req.body
    const user = [`Instruction: ${prompt}`, `Context: ${context}`, `Aspect: ${aspect}`, selected ? `Selected: ${JSON.stringify({ kind: selected.kind, text: selected.text, fontSize: selected.fontSize, color: selected.color })}` : 'Selected: none', `Overlays: ${overlays?.length || 0}`].join('\n')
    const out = await gemini(user, EDIT_SCHEMA, EDIT_SYS)
    res.json({ ok: true, ...out })
  } catch (e) {
    res.json({ ok: false, error: e.message, fallback: true })
  }
})

app.post('/api/ai/regenerate-frame', async (req, res) => {
  try {
    const { prompt, frame } = req.body
    const schema = { type: 'object', properties: { kind: { type: 'string', enum: SCENE_KINDS }, title: { type: 'string' }, headline: { type: 'string' }, copy: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } }, required: ['kind', 'headline', 'copy'] }
    const user = `Existing scene: ${JSON.stringify({ kind: frame.kind, headline: frame.seed.headline, copy: frame.copy })}\nChange: ${prompt}\nReturn the full updated scene.`
    const out = await gemini(user, schema, STORYBOARD_SYS)
    res.json({ ok: true, scene: out })
  } catch (e) {
    res.json({ ok: false, error: e.message, fallback: true })
  }
})

// ── Serve frontend ─────────────────────────────────────────────────────────
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
} else {
  app.get('/', (_req, res) => res.send('<h2>Run <code>npm run build</code> first</h2>'))
}

app.listen(PORT, '0.0.0.0', () => console.log(`Motion Studio running on :${PORT}`))

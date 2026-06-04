import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Storyboard-Grid engine (STUB) ───────────────────────────────────────────
// Mirrors renderPlugin's contract (jobs Map + phased progress + /renders file
// serving) so the modal + client bridge never change when real models land.
// Today: Stage D (grid image) writes a branded placeholder SVG; Stage F (video)
// synthesises a placeholder MP4 with ffmpeg. The real Nano Banana Pro / Seedance
// / Kling calls drop straight into startGridImage / startGridVideo later.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const WORK = path.join(ROOT, '.renders')
const GRID_DIR = path.join(WORK, 'grid')
const FFMPEG = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'

/** in-memory job registry: `${id}:${kind}` -> { status, progress, stage, url, error } */
const jobs = new Map()

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function json(res, code, obj) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(obj))
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
}

// Branded placeholder grid SVG drawn at the real Stage-B geometry, so there is a
// persistent gridImageUrl asset even though the live tiles render client-side.
function buildGridSvg(spec, grid) {
  const c = spec?.brand?.colors || {}
  const surface = c.surface || '#0a0a0c'
  const accent = c.accent || c.secondary || '#8a3ffc'
  const primary = c.primary || '#ffffff'
  const W = grid?.gridW || 1280
  const H = grid?.gridH || 720
  const cells = grid?.cells || []
  const frames = spec?.frames || []
  const rects = cells
    .map((b, i) => {
      const f = frames[i] || {}
      const label = esc(f.role || `Frame ${i + 1}`)
      const sub = esc(f.copyText || '')
      return `
      <g>
        <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="18"
              fill="${surface}" stroke="${accent}" stroke-opacity="0.5" stroke-width="3"/>
        <circle cx="${b.x + 46}" cy="${b.y + 46}" r="22" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2"/>
        <text x="${b.x + 46}" y="${b.y + 53}" font-family="monospace" font-size="22" fill="${accent}" text-anchor="middle">${i + 1}</text>
        <text x="${b.x + 34}" y="${b.y + b.h - 58}" font-family="sans-serif" font-size="30" font-weight="700" fill="${primary}">${label}</text>
        <text x="${b.x + 34}" y="${b.y + b.h - 22}" font-family="sans-serif" font-size="24" fill="${primary}" fill-opacity="0.6">${sub}</text>
      </g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#08080b"/>
    ${rects}
  </svg>`
}

// Drive a job through named phases on a timer. `onDone` runs once at 100%.
function runPhases(job, phases, totalMs, onDone) {
  const stepMs = 220
  const steps = Math.max(1, Math.round(totalMs / stepMs))
  let i = 0
  const timer = setInterval(() => {
    i++
    const pct = Math.min(99, Math.round((i / steps) * 100))
    job.progress = pct
    const phaseIdx = Math.min(phases.length - 1, Math.floor((pct / 100) * phases.length))
    job.stage = phases[phaseIdx]
    if (i >= steps) {
      clearInterval(timer)
      try {
        onDone()
      } catch (e) {
        job.status = 'error'
        job.error = String(e)
      }
    }
  }, stepMs)
}

function startGridImage({ id, spec, grid }) {
  const dir = path.join(GRID_DIR, id)
  fs.mkdirSync(dir, { recursive: true })
  // write the spec + a persistent placeholder grid asset
  try {
    fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec ?? {}, null, 2))
    fs.writeFileSync(path.join(dir, 'grid.svg'), buildGridSvg(spec, grid))
  } catch {
    /* best-effort */
  }
  const key = `${id}:image`
  const job = { status: 'rendering', progress: 0, stage: 'Computing grid geometry', url: null, error: null }
  jobs.set(key, job)
  // NB: the real model API returns the storyboard already split into frames —
  // we never crop client-side. These phases mirror that contract.
  runPhases(job, ['Computing grid geometry', 'Assembling mega-prompt', 'Generating storyboard', 'Receiving split frames'], 2600, () => {
    job.status = 'complete'
    job.progress = 100
    job.stage = 'Complete'
    job.url = `/renders/grid/${id}/grid.svg`
  })
  return job
}

function startGridVideo({ id, plan, spec }) {
  const dir = path.join(GRID_DIR, id)
  fs.mkdirSync(dir, { recursive: true })
  const key = `${id}:video`
  const job = { status: 'rendering', progress: 0, stage: 'Routing video model', url: null, error: null }
  jobs.set(key, job)

  const dur = Math.max(1, Math.round((plan?.totalDuration || spec?.canvas?.durationSec || 8)))
  const w = spec?.canvas?.width || 1920
  const h = spec?.canvas?.height || 1080
  const surface = (spec?.brand?.colors?.surface || '#0a0a0c').replace('#', '0x')
  const out = path.join(dir, 'video.mp4')

  // synthesise a placeholder clip at the real duration/aspect (solid brand field)
  const ff = spawn(
    FFMPEG,
    ['-y', '-f', 'lavfi', '-i', `color=c=${surface}:s=${w}x${h}:d=${dur}:r=30`, '-pix_fmt', 'yuv420p', out],
    { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || ''}` } },
  )
  let ffLog = ''
  ff.stderr.on('data', (b) => { ffLog += b.toString() })

  // phased progress runs in parallel; finalisation waits on ffmpeg
  let phasesDone = false
  let ffDone = false
  let ffOk = false
  const finalize = () => {
    if (!phasesDone || !ffDone) return
    if (ffOk && fs.existsSync(out)) {
      job.status = 'complete'; job.progress = 100; job.stage = 'Complete'
      job.url = `/renders/grid/${id}/video.mp4`
    } else {
      job.status = 'error'; job.error = `Placeholder render failed: ${ffLog.slice(-200)}`
    }
  }
  runPhases(job, ['Routing video model', 'Planning clip segments', 'Synthesising clips', 'Stitching timeline'], 3200, () => { phasesDone = true; finalize() })
  ff.on('close', (code) => { ffDone = true; ffOk = code === 0; finalize() })
  ff.on('error', (err) => { ffDone = true; ffOk = false; ffLog += String(err); finalize() })
  return job
}

export function gridPlugin() {
  return {
    name: 'motion-studio-grid',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        if (req.method === 'POST' && url === '/api/grid/generate') {
          try {
            const body = await readBody(req)
            if (!body.id || !body.spec) return json(res, 400, { error: 'id, spec required' })
            startGridImage(body)
            return json(res, 202, { id: body.id, kind: 'image', status: 'rendering' })
          } catch (e) {
            return json(res, 500, { error: String(e) })
          }
        }

        if (req.method === 'POST' && url === '/api/grid/video') {
          try {
            const body = await readBody(req)
            if (!body.id || !body.plan) return json(res, 400, { error: 'id, plan required' })
            startGridVideo(body)
            return json(res, 202, { id: body.id, kind: 'video', status: 'rendering' })
          } catch (e) {
            return json(res, 500, { error: String(e) })
          }
        }

        if (req.method === 'GET' && url.startsWith('/api/grid/status')) {
          const q = new URL(url, 'http://x').searchParams
          const id = q.get('id')
          const kind = q.get('kind') === 'video' ? 'video' : 'image'
          const job = id && jobs.get(`${id}:${kind}`)
          if (job) return json(res, 200, { status: job.status, progress: job.progress, stage: job.stage, url: job.url, error: job.error })
          // disk fallback so completed outputs survive a server restart
          if (id) {
            const rel = kind === 'video' ? `grid/${id}/video.mp4` : `grid/${id}/grid.svg`
            if (fs.existsSync(path.join(WORK, rel))) {
              return json(res, 200, { status: 'complete', progress: 100, stage: 'Complete', url: `/renders/${rel}`, error: null })
            }
          }
          return json(res, 404, { status: 'unknown' })
        }

        next()
      })
    },
  }
}

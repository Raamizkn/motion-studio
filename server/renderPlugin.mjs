import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const WORK = path.join(ROOT, '.renders')
const FFMPEG = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg'

/** in-memory job registry: id -> { status, progress, stage, url, error, log } */
const jobs = new Map()

// Map a "/renders/audio/x.mp3" URL (the only audio source we accept) to a real
// on-disk path inside WORK. Reject anything that escapes the renders dir.
function resolveAudio(audioUrl) {
  if (!audioUrl || typeof audioUrl !== 'string') return null
  const rel = audioUrl.split('?')[0].replace(/^\/renders\//, '')
  const file = path.join(WORK, rel)
  if (!file.startsWith(WORK)) return null
  return fs.existsSync(file) ? file : null
}

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

function startRender({ id, html, meta }) {
  const dir = path.join(WORK, id)
  fs.mkdirSync(path.join(dir, 'renders'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2))

  const job = { id, status: 'rendering', progress: 0, stage: 'Starting', url: null, error: null, log: '' }
  jobs.set(id, job)

  const fps = meta.fps || 30
  const out = 'out.mp4'
  const child = spawn('npx', ['--yes', 'hyperframes@latest', 'render', '-o', out, '--fps', String(fps)], {
    cwd: dir,
    env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || ''}` },
  })

  const onData = (buf) => {
    const s = buf.toString()
    job.log += s
    // progress lines look like "  ███  47%  Capturing frame ..."
    const re = /(\d{1,3})%\s+([A-Za-z][A-Za-z ./]+)/g
    let m
    while ((m = re.exec(s))) {
      const pct = Math.min(99, Number(m[1]))
      if (pct >= job.progress) {
        job.progress = pct
        job.stage = m[2].trim().split('  ')[0]
      }
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)

  child.on('close', (code) => {
    const file = path.join(dir, out)
    if (code !== 0 || !fs.existsSync(file)) {
      job.status = 'error'
      job.error = `Render exited ${code}`
      return
    }
    // Optional: mux narration audio over the silent render with ffmpeg.
    const audioFile = resolveAudio(meta.audioUrl)
    if (audioFile) {
      job.stage = 'Adding narration'
      job.progress = 99
      const final = path.join(dir, 'final.mp4')
      // Keep the FULL video length (narration is <= video). apad pads the audio
      // with trailing silence, then -t clamps the output to the video duration —
      // so a shorter narration never truncates the film.
      const vdur = Number(meta.duration) || 0
      const ff = spawn(FFMPEG, [
        '-y', '-i', file, '-i', audioFile,
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-af', 'apad',
        '-map', '0:v:0', '-map', '1:a:0',
        ...(vdur ? ['-t', String(vdur)] : ['-shortest']),
        final,
      ], { env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || ''}` } })
      let ffLog = ''
      ff.stderr.on('data', (b) => { ffLog += b.toString() })
      ff.on('close', (fc) => {
        if (fc === 0 && fs.existsSync(final)) {
          job.status = 'complete'; job.progress = 100; job.stage = 'Complete'
          job.url = `/renders/${id}/final.mp4`
        } else {
          // fall back to the silent render rather than failing outright
          job.log += `\n[ffmpeg mux failed ${fc}] ${ffLog.slice(-300)}`
          job.status = 'complete'; job.progress = 100; job.stage = 'Complete'
          job.url = `/renders/${id}/out.mp4`
        }
      })
      ff.on('error', () => { job.status = 'complete'; job.progress = 100; job.stage = 'Complete'; job.url = `/renders/${id}/out.mp4` })
      return
    }
    job.status = 'complete'
    job.progress = 100
    job.stage = 'Complete'
    job.url = `/renders/${id}/out.mp4`
  })
  child.on('error', (err) => {
    job.status = 'error'
    job.error = String(err)
  })

  return job
}

export function renderPlugin() {
  return {
    name: 'motion-studio-render',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        // serve rendered files — WITH HTTP range support so video seeking works
        if (req.method === 'GET' && url.startsWith('/renders/')) {
          const rel = url.split('?')[0].replace('/renders/', '')
          const file = path.join(WORK, rel)
          if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            const stat = fs.statSync(file)
            const mime = file.endsWith('.mp3') ? 'audio/mpeg' : file.endsWith('.wav') ? 'audio/wav' : 'video/mp4'
            res.setHeader('content-type', mime)
            res.setHeader('accept-ranges', 'bytes')
            const range = req.headers.range
            const m = range && /bytes=(\d+)-(\d*)/.exec(range)
            if (m) {
              const start = parseInt(m[1], 10)
              const end = m[2] ? parseInt(m[2], 10) : stat.size - 1
              res.statusCode = 206
              res.setHeader('content-range', `bytes ${start}-${end}/${stat.size}`)
              res.setHeader('content-length', end - start + 1)
              fs.createReadStream(file, { start, end }).pipe(res)
            } else {
              res.setHeader('content-length', stat.size)
              fs.createReadStream(file).pipe(res)
            }
            return
          }
          res.statusCode = 404
          res.end('not found')
          return
        }

        if (req.method === 'POST' && url === '/api/render') {
          try {
            const body = await readBody(req)
            if (!body.id || !body.html || !body.meta) return json(res, 400, { error: 'id, html, meta required' })
            // reuse if already rendering/complete for this id+hash
            startRender(body)
            return json(res, 202, { id: body.id, status: 'rendering' })
          } catch (e) {
            return json(res, 500, { error: String(e) })
          }
        }

        if (req.method === 'GET' && url.startsWith('/api/render/status')) {
          const id = new URL(url, 'http://x').searchParams.get('id')
          const job = id && jobs.get(id)
          if (job) return json(res, 200, { status: job.status, progress: job.progress, stage: job.stage, url: job.url, error: job.error })
          // fall back to disk so completed renders survive server restarts
          if (id) {
            for (const rel of [`${id}/out.mp4`, `${id}/renders/out.mp4`]) {
              if (fs.existsSync(path.join(WORK, rel))) {
                return json(res, 200, { status: 'complete', progress: 100, stage: 'Complete', url: `/renders/${rel}`, error: null })
              }
            }
          }
          return json(res, 404, { status: 'unknown' })
        }

        next()
      })
    },
  }
}

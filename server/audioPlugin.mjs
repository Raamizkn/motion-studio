import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const AUDIO_DIR = path.join(ROOT, '.renders', 'audio')

// ── .env loader (no dotenv dep) ────────────────────────────────────────────
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

const XI_KEY = process.env.ELEVENLABS_API_KEY || ''
// Default to a stock voice that ships with every account (George — warm
// storyteller). Library voices like Rachel require a paid plan via the API.
const XI_VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb'
const XI_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
const SCRIPT_MODEL = process.env.ANTHROPIC_EDIT_MODEL || 'claude-sonnet-4-6'
const FFPROBE = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe'

// persona → a stock account voice + tuned voice_settings
const VOICE_STYLES = {
  warm: { voiceId: 'JBFqnCBsd6RMkjVDRZzb', stability: 0.5, similarity_boost: 0.75, style: 0.3 }, // George
  energetic: { voiceId: 'TX3LPaxmHKxFdv7VOQHJ', stability: 0.32, similarity_boost: 0.8, style: 0.65 }, // Liam
  calm: { voiceId: 'SAz9YHcvj6GT2YYXdXww', stability: 0.7, similarity_boost: 0.7, style: 0.15 }, // River
  confident: { voiceId: 'EXAVITQu4vr4xnSDxMaL', stability: 0.45, similarity_boost: 0.8, style: 0.5 }, // Sarah
}

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

// ── strip a composition's visible text so Claude can ground the script ──────
function plainText(html) {
  if (!html) return ''
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2400)
}

// ── ask Claude for a tight, timed narration script ──────────────────────────
async function writeScript({ html, summary, scenes, durationSec, voiceStyle, prompt }) {
  // ~2.6 spoken words/sec is a comfortable pace
  const words = Math.max(8, Math.round((durationSec || 15) * 2.4))
  const onScreen = plainText(html)
  const sys = `You are a senior voiceover copywriter for a motion-graphics studio. Write narration that will be read aloud over an animated video. Spoken, natural, confident — never read out UI labels or list words robotically. No stage directions, no emoji, no markdown. Sentence case. It must be speakable in about ${durationSec}s, so keep it to roughly ${words} words total. Voice persona: ${voiceStyle || 'warm'}.`
  const user = [
    prompt ? `BRIEF: ${prompt}` : '',
    summary ? `WHAT THE VIDEO SHOWS: ${summary}` : '',
    Array.isArray(scenes) && scenes.length ? `SCENES: ${scenes.join(' → ')}` : '',
    onScreen ? `ON-SCREEN TEXT (for grounding, do not just repeat verbatim): ${onScreen}` : '',
    `Write the narration now. Output ONLY the spoken words as 1–4 short sentences — nothing else.`,
  ].filter(Boolean).join('\n')

  if (!ANTHROPIC_KEY) {
    // graceful fallback: stitch a line from summary / scenes
    const base = summary || (Array.isArray(scenes) ? scenes.join('. ') : '') || prompt || 'Welcome.'
    return base.slice(0, words * 7)
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: SCRIPT_MODEL, max_tokens: 400, system: sys, messages: [{ role: 'user', content: user }] }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`script ${r.status}: ${t.slice(0, 200)}`)
  const data = JSON.parse(t)
  const out = (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
  return out.replace(/^["']|["']$/g, '') || (summary || 'Welcome.')
}

// ── ElevenLabs TTS → MP3 buffer ─────────────────────────────────────────────
async function synthesize(text, voiceId, voiceStyle) {
  const preset = VOICE_STYLES[voiceStyle] || VOICE_STYLES.warm
  const { voiceId: presetVoice, ...vs } = preset
  const voice = voiceId || presetVoice || XI_VOICE
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': XI_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: XI_MODEL, voice_settings: { ...vs, use_speaker_boost: true } }),
  })
  if (!r.ok) {
    const errText = await r.text()
    throw new Error(`elevenlabs ${r.status}: ${errText.slice(0, 220)}`)
  }
  const buf = Buffer.from(await r.arrayBuffer())
  if (!buf.length) throw new Error('elevenlabs returned empty audio')
  return buf
}

function probeDuration(file) {
  try {
    const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
    const d = parseFloat((r.stdout || '').trim())
    return Number.isFinite(d) ? d : 0
  } catch { return 0 }
}

// distribute the script across the measured duration, sentence by sentence
function timeScript(text, duration) {
  const parts = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  const total = parts.reduce((n, s) => n + s.length, 0) || 1
  let acc = 0
  return parts.map((s) => {
    const t = (acc / total) * duration
    acc += s.length
    return { t: Math.round(t * 10) / 10, text: s }
  })
}

export function audioPlugin() {
  return {
    name: 'vibe-motion-audio',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        if (req.method === 'GET' && url === '/api/ai/narration/status') {
          return json(res, 200, { ready: !!XI_KEY, provider: XI_KEY ? 'elevenlabs' : 'none', voice: XI_VOICE, model: XI_MODEL })
        }

        // ── Generate narration: script (Claude) → speech (ElevenLabs) ──
        if (req.method === 'POST' && url === '/api/ai/narration') {
          try {
            if (!XI_KEY) return json(res, 200, { ok: false, error: 'ElevenLabs API key not set — paste ELEVENLABS_API_KEY in .env', needsKey: true })
            const body = await readBody(req)
            const id = body.id || ('narr-' + Math.abs(hashStr(JSON.stringify(body))).toString(36))
            const voiceStyle = body.voiceStyle || 'warm'
            // explicit voiceId wins; otherwise the persona preset picks one
            const voiceId = body.voiceId || null

            const script = body.script?.trim() || (await writeScript(body))
            const audio = await synthesize(script, voiceId, voiceStyle)

            fs.mkdirSync(AUDIO_DIR, { recursive: true })
            const file = path.join(AUDIO_DIR, `${id}.mp3`)
            fs.writeFileSync(file, audio)
            const duration = probeDuration(file) || (body.durationSec || 0)

            return json(res, 200, {
              ok: true,
              url: `/renders/audio/${id}.mp3`,
              script: timeScript(script, duration || body.durationSec || 15),
              text: script,
              duration,
              voice: voiceStyle,
            })
          } catch (e) {
            return json(res, 200, { ok: false, error: String(e?.message || e) })
          }
        }

        next()
      })
    },
  }
}

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return h
}

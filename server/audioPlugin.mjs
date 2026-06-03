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
const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb' // George — free stock voice
const XI_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
const SCRIPT_MODEL = process.env.ANTHROPIC_EDIT_MODEL || 'claude-sonnet-4-6'
const FFPROBE = fs.existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe'

// ── Voice avatars — curated stock ElevenLabs voices (work on every plan) ─────
// gradient = orb colors for the picker card. description = natural delivery.
const VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', tagline: 'Warm storyteller', description: 'Warm, captivating narrator — brand & product films.', gradient: ['#ff7a45', '#8a3ffc'] },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', tagline: 'Reassuring', description: 'Mature, reassuring and confident — trustworthy reads.', gradient: ['#3b82f6', '#2dd4bf'] },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'male', tagline: 'Deep & confident', description: 'Deep, confident and energetic — punchy promos.', gradient: ['#8a3ffc', '#ec4899'] },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'female', tagline: 'Playful & bright', description: 'Playful, bright and warm — friendly and consumer.', gradient: ['#f59e0b', '#ef4444'] },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', gender: 'neutral', tagline: 'Calm & neutral', description: 'Relaxed, neutral and informative — explainers.', gradient: ['#06b6d4', '#6366f1'] },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male', tagline: 'Social energy', description: 'Energetic creator voice — fast, upbeat, social.', gradient: ['#ec4899', '#f59e0b'] },
]
const VOICE_IDS = new Set(VOICES.map((v) => v.id))
const XI_VOICE = VOICE_IDS.has(process.env.ELEVENLABS_VOICE_ID) ? process.env.ELEVENLABS_VOICE_ID : DEFAULT_VOICE

// ── Delivery styles — tune voice_settings on top of any voice ────────────────
const DELIVERY = {
  warm: { label: 'Warm', settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 } },
  energetic: { label: 'Energetic', settings: { stability: 0.32, similarity_boost: 0.8, style: 0.6 } },
  calm: { label: 'Calm & cinematic', settings: { stability: 0.78, similarity_boost: 0.7, style: 0.1 } },
  confident: { label: 'Confident promo', settings: { stability: 0.48, similarity_boost: 0.8, style: 0.45 } },
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

function plainText(html) {
  if (!html) return ''
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)
}

// ── ask Claude for ONE cohesive, general narration (not slide-by-slide) ─────
async function writeGeneralScript({ html, summary, scenes, durationSec, prompt }) {
  const dur = durationSec || 15
  // ~2.4 words/sec is a comfortable read; leave headroom so it never overruns
  const words = Math.max(10, Math.round(dur * 2.2))
  const onScreen = plainText(html)
  const sys = `You are a senior voiceover copywriter. Write a SINGLE, cohesive narration that plays over an animated video and is read aloud start to finish in one natural take.
Rules:
- Write about the OVERALL story/message of the video — do NOT narrate or read out each slide or on-screen label.
- It must be comfortably speakable in about ${dur}s — roughly ${words} words. Err shorter; never longer.
- Natural spoken rhythm: a few flowing sentences with natural pauses. Confident, human, not robotic.
- Sentence case. No emoji, no stage directions, no markdown, no quotes.
- Output ONLY the spoken words as plain prose — nothing else.`
  const user = [
    prompt ? `BRIEF: ${prompt}` : '',
    summary ? `WHAT THE VIDEO IS ABOUT: ${summary}` : '',
    Array.isArray(scenes) && scenes.length ? `IT MOVES THROUGH THESE BEATS (for context, don't list them): ${scenes.join(', ')}` : '',
    onScreen ? `ON-SCREEN TEXT (context only — do NOT just read this aloud): ${onScreen}` : '',
    `Write the ${dur}s narration now as one cohesive piece.`,
  ].filter(Boolean).join('\n')

  if (!ANTHROPIC_KEY) return (summary || prompt || 'Welcome.').slice(0, words * 7)
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

// ── ElevenLabs TTS WITH char-level timestamps → { mp3, cues } ───────────────
// One continuous read (natural pacing, never overlaps), plus subtitle cues
// built from the real alignment so captions track the audio exactly.
async function synthesizeWithCues(text, voiceId, delivery) {
  const settings = (DELIVERY[delivery] || DELIVERY.warm).settings
  const voice = VOICE_IDS.has(voiceId) ? voiceId : XI_VOICE
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': XI_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ text, model_id: XI_MODEL, voice_settings: { ...settings, use_speaker_boost: true } }),
  })
  if (!r.ok) {
    const errText = await r.text()
    throw new Error(`elevenlabs ${r.status}: ${errText.slice(0, 220)}`)
  }
  const data = await r.json()
  const mp3 = Buffer.from(data.audio_base64, 'base64')
  if (!mp3.length) throw new Error('elevenlabs returned empty audio')
  const align = data.normalized_alignment || data.alignment
  const cues = align ? cuesFromAlignment(align) : distribute(splitSentences(text), 12)
  return { mp3, cues }
}

// group characters into ~subtitle-sized cues at word / sentence boundaries
function cuesFromAlignment(align) {
  const chars = align.characters || []
  const starts = align.character_start_times_seconds || []
  const cues = []
  let buf = ''
  let cueStart = 0
  const flush = () => {
    const text = buf.trim()
    if (text) cues.push({ t: Math.round(cueStart * 10) / 10, text })
    buf = ''
  }
  for (let i = 0; i < chars.length; i++) {
    if (buf === '') cueStart = starts[i] || 0
    buf += chars[i]
    const atSentenceEnd = /[.!?]/.test(chars[i])
    if ((atSentenceEnd && buf.trim().length > 8) || buf.length >= 42) {
      // break at the next space for length-based splits
      if (!atSentenceEnd) {
        const sp = buf.lastIndexOf(' ')
        if (sp > 10) { const carry = buf.slice(sp + 1); buf = buf.slice(0, sp); flush(); buf = carry; cueStart = starts[i] || cueStart; continue }
      }
      flush()
    }
  }
  flush()
  return cues.length ? cues : [{ t: 0, text: '' }]
}

function splitSentences(text) {
  return String(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}
function distribute(sentences, duration) {
  const parts = sentences.length ? sentences : ['Welcome.']
  const total = parts.reduce((n, s) => n + s.length, 0) || 1
  let acc = 0
  return parts.map((s) => {
    const start = (acc / total) * Math.max(1, duration - 1.2)
    acc += s.length
    return { t: Math.round(start * 10) / 10, text: s }
  })
}

function probeDuration(file) {
  try {
    const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
    const d = parseFloat((r.stdout || '').trim())
    return Number.isFinite(d) ? d : 0
  } catch { return 0 }
}

// ── voice catalog with ElevenLabs preview_url (fetched once, cached) ────────
let _previewCache = null
async function previewUrls() {
  if (_previewCache) return _previewCache
  if (!XI_KEY) return {}
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': XI_KEY } })
    const d = await r.json()
    const map = {}
    for (const v of d.voices || []) if (v.preview_url) map[v.voice_id] = v.preview_url
    _previewCache = map
    return map
  } catch { return {} }
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

        if (req.method === 'GET' && url === '/api/ai/narration/voices') {
          const previews = await previewUrls()
          return json(res, 200, {
            voices: VOICES.map((v) => ({ ...v, previewUrl: previews[v.id] || null })),
            delivery: Object.entries(DELIVERY).map(([key, v]) => ({ key, label: v.label })),
            defaultVoiceId: XI_VOICE,
          })
        }

        // ── Generate narration: cohesive script → single natural read + cues ──
        if (req.method === 'POST' && url === '/api/ai/narration') {
          try {
            if (!XI_KEY) return json(res, 200, { ok: false, error: 'ElevenLabs API key not set — paste ELEVENLABS_API_KEY in .env', needsKey: true })
            const body = await readBody(req)
            const id = body.id || ('narr-' + Math.abs(hashStr(JSON.stringify(body))).toString(36))
            const delivery = body.voiceStyle || 'warm'
            const voiceId = VOICE_IDS.has(body.voiceId) ? body.voiceId : XI_VOICE
            const duration = Number(body.durationSec) || 15

            const script = (body.script || '').trim() || (await writeGeneralScript(body))
            const { mp3, cues } = await synthesizeWithCues(script, voiceId, delivery)

            fs.mkdirSync(AUDIO_DIR, { recursive: true })
            const file = path.join(AUDIO_DIR, `${id}.mp3`)
            fs.writeFileSync(file, mp3)
            const measured = probeDuration(file) || duration

            return json(res, 200, {
              ok: true,
              url: `/renders/audio/${id}.mp3`,
              script: cues,
              text: script,
              duration: measured,
              voiceId,
              voice: delivery,
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

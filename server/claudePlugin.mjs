import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

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

const API_KEY = process.env.ANTHROPIC_API_KEY || ''
const GEN_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
const EDIT_MODEL = process.env.ANTHROPIC_EDIT_MODEL || 'claude-sonnet-4-6'
const API_URL = 'https://api.anthropic.com/v1/messages'

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

// ── Claude call helper ──────────────────────────────────────────────────────
async function claude(model, system, userText, maxTokens = 8000) {
  if (!API_KEY) throw new Error('missing-key')
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`claude ${res.status}: ${text.slice(0, 300)}`)
  let data
  try { data = JSON.parse(text) } catch { throw new Error('non-json claude response') }
  const out = (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')
  if (!out) throw new Error('empty claude response')
  return out
}

// ── Hyperframes knowledge — baked into the system prompt ─────────────────────
// Distilled from the Hyperframes framework + the YC editorial reference build.
const HYPERFRAMES_SPEC = `
You are the lead motion designer + engineer inside Imagine Art "Vibe Motion". You author
COMPLETE, render-ready Hyperframes compositions: ONE self-contained HTML document that the
Hyperframes renderer (headless Chrome seeks a paused GSAP timeline → FFmpeg) turns into a
deterministic MP4. Your output must rival a top motion studio's product film — editorial,
designed, confident. Never a basic slideshow.

OUTPUT CONTRACT — follow EXACTLY:
- Output ONE complete HTML document and NOTHING else. No markdown fences, no prose around it.
- FIRST line is a meta comment, then the doctype:
  <!--HF-META {"summary":"<one short past-tense sentence>","duration":<seconds:number>,"scenes":["<label>", ...]}-->
  <!doctype html>
- HF-META duration MUST equal data-duration and the real timeline length.

ARCHITECTURE — the SCENE-STACK model (this is how cinematic Hyperframes videos are built):
- A single root: <div id="main" data-composition-id="main" data-width="W" data-height="H" data-start="0" data-duration="TOTAL">
- Inside it, a stack of FULL-SCREEN scene sections, each absolutely positioned inset:0, stacked with z-index.
  <section id="scene1" class="scene"> ... </section>  (opacity:1 visible)
  <section id="scene2" class="scene"> ... </section>  (start hidden: opacity:0; visibility:hidden)
- The PAUSED GSAP timeline choreographs everything and toggles scenes at transition times:
    gsap.set(["#scene2","#scene3","#scene4"], { opacity:0, visibility:"hidden" });   // initial
    tl.set("#scene2", { opacity:1, visibility:"visible" }, T_in);                      // reveal next
    tl.set("#scene1", { opacity:0, visibility:"hidden" }, T_out);                      // hide prev (slightly after)
- Register it: window.__timelines = window.__timelines || {}; window.__timelines["main"] = tl;
- Every tween uses an ABSOLUTE start time as the 3rd arg. Build the whole film on ONE timeline.
- You do NOT need class="clip" wrappers in this model — animate the scene's child elements directly.
- End the timeline exactly at TOTAL (e.g. a no-op tl.set("#main", {"--x":"0"}, TOTAL)) so duration is exact.

SELF-CONTAINED — CRITICAL (the render sandbox has NO local files):
- NEVER reference local asset paths (no <img src="capture/...">, no <audio src="sfx/...">, no narration.wav).
- Build ALL visuals with CSS + inline SVG + gradients + typography. Mockups, charts, logos-as-type,
  device frames, photo-stand-ins (gradient/figure illustrations) are all drawn in CSS/SVG.
- Web fonts via <link> to fonts.googleapis.com and GSAP via the jsdelivr CDN are allowed (network ok).
- Only use an <img>/<audio> if the brief explicitly provides an https:// URL or a data: URL — otherwise none.

NON-NEGOTIABLE DETERMINISM (hard renderer errors otherwise):
- Timeline MUST be gsap.timeline({ paused:true }) and registered as window.__timelines["main"].
- NO Math.random(), Date.now(), new Date(), fetch(), setTimeout, setInterval, requestAnimationFrame.
- repeat:-1 is FORBIDDEN. Use a finite count: repeat: Math.max(0, Math.floor(HOLD/CYCLE)-1), yoyo:true.
- Counters must be SEEK-SAFE: precompute discrete steps and tl.set the textContent/innerHTML at fixed times
  (e.g. var vals=["$0.1T",...,"$1.3T"]; for(i..) tl.set("#stat",{innerHTML:vals[i]}, t0+i*step)). Never a live tween onUpdate counter for big numbers.
- Canvas (if any) redraws via tl.eventCallback("onUpdate", ()=>draw(tl.time())) — never rAF.
- Pseudo-elements (::before/::after) cannot be GSAP-animated — use real child divs.

DESIGN-SYSTEM-DRIVEN QUALITY — this is the difference between studio-grade and generic:
- You will be given a THEME (brand colors + fonts) and/or a brief. DERIVE a coherent design system first:
  CSS variables for surface, ink, accent(s), muted, plus a DISPLAY font and a BODY font. Commit to it everywhere.
- Pick a visual REGISTER that fits the subject — don't default to "dark neon SaaS":
    • Editorial / institutional / finance → warm or cool off-white surface, near-black ink, a serif display
      (e.g. Source Serif 4 / Fraser / Playfair), DM Sans / Inter body, print-like depth: 2–4px SOLID borders,
      HARD offset shadows (e.g. 24px 24px 0 rgba(ink,.16) — NOT blurred), hairline rules, subtle paper grain,
      oversized ghost background words. (This is the YC register — calm, credible, proof-dense.)
    • Modern product / tech → dark cinematic base (#0a0a0c), mesh radial-gradient backdrops, glassmorphism
      (backdrop-filter blur), soft long shadows, accent glow, tight geometric sans (Outfit/Inter 700–900).
    • Playful / consumer → brighter surface, rounded forms, bold color blocks, springy motion.
  Choose deliberately and stay consistent. Use the theme's real colors/fonts when provided.
- Typography: HUGE display type (78–220px on a 1080-tall canvas), tight tracking (-0.04em on serifs).
  One emphasis idea per line. Body/proof 26–42px. Labels 18–24px uppercase tracked (.12–.16em), muted.
- Layout: strong baseline grid, big margins, deliberate asymmetry, real structure (columns, rules, cards,
  bento grids). Generous negative space. Optical alignment. Make frames look composed, not centered-by-default.

SIGNATURE TECHNIQUES (use the ones that fit — all GSAP, all deterministic):
- Per-word kinetic typography: each word its own inline-block span, staggered y/rotation/opacity (ease "expo.out", stagger ~0.07).
- SVG path draw: stroke-dasharray = path length, animate strokeDashoffset → 0 (arrows, routes, underlines, chart lines).
- Parallax / Ken Burns: slow scale (1.0→1.05) + small x/y drift over the whole scene, ease "sine.inOut" — keeps frames alive.
- 3D card tilt: transformPerspective:1200 + rotationY on cards/posters; settle from a steeper angle to a slight one.
- Bento / proof grid: photo-stand-in cards (CSS), staggered entrance with rotationY + y, captions in the corner.
- Seek-safe step counter for big stats (see determinism). Pop the final value (scale 1.0↔1.035 yoyo).
- Editorial transitions: whip-pan (x + blur(18px) out, opposite in), column BLINDS wipe (N divs scaleY 0→1→0),
  warm flash (full-screen surface div opacity 0→.9→0), cover wipe. Reveal the next scene ~0.15s before hiding the previous.
- Hard-offset shadows, solid borders, hairlines, grain overlay (layered radial-gradient dots) for editorial depth.
- Final lockup: brand mark + motto/CTA, a panel rising from the bottom, hold quiet on the last beat.

PACING: ~2.5–4.5s per beat. 10s ≈ 2–3 scenes, 15s ≈ 4 scenes, 30s ≈ 5–7 scenes. Open strong; close with a
CTA / motto / logo lockup that HOLDS. Choreograph entrances within a scene (stagger), keep micro-motion through
the hold (parallax/drift), then a designed transition out. Never let a frame sit perfectly static.

Make bespoke choices per brief. The flow type (infographic / text / poster / presentation) and the theme
must visibly shape the visual language. Quality and restraint over a pile of effects.
`.trim()

const COMPOSE_SYSTEM = HYPERFRAMES_SPEC

const EDIT_SYSTEM = `${HYPERFRAMES_SPEC}

EDIT MODE:
You are given an EXISTING Hyperframes composition HTML and a natural-language change request.
Apply the change while preserving everything else and ALL lint rules. Return the COMPLETE updated
HTML document (same OUTPUT CONTRACT + HF-META first line). Keep the same skeleton, only change what the
user asked. If they ask to reformat (e.g. 9:16), update data-width/data-height/viewport and re-layout.
If they reference "the title"/"that stat"/"the CTA", find it by its visible text/role. Never regress quality.`

// ── server-side lint sanity (cheap, catches the fatal mistakes) ─────────────
function lintComposition(html) {
  const errs = []
  if (!/data-composition-id="main"/.test(html)) errs.push('missing data-composition-id="main"')
  if (!/window\.__timelines\s*\[\s*['"]main['"]\s*\]\s*=/.test(html)) errs.push('timeline not registered as __timelines["main"]')
  if (!/gsap\.timeline\(\s*\{\s*paused\s*:\s*true/.test(html)) errs.push('timeline not paused')
  if (/Math\.random\(/.test(html)) errs.push('Math.random() is forbidden (non-deterministic)')
  if (/Date\.now\(|new Date\(\s*\)/.test(html)) errs.push('Date.now()/new Date() forbidden (non-deterministic)')
  if (/requestAnimationFrame|setInterval|setTimeout/.test(html)) errs.push('rAF/timers forbidden — drive motion off the GSAP timeline')
  if (/repeat\s*:\s*-1/.test(html)) errs.push('repeat:-1 forbidden — use a finite repeat count')
  if (/fetch\s*\(/.test(html)) errs.push('fetch() forbidden')
  return errs
}

function extractMeta(html) {
  const m = /<!--\s*HF-META\s*(\{[\s\S]*?\})\s*-->/.exec(html)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

// strip any accidental markdown fences Claude may add
function cleanHtml(out) {
  let s = out.trim()
  s = s.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '').trim()
  // if there's prose before the meta/doctype, cut to it
  const i = s.search(/<!--\s*HF-META|<!doctype html/i)
  if (i > 0) s = s.slice(i)
  return s
}

function themeBlock(theme) {
  if (!theme) return ''
  const lines = ['THEME — build the design system from this and use it consistently:']
  if (theme.name) lines.push(`  name: ${theme.name}`)
  const c = theme.colors || {}
  if (c.primary) lines.push(`  primary/ink color: ${c.primary}`)
  if (c.secondary) lines.push(`  secondary/accent color: ${c.secondary}`)
  if (c.tertiary) lines.push(`  tertiary color: ${c.tertiary}`)
  if (c.accent) lines.push(`  accent color: ${c.accent}`)
  if (c.surface) lines.push(`  surface/background color: ${c.surface}`)
  if (theme.titleFont) lines.push(`  display/title font: "${theme.titleFont}" (load via Google Fonts if available)`)
  if (theme.bodyFont) lines.push(`  body font: "${theme.bodyFont}"`)
  if (theme.register) lines.push(`  visual register: ${theme.register}`)
  if (theme.logoText) lines.push(`  brand mark / logo text: ${theme.logoText}`)
  if (theme.styleNotes) lines.push(`  notes: ${theme.styleNotes}`)
  return lines.join('\n')
}

function buildComposeUser({ prompt, flow, aspect, durationSec, palette, brand, theme, media }) {
  const dims = aspect === '9:16' ? '1080×1920 (vertical)' : aspect === '1:1' ? '1080×1080 (square)' : aspect === '4:5' ? '1080×1350 (portrait feed)' : '1920×1080 (landscape)'
  const w = aspect === '9:16' ? 1080 : aspect === '1:1' ? 1080 : aspect === '4:5' ? 1080 : 1920
  const h = aspect === '9:16' ? 1920 : aspect === '1:1' ? 1080 : aspect === '4:5' ? 1350 : 1080
  const mediaUrls = Array.isArray(media) ? media.filter((m) => typeof m === 'string' && /^(https?:|data:)/.test(m)) : []
  return [
    `BRIEF: ${prompt}`,
    flow ? `FLOW TYPE: ${flow} — let this strongly shape the visual language and motion vocabulary.` : '',
    `FORMAT: ${dims}. Set data-width="${w}" data-height="${h}", viewport and body sizing accordingly. Design FOR this exact canvas.`,
    `TARGET DURATION: ~${durationSec}s. HF-META duration must equal data-duration and the timeline length.`,
    themeBlock(theme),
    !theme && palette?.length ? `ACCENT PALETTE (use as accents within a register you choose to fit the brief): ${palette.join(', ')}` : '',
    brand?.title ? `BRAND: ${brand.title}${brand.description ? ' — ' + brand.description : ''}` : '',
    mediaUrls.length ? `PROVIDED MEDIA (use these as framed photo/proof elements with parallax; reference by exact URL):\n${mediaUrls.map((u) => '  ' + u).join('\n')}` : 'No media provided — draw all visuals in CSS/SVG, no local file references.',
    `Author the full composition now using the SCENE-STACK architecture. Output ONLY the HTML document per the contract.`,
  ].filter(Boolean).join('\n')
}

// ── Plugin ───────────────────────────────────────────────────────────────────
export function claudePlugin() {
  return {
    name: 'vibe-motion-claude',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        if (req.method === 'GET' && url === '/api/ai/status') {
          return json(res, 200, {
            provider: API_KEY ? 'claude' : 'fallback',
            ready: !!API_KEY,
            genModel: GEN_MODEL,
            editModel: EDIT_MODEL,
          })
        }

        // ── Compose a full Hyperframes video from a prompt ──
        if (req.method === 'POST' && url === '/api/ai/compose') {
          try {
            const body = await readBody(req)
            const userText = buildComposeUser(body)
            let html = cleanHtml(await claude(GEN_MODEL, COMPOSE_SYSTEM, userText, 8000))
            let errs = lintComposition(html)
            if (errs.length) {
              // one repair pass
              const repairUser = `The composition you produced has these renderer-fatal lint errors:\n- ${errs.join('\n- ')}\n\nHere is the document. Fix ONLY these issues and return the COMPLETE corrected HTML per the contract:\n\n${html}`
              html = cleanHtml(await claude(GEN_MODEL, COMPOSE_SYSTEM, repairUser, 8000))
              errs = lintComposition(html)
            }
            if (errs.length) return json(res, 200, { ok: false, error: 'lint: ' + errs.join('; '), fallback: true })
            const meta = extractMeta(html) || {}
            return json(res, 200, {
              ok: true,
              html,
              summary: meta.summary || 'Generated your video.',
              duration: Number(meta.duration) || body.durationSec || 20,
              scenes: Array.isArray(meta.scenes) ? meta.scenes : [],
            })
          } catch (e) {
            return json(res, 200, { ok: false, error: String(e?.message || e), fallback: true })
          }
        }

        // ── Edit an existing composition by prompt ──
        if (req.method === 'POST' && url === '/api/ai/edit-composition') {
          try {
            const { html: currentHtml, prompt } = await readBody(req)
            if (!currentHtml || !prompt) return json(res, 400, { ok: false, error: 'html + prompt required' })
            const userText = `CHANGE REQUEST: ${prompt}\n\nEXISTING COMPOSITION:\n${currentHtml}`
            let html = cleanHtml(await claude(EDIT_MODEL, EDIT_SYSTEM, userText, 8000))
            let errs = lintComposition(html)
            if (errs.length) {
              const repairUser = `Your edited composition has these renderer-fatal lint errors:\n- ${errs.join('\n- ')}\n\nFix ONLY these and return the COMPLETE corrected HTML:\n\n${html}`
              html = cleanHtml(await claude(EDIT_MODEL, EDIT_SYSTEM, repairUser, 8000))
              errs = lintComposition(html)
            }
            if (errs.length) return json(res, 200, { ok: false, error: 'lint: ' + errs.join('; ') })
            const meta = extractMeta(html) || {}
            return json(res, 200, {
              ok: true,
              html,
              summary: meta.summary || 'Applied your edit.',
              duration: Number(meta.duration) || 20,
              scenes: Array.isArray(meta.scenes) ? meta.scenes : [],
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

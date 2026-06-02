import type { StoryboardFrame, VideoProjectConfig, SceneSeed, SceneKind } from './types'

/**
 * Builds a lint-valid Kinetic (Hyperframes) composition from a storyboard.
 *
 * Output is a 1920×1080 HTML document the render backend feeds to
 * `hyperframes render` (headless Chrome → FFmpeg → MP4). Follows every
 * framework rule: clip shells own data-start/duration/track-index, GSAP only
 * animates inner content, paused+registered timeline, deterministic, finite
 * repeats. This is the bridge between the studio UI and a real video file.
 */

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface Tween {
  sel: string
  vars: string // gsap vars object literal, e.g. "{opacity:0,y:40,duration:.6}"
  at: number // absolute time
}

function mesh(p: string[]): string {
  const [a, b, c] = p
  return `radial-gradient(circle at 18% 20%, ${a}55, transparent 45%),radial-gradient(circle at 82% 75%, ${b}44, transparent 48%),radial-gradient(circle at 55% 50%, ${c || a}33, transparent 60%),#0a0a0c`
}

/** Per-scene inner HTML + entrance tweens (relative offsets from clip start). */
function scene(seed: SceneSeed, i: number, frame: StoryboardFrame): { html: string; tweens: Omit<Tween, 'at'>[] } {
  const id = `s${i}`
  const { palette, accent } = seed
  const head = esc(seed.headline).replace(/\*(.+?)\*/g, `<em style="color:${accent};font-style:normal">$1</em>`)
  const lines = (frame.copy.length ? frame.copy : seed.lines).map(esc)
  const bg = `<div class="bg" style="position:absolute;inset:0;background:${mesh(palette)}"></div>`
  const T = (sel: string, vars: string): Omit<Tween, 'at'> => ({ sel: `#${id} ${sel}`, vars })

  switch (seed.kind) {
    case 'hero':
      return {
        html: `${bg}
<div class="kick" style="position:absolute;top:140px;left:0;right:0;text-align:center;font-size:30px;letter-spacing:.4em;text-transform:uppercase;color:${accent};font-weight:700">${lines[1] || 'Motion Studio'}</div>
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;padding:0 160px">
<div class="h" style="font-size:150px;font-weight:800;letter-spacing:-.02em;line-height:1;text-align:center;color:#fff;text-shadow:0 2px 40px rgba(0,0,0,.6)">${head}</div>
<div class="sub" style="font-size:46px;color:rgba(255,255,255,.7);font-weight:500;text-align:center">${lines[0] || ''}</div></div>`,
        tweens: [
          T('.kick', '{opacity:0,y:-24,duration:.6,ease:"power2.out"}'),
          T('.h', '{opacity:0,y:50,scale:.96,filter:"blur(14px)",duration:.9,ease:"power3.out"}'),
          T('.sub', '{opacity:0,y:26,duration:.7,ease:"power2.out"}'),
        ],
      }
    case 'cta':
      return {
        html: `<div class="bg" style="position:absolute;inset:0;background:radial-gradient(circle at 50% 120%, ${accent}77, transparent 60%),#0a0a0c"></div>
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:64px">
<div class="h" style="font-size:130px;font-weight:800;color:#fff;text-align:center;max-width:1400px;letter-spacing:-.02em">${head}</div>
<div class="pill" style="display:inline-flex;align-items:center;gap:24px;padding:34px 70px;border-radius:999px;background:${accent};color:#0a0a0c;font-weight:700;font-size:52px;box-shadow:0 0 80px ${accent}99">${lines[0] || 'Get started'} <span>→</span></div></div>`,
        tweens: [
          T('.h', '{opacity:0,y:40,scale:.96,duration:.8,ease:"power3.out"}'),
          T('.pill', '{opacity:0,y:30,duration:.7,ease:"back.out(1.6)"}'),
        ],
      }
    case 'cards': {
      const cards = (lines.length ? lines : ['Feature one', 'Feature two', 'Feature three']).slice(0, 3)
      const dur = frame.end - frame.start
      const per = dur / cards.length
      const els = cards
        .map(
          (t, k) =>
            `<div class="card c${k}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:44px;padding:64px 96px;min-width:900px;justify-content:center;font-size:72px;font-weight:700;color:#fff;backdrop-filter:blur(16px);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:28px">
<span style="width:34px;height:34px;border-radius:50%;background:${[accent, palette[1], palette[2] || accent][k % 3]};box-shadow:0 0 24px currentColor;flex:none"></span>${t}</div>`,
        )
        .join('')
      // each card enters at its beat, exits before next (finite)
      const tweens: Omit<Tween, 'at'>[] = []
      cards.forEach((_, k) => {
        // handled via per-card timeline injected by caller using absolute times
        tweens.push({ sel: `#${id} .c${k}`, vars: `{__beat:${k},__per:${per.toFixed(3)}}` })
      })
      return {
        html: `${bg}<div class="title" style="position:absolute;top:150px;left:0;right:0;text-align:center;font-size:60px;font-weight:700;color:#fff">${head}</div>${els}`,
        tweens: [T('.title', '{opacity:0,y:-20,duration:.6}'), ...tweens],
      }
    }
    case 'quote':
      return {
        html: `${bg}<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;padding:0 220px">
<div class="mark" style="font-size:220px;color:${accent};line-height:0;opacity:.5;height:120px">“</div>
<div class="q" style="font-size:96px;font-weight:700;line-height:1.18;color:#fff;text-align:center">${head}</div>
<div class="by" style="font-size:40px;color:rgba(255,255,255,.55);letter-spacing:.08em;text-transform:uppercase">${lines[0] || 'Imagine Art'}</div></div>`,
        tweens: [
          T('.mark', '{opacity:0,scale:.6,duration:.6,ease:"back.out(2)"}'),
          T('.q', '{opacity:0,y:30,duration:.8,ease:"power3.out"}'),
          T('.by', '{opacity:0,y:16,duration:.6}'),
        ],
      }
    case 'logo':
      return {
        html: `${bg}<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:80px">
<div class="logo" style="width:440px;height:440px;border-radius:28%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:220px;font-weight:800;color:#0a0a0c;box-shadow:0 0 120px ${accent}88">${(esc(seed.headline)[0] || 'M').toUpperCase()}</div>
<div class="tag" style="font-size:48px;letter-spacing:.3em;text-transform:uppercase;color:#fff;font-weight:600">${lines[0] || ''}</div></div>`,
        tweens: [
          T('.logo', '{opacity:0,rotationY:90,scale:.7,duration:1,ease:"power3.out"}'),
          T('.tag', '{opacity:0,y:24,letterSpacing:"0.6em",duration:.7}'),
        ],
      }
    case 'globe':
      return {
        html: `${bg}<div class="globe" style="position:absolute;left:32%;top:50%;transform:translate(-50%,-50%);width:620px;height:620px;border-radius:50%;border:3px solid ${accent}aa;box-shadow:inset 0 0 120px ${accent}55,0 0 100px ${accent}44">
<div style="position:absolute;inset:8%;border-radius:50%;border:2px solid ${accent}55"></div>
<div style="position:absolute;inset:0;border-radius:50%;border:1px solid ${accent}66;transform:rotateY(70deg)"></div></div>
<div class="cap" style="position:absolute;right:180px;top:50%;transform:translateY(-50%);font-size:80px;font-weight:700;color:#fff;max-width:640px">${head}</div>`,
        tweens: [
          T('.globe', '{opacity:0,scale:.8,duration:1,ease:"power3.out"}'),
          T('.cap', '{opacity:0,x:50,duration:.8,ease:"power2.out"}'),
        ],
      }
    case 'showcase':
      return {
        html: `${bg}<div class="frame" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:860px;height:680px;border-radius:36px;background:linear-gradient(160deg,${palette[0]}cc,${palette[1] || palette[0]}aa);border:1px solid rgba(255,255,255,.2);box-shadow:0 50px 120px rgba(0,0,0,.5)"></div>
<div class="sp s0" style="position:absolute;left:170px;top:300px;padding:28px 44px;font-size:40px;font-weight:600;color:#fff;backdrop-filter:blur(16px);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:18px">${lines[0] || 'Fast'}</div>
<div class="sp s1" style="position:absolute;right:170px;top:480px;padding:28px 44px;font-size:40px;font-weight:600;color:#fff;backdrop-filter:blur(16px);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:18px">${lines[1] || 'Beautiful'}</div>
<div class="sp s2" style="position:absolute;left:240px;bottom:220px;padding:28px 44px;font-size:40px;font-weight:600;color:#fff;backdrop-filter:blur(16px);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:18px">${lines[2] || 'On brand'}</div>`,
        tweens: [
          T('.frame', '{opacity:0,y:60,rotation:-3,duration:.9,ease:"power3.out"}'),
          T('.s0', '{opacity:0,x:-30,duration:.6,ease:"power2.out"}'),
          T('.s1', '{opacity:0,x:30,duration:.6,ease:"power2.out"}'),
          T('.s2', '{opacity:0,x:-30,duration:.6,ease:"power2.out"}'),
        ],
      }
    case 'split':
    default:
      return {
        html: `${bg}<div style="position:absolute;left:160px;top:50%;transform:translateY(-50%);max-width:900px">
<div class="lt" style="font-size:110px;font-weight:800;color:#fff;line-height:1.04">${head}</div>
<div class="sub" style="margin-top:40px;font-size:46px;color:rgba(255,255,255,.6)">${lines[0] || ''}</div></div>
<div class="vid" style="position:absolute;right:130px;bottom:130px;width:520px;height:680px;border-radius:32px;background:linear-gradient(160deg,${palette[0]},${palette[1] || palette[0]});border:1px solid rgba(255,255,255,.2);box-shadow:0 40px 100px rgba(0,0,0,.5)"></div>`,
        tweens: [
          T('.vid', '{opacity:0,y:50,scale:.94,duration:.9,ease:"power3.out"}'),
          T('.lt', '{opacity:0,y:30,duration:.8,ease:"power3.out"}'),
          T('.sub', '{opacity:0,y:20,duration:.7,ease:"power2.out"}'),
        ],
      }
  }
}

export interface CompositionResult {
  html: string
  meta: { id: string; name: string; duration: number; fps: number; width: number; height: number }
}

export function buildComposition(
  frames: StoryboardFrame[],
  config: VideoProjectConfig,
  name: string,
): CompositionResult {
  const W = 1920
  const H = 1080
  const fps = config.fps || 30
  const total = +(frames.length ? frames[frames.length - 1].end : config.durationSec).toFixed(2)

  const clips: string[] = []
  const tweenLines: string[] = []
  const beatBlocks: string[] = []

  // background track 0 — full-duration mesh so seams never flash black
  clips.push(
    `<div class="clip" data-start="0" data-duration="${total}" data-track-index="0" style="position:absolute;inset:0;background:#0a0a0c"></div>`,
  )

  frames.forEach((f, i) => {
    const start = +f.start.toFixed(2)
    const dur = +(f.end - f.start).toFixed(2)
    const { html, tweens } = scene(f.seed, i, f)
    clips.push(
      `<div id="clip${i}" class="clip" data-start="${start}" data-duration="${dur}" data-track-index="2" style="position:absolute;inset:0;overflow:hidden">
<div id="s${i}" class="scene" style="position:absolute;inset:0">${html}</div></div>`,
    )
    tweens.forEach((tw) => {
      // special-cased card beats (enter→hold→exit) → discrete timeline ops
      const m = /__beat:(\d+),__per:([\d.]+)/.exec(tw.vars)
      if (m) {
        const beat = Number(m[1])
        const per = Number(m[2])
        const t0 = +(start + beat * per).toFixed(2)
        const hold = Math.max(0.4, per - 0.5)
        beatBlocks.push(
          `tl.fromTo('${tw.sel}',{opacity:0,y:40,scale:.94},{opacity:1,y:0,scale:1,duration:.45,ease:'power3.out'},${t0});` +
            `tl.to('${tw.sel}',{opacity:0,y:-34,scale:.96,duration:.4,ease:'power2.in'},${(t0 + 0.45 + hold).toFixed(2)});`,
        )
      } else {
        tweenLines.push(`tl.from('${tw.sel}', ${tw.vars}, ${(start + 0.15).toFixed(2)});`)
      }
    })
  })

  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=1920, height=1080"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#0a0a0c;color:#fff;font-family:'Inter',sans-serif}
#root{position:relative;width:${W}px;height:${H}px}
.scene em{font-style:normal}
</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
${clips.join('\n')}
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
${tweenLines.join('\n')}
${beatBlocks.join('\n')}
window.__timelines['main'] = tl;
</script>
</body></html>`

  return { html, meta: { id: 'main', name, duration: total, fps, width: W, height: H } }
}

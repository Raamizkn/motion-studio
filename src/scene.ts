import type { SceneSeed, SceneKind } from './types'

/**
 * Kinetic scene renderer.
 *
 * Produces a self-contained, infinitely-looping animated HTML document for a
 * scene seed. This mirrors how the Kinetic engine composes scenes (HTML/CSS,
 * every element a DOM node with CSS animation) and is what powers every
 * animated preview across the studio — storyboard cards, the editor canvas,
 * template thumbnails and project cards.
 *
 * Quality rules baked in (from the Kinetic production playbook):
 *  - 2–6 word phrases per text element, never sentences
 *  - one card per beat: enter → hold → exit, staggered
 *  - explicit sizing, max-width + clip so text never overflows
 *  - white-glow / shadow for contrast over busy backgrounds
 *  - glassmorphism card style
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function shell(body: string, css: string, bg: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;font-family:'Inter',-apple-system,system-ui,sans-serif}
.stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;${bg};overflow:hidden}
.glow{text-shadow:0 1px 18px rgba(0,0,0,.85)}
.glass{backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:18px}
${css}
</style></head><body><div class="stage">${body}</div></body></html>`
}

function meshBg(palette: string[]): string {
  const [a, b, c] = palette
  return `background:
    radial-gradient(circle at 18% 20%, ${a}38, transparent 45%),
    radial-gradient(circle at 82% 75%, ${b}30, transparent 48%),
    radial-gradient(circle at 55% 50%, ${c || a}20, transparent 60%),
    #0a0a0c`
}

/** Build the inner body + css per scene kind. */
function compose(seed: SceneSeed): { body: string; css: string; bg: string } {
  const { palette, headline, lines, accent } = seed
  const bg = meshBg(palette)
  const head = esc(headline)
  const L = lines.map(esc)

  switch (seed.kind) {
    case 'hero':
      return {
        bg,
        css: `
.h{font-size:6.2cqw;font-weight:800;letter-spacing:-.02em;line-height:1.02;max-width:84%;text-align:center;color:#fff;animation:heroIn 5s var(--e) infinite}
.h .em{color:${accent}}
.sub{margin-top:3cqh;font-size:2.3cqw;color:rgba(255,255,255,.66);font-weight:500;animation:subIn 5s var(--e) infinite}
.kick{position:absolute;top:9cqh;font-size:1.5cqw;letter-spacing:.4em;text-transform:uppercase;color:${accent};font-weight:700;animation:kickIn 5s var(--e) infinite}
:root{--e:cubic-bezier(.16,1,.3,1)}
@keyframes heroIn{0%{opacity:0;transform:translateY(26px) scale(.97);filter:blur(8px)}14%,80%{opacity:1;transform:none;filter:none}96%,100%{opacity:0;transform:translateY(-14px);filter:blur(6px)}}
@keyframes subIn{0%,10%{opacity:0;transform:translateY(16px)}24%,82%{opacity:1;transform:none}96%,100%{opacity:0}}
@keyframes kickIn{0%,4%{opacity:0;letter-spacing:.7em}16%,86%{opacity:1;letter-spacing:.4em}97%,100%{opacity:0}}`,
        body: `<div class="kick glow">${L[1] || 'Motion Studio'}</div>
<div style="text-align:center">
<div class="h glow">${head.replace(/\*(.+?)\*/g, '<span class="em">$1</span>')}</div>
<div class="sub glow">${L[0] || ''}</div></div>`,
      }

    case 'cards': {
      // one card per beat, enter→hold→exit staggered
      const cards = (L.length ? L : ['Feature one', 'Feature two', 'Feature three']).slice(0, 3)
      const per = 100 / cards.length
      const cardEls = cards
        .map((t, i) => {
          const delay = (i * (5 / cards.length)).toFixed(2)
          return `<div class="card glass glow" style="animation-delay:${delay}s">
<div class="dot" style="background:${[accent, palette[1], palette[2] || accent][i % 3]}"></div>
<span>${t}</span></div>`
        })
        .join('')
      return {
        bg,
        css: `
.title{position:absolute;top:11cqh;font-size:2.6cqw;font-weight:700;color:#fff;animation:tIn 5s var(--e) infinite}
.card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:2.4cqw;padding:3.4cqh 4cqw;min-width:46cqw;justify-content:center;font-size:3.1cqw;font-weight:700;color:#fff;opacity:0;animation:cardBeat 5s var(--e) infinite}
.card .dot{width:1.8cqw;height:1.8cqw;border-radius:50%;flex:none;box-shadow:0 0 16px currentColor}
:root{--e:cubic-bezier(.16,1,.3,1)}
@keyframes tIn{0%{opacity:0;transform:translateY(-10px)}10%,92%{opacity:1;transform:none}100%{opacity:.0}}
@keyframes cardBeat{0%,${per * 0 - 1 < 0 ? 0 : per * 0}%{opacity:0;transform:translate(-50%,calc(-50% + 30px)) scale(.94)}
8%{opacity:1;transform:translate(-50%,-50%) scale(1)}
${(per - 6).toFixed(0)}%{opacity:1;transform:translate(-50%,-50%) scale(1)}
${per.toFixed(0)}%,100%{opacity:0;transform:translate(-50%,calc(-50% - 26px)) scale(.96)}}`,
        body: `<div class="title glow">${head}</div>${cardEls}`,
      }
    }

    case 'quote':
      return {
        bg,
        css: `
.q{max-width:78%;text-align:center;font-size:4cqw;font-weight:700;line-height:1.18;color:#fff;animation:qIn 5s var(--e) infinite}
.mark{font-size:9cqw;color:${accent};line-height:0;opacity:.5;animation:mIn 5s var(--e) infinite}
.by{margin-top:4cqh;font-size:1.8cqw;color:rgba(255,255,255,.55);letter-spacing:.08em;text-transform:uppercase;animation:byIn 5s var(--e) infinite}
:root{--e:cubic-bezier(.16,1,.3,1)}
@keyframes qIn{0%{opacity:0;transform:translateY(20px)}16%,84%{opacity:1;transform:none}98%{opacity:0}}
@keyframes mIn{0%{opacity:0;transform:scale(.6)}14%{opacity:.5;transform:scale(1)}84%{opacity:.5}98%{opacity:0}}
@keyframes byIn{0%,16%{opacity:0}30%,84%{opacity:1}98%{opacity:0}}`,
        body: `<div style="text-align:center"><div class="mark">“</div><div class="q glow">${head}</div><div class="by">${L[0] || 'Imagine Art'}</div></div>`,
      }

    case 'cta':
      return {
        bg: `background:radial-gradient(circle at 50% 120%, ${accent}55, transparent 60%), #0a0a0c`,
        css: `
.cta{font-size:6cqw;font-weight:800;color:#fff;text-align:center;max-width:84%;letter-spacing:-.02em;animation:ctaIn 5s var(--e) infinite}
.pill{margin-top:5cqh;display:inline-flex;align-items:center;gap:1.4cqw;padding:2.4cqh 4cqw;border-radius:99px;background:${accent};color:#0a0a0c;font-weight:700;font-size:2.6cqw;animation:pillIn 5s var(--e) infinite;box-shadow:0 0 40px ${accent}99}
.arrow{animation:arr 1.4s ease-in-out infinite}
:root{--e:cubic-bezier(.16,1,.3,1)}
@keyframes ctaIn{0%{opacity:0;transform:translateY(20px) scale(.96)}18%,86%{opacity:1;transform:none}99%{opacity:0}}
@keyframes pillIn{0%,18%{opacity:0;transform:translateY(16px)}34%,86%{opacity:1;transform:none}99%{opacity:0}}
@keyframes arr{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}`,
        body: `<div style="text-align:center"><div class="cta glow">${head}</div><div class="pill">${L[0] || 'Get started'}<span class="arrow">→</span></div></div>`,
      }

    case 'logo':
      return {
        bg,
        css: `
.logo{width:24cqw;height:24cqw;border-radius:28%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:11cqw;font-weight:800;color:#0a0a0c;animation:spinIn 5s var(--e) infinite;box-shadow:0 0 70px ${accent}77;transform-style:preserve-3d}
.tag{position:absolute;bottom:18cqh;font-size:2.4cqw;letter-spacing:.3em;text-transform:uppercase;color:#fff;font-weight:600;animation:tagIn 5s var(--e) infinite}
.ring{position:absolute;width:34cqw;height:34cqw;border:2px solid ${accent}55;border-radius:50%;animation:ring 5s ease-out infinite}
:root{--e:cubic-bezier(.16,1,.3,1)}
@keyframes spinIn{0%{opacity:0;transform:rotateY(90deg) scale(.7)}20%{opacity:1;transform:rotateY(0) scale(1)}80%{opacity:1;transform:rotateY(0) scale(1)}100%{opacity:0;transform:rotateY(-40deg) scale(.92)}}
@keyframes tagIn{0%,22%{opacity:0;letter-spacing:.6em}40%,82%{opacity:1;letter-spacing:.3em}99%{opacity:0}}
@keyframes ring{0%{opacity:0;transform:scale(.5)}30%{opacity:.6}100%{opacity:0;transform:scale(1.3)}}`,
        body: `<div class="ring"></div><div class="logo glow">${(head[0] || 'M').toUpperCase()}</div><div class="tag glow">${L[0] || headline}</div>`,
      }

    case 'showcase':
      return {
        bg,
        css: `
.frame{width:46cqw;height:64cqh;border-radius:24px;background:linear-gradient(160deg,${palette[0]}cc,${palette[1] || palette[0]}aa);border:1px solid rgba(255,255,255,.2);box-shadow:0 30px 80px rgba(0,0,0,.5);position:relative;overflow:hidden;animation:fr 5s var(--e) infinite}
.frame::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);animation:sheen 3s ease-in-out infinite}
.spec{position:absolute;padding:1.6cqh 2.2cqw;font-size:1.8cqw;font-weight:600;color:#fff;opacity:0}
.s1{left:9cqw;top:24cqh;animation:specIn 5s var(--e) infinite}
.s2{right:9cqw;top:40cqh;animation:specIn 5s var(--e) .4s infinite}
.s3{left:13cqw;bottom:20cqh;animation:specIn 5s var(--e) .8s infinite}
:root{--e:cubic-bezier(.16,1,.3,1)}
@keyframes fr{0%{opacity:0;transform:translateY(34px) rotate(-3deg)}18%,84%{opacity:1;transform:none}99%{opacity:0}}
@keyframes sheen{0%,100%{transform:translateX(-120%)}55%{transform:translateX(120%)}}
@keyframes specIn{0%,20%{opacity:0;transform:translateX(-14px)}38%,84%{opacity:1;transform:none}99%{opacity:0}}`,
        body: `<div class="frame glass"></div>
<div class="spec glass glow s1">${L[0] || 'Fast'}</div>
<div class="spec glass glow s2">${L[1] || 'Beautiful'}</div>
<div class="spec glass glow s3">${L[2] || 'On brand'}</div>`,
      }

    case 'globe':
      return {
        bg,
        css: `
.globe{width:40cqw;height:40cqw;border-radius:50%;border:2px solid ${accent}77;position:relative;animation:gIn 5s var(--e) infinite;box-shadow:inset 0 0 60px ${accent}44, 0 0 60px ${accent}33}
.globe::before,.globe::after{content:'';position:absolute;inset:0;border-radius:50%;border:1px solid ${accent}44}
.globe::before{transform:rotateY(70deg)}
.globe::after{transform:rotateX(70deg)}
.merid{position:absolute;inset:6%;border-radius:50%;border:1px solid ${accent}33;animation:rot 8s linear infinite}
.cap{position:absolute;right:12cqw;font-size:3cqw;font-weight:700;color:#fff;max-width:30cqw;animation:capIn 5s var(--e) infinite}
:root{--e:cubic-bezier(.16,1,.3,1)}
@keyframes gIn{0%{opacity:0;transform:translateX(0) scale(.8)}24%{opacity:1;transform:translateX(-16cqw) scale(1)}82%{opacity:1;transform:translateX(-16cqw) scale(1)}100%{opacity:0;transform:scale(.92)}}
@keyframes rot{to{transform:rotate(360deg)}}
@keyframes capIn{0%,28%{opacity:0;transform:translateX(20px)}46%,82%{opacity:1;transform:none}99%{opacity:0}}`,
        body: `<div class="globe"><div class="merid"></div></div><div class="cap glow">${head}</div>`,
      }

    case 'split':
    default:
      return {
        bg,
        css: `
.video{position:absolute;right:6cqw;bottom:8cqh;width:26cqw;height:46cqh;border-radius:20px;background:linear-gradient(160deg,${palette[0]},${palette[1] || palette[0]});border:1px solid rgba(255,255,255,.2);animation:vid 5s var(--e) infinite;overflow:hidden}
.video::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.25) 50%,transparent 60%);animation:sheen 3.4s ease-in-out infinite}
.left{position:absolute;left:8cqw;top:50%;transform:translateY(-50%);max-width:44cqw}
.lt{font-size:4.4cqw;font-weight:800;color:#fff;line-height:1.05;animation:ltIn 5s var(--e) infinite}
.sub{margin-top:2.4cqh;font-size:2cqw;color:rgba(255,255,255,.6);animation:ltIn 5s var(--e) .2s infinite}
:root{--e:cubic-bezier(.16,1,.3,1)}
@keyframes vid{0%{opacity:0;transform:translateY(30px) scale(.94)}18%,86%{opacity:1;transform:none}99%{opacity:0}}
@keyframes sheen{0%,100%{transform:translateX(-130%)}55%{transform:translateX(130%)}}
@keyframes ltIn{0%{opacity:0;transform:translateY(18px)}20%,86%{opacity:1;transform:translateY(0)}99%{opacity:0}}`,
        body: `<div class="left"><div class="lt glow">${head}</div><div class="sub glow">${L[0] || ''}</div></div><div class="video glass"></div>`,
      }
  }
}

/** Public: full HTML document string for an <iframe srcdoc>. */
export function buildSceneHtml(seed: SceneSeed): string {
  const { body, css, bg } = compose(seed)
  // container queries so cqw/cqh scale to any iframe size
  const wrap = `.stage{container-type:size}` + css
  return shell(body, wrap, bg)
}

export const SCENE_LABELS: Record<SceneKind, string> = {
  hero: 'Hero title',
  cards: 'Feature cards',
  quote: 'Quote card',
  cta: 'Call to action',
  logo: 'Logo reveal',
  showcase: 'Product showcase',
  globe: 'Motion globe',
  split: 'Split / B-roll',
}

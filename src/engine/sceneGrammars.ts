// ── Scene grammars ──────────────────────────────────────────────────────────
// Each use case has a canonical beat sequence (the storyboard's narrative
// skeleton). fitBeatsToN scales that sequence to the requested frame count N:
//   N < beats  → merge tail beats into their neighbour (drop the least-load beat)
//   N > beats  → split the hero/showcase beat into extra angle variations
// Produces FrameSlice stubs (no cell/index yet — compileSpec attaches those).

import type { UseCase, BrandKit, FrameSlice } from '../spec'

type BeatDef = {
  beat: string
  role: string
  sceneDesc: string
  productPose: string
  copyText: string
  textZone: FrameSlice['textZone']
  kicker: string
}

// register the stub visuals should adopt per use case
const REGISTER: Record<UseCase, string> = {
  saas_explainer: 'product',
  physical_ad: 'poster',
  pitch: 'presentation',
  app_launch: 'product',
  brand_manifesto: 'bold',
}

const GRAMMARS: Record<UseCase, BeatDef[]> = {
  saas_explainer: [
    { beat: 'hook', role: 'Opening hook', sceneDesc: 'Dark cinematic title card, mesh-gradient backdrop, product wordmark settling in', productPose: 'wordmark lockup, centered', copyText: 'Meet {brand}', textZone: 'bottom', kicker: 'Introducing' },
    { beat: 'problem', role: 'The problem', sceneDesc: 'Cluttered before-state, muted tones, tension in the composition', productPose: 'context shot, off-center', copyText: 'Work is scattered', textZone: 'top', kicker: 'The problem' },
    { beat: 'feature_1', role: 'Feature beat', sceneDesc: 'Glass UI card sliding in over the dashboard, soft accent glow', productPose: 'UI panel, 3/4 angle', copyText: 'One workspace', textZone: 'left', kicker: 'Feature' },
    { beat: 'feature_2', role: 'Feature beat', sceneDesc: 'Second glass card with a small chart, staggered caption', productPose: 'UI panel with chart', copyText: 'See everything', textZone: 'right', kicker: 'Feature' },
    { beat: 'proof', role: 'Proof / stat', sceneDesc: 'Big number counts up, supporting label, confident hold', productPose: 'stat callout', copyText: '+212% faster', textZone: 'bottom', kicker: 'Results' },
    { beat: 'cta', role: 'Call to action', sceneDesc: 'CTA lockup, glowing pill button, brand mark, final hold', productPose: 'logo + button lockup', copyText: 'Start free today', textZone: 'bottom', kicker: 'Get started' },
  ],
  physical_ad: [
    { beat: 'reveal', role: 'Product reveal', sceneDesc: 'Studio-lit hero shot, dramatic key light, deep shadow, seamless backdrop', productPose: 'hero front 3/4, floating', copyText: 'New', textZone: 'top', kicker: 'Drop' },
    { beat: 'detail', role: 'Detail macro', sceneDesc: 'Extreme close-up on texture/material, shallow depth of field', productPose: 'macro detail', copyText: 'Built to last', textZone: 'none', kicker: 'Craft' },
    { beat: 'lifestyle', role: 'Lifestyle / in use', sceneDesc: 'Product in a real environment, warm lighting, human context', productPose: 'in-hand / on-surface', copyText: 'Made for everyday', textZone: 'bottom', kicker: 'In the wild' },
    { beat: 'angle', role: 'Alternate angle', sceneDesc: 'Rotated hero on a colour-block field, hard rim light', productPose: 'side profile', copyText: 'Every angle', textZone: 'left', kicker: 'Design' },
    { beat: 'offer', role: 'Offer', sceneDesc: 'Bold colour-block frame, price/offer slam, sticker energy', productPose: 'product + price tag', copyText: 'Now 20% off', textZone: 'bottom', kicker: 'Offer' },
    { beat: 'cta', role: 'Call to action', sceneDesc: 'Final hero with logo lockup and a reminder sticker, hold', productPose: 'hero + logo', copyText: 'Shop the drop', textZone: 'bottom', kicker: 'Shop now' },
  ],
  pitch: [
    { beat: 'title', role: 'Title slide', sceneDesc: 'Clean title slide, generous margins, single accent rule', productPose: 'wordmark, top-left', copyText: '{brand}', textZone: 'bottom', kicker: 'Pitch' },
    { beat: 'problem', role: 'Problem', sceneDesc: 'Slide with a bold headline and a supporting sub-point building in', productPose: 'headline slide', copyText: 'The problem is real', textZone: 'top', kicker: 'Problem' },
    { beat: 'solution', role: 'Solution', sceneDesc: 'Slide introducing the solution, simple diagram, one accent', productPose: 'concept diagram', copyText: 'Our solution', textZone: 'top', kicker: 'Solution' },
    { beat: 'traction', role: 'Traction', sceneDesc: 'Slide with one clean growth chart drawing on, axis labels', productPose: 'line chart slide', copyText: 'Growing fast', textZone: 'left', kicker: 'Traction' },
    { beat: 'market', role: 'Market', sceneDesc: 'Market-size slide, stacked stat callouts, consistent footer', productPose: 'stat stack', copyText: '$4B market', textZone: 'right', kicker: 'Market' },
    { beat: 'ask', role: 'The ask', sceneDesc: 'Closing slide with the raise and a confident hold', productPose: 'closing lockup', copyText: 'Raising $2M', textZone: 'bottom', kicker: 'The ask' },
  ],
  app_launch: [
    { beat: 'hook', role: 'Opening hook', sceneDesc: 'Phone frame rises into a dark stage, screen glowing, title above', productPose: 'phone front, centered', copyText: 'Your day, organized', textZone: 'top', kicker: 'New app' },
    { beat: 'screen_1', role: 'Screen walkthrough', sceneDesc: 'First app screen in the phone frame, caption naming the feature', productPose: 'phone, screen A', copyText: 'Plan', textZone: 'right', kicker: 'Feature' },
    { beat: 'screen_2', role: 'Screen walkthrough', sceneDesc: 'Screen swap transition to a second view, floating caption', productPose: 'phone, screen B', copyText: 'Focus', textZone: 'left', kicker: 'Feature' },
    { beat: 'screen_3', role: 'Screen walkthrough', sceneDesc: 'Third screen, motion accent, fast confident swap', productPose: 'phone, screen C', copyText: 'Flow', textZone: 'right', kicker: 'Feature' },
    { beat: 'proof', role: 'Proof / rating', sceneDesc: 'Hero stat or rating, stars, supporting label', productPose: 'rating callout', copyText: '4.9 ★ rated', textZone: 'bottom', kicker: 'Loved' },
    { beat: 'cta', role: 'Download CTA', sceneDesc: 'App icon, store badges, download CTA, final hold', productPose: 'icon + badges', copyText: 'Download now', textZone: 'bottom', kicker: 'Get it' },
  ],
  brand_manifesto: [
    { beat: 'open', role: 'Opening statement', sceneDesc: 'Oversized kinetic type on a saturated colour field, words slamming in', productPose: 'type-only', copyText: 'We believe', textZone: 'none', kicker: 'Manifesto' },
    { beat: 'tension', role: 'Tension line', sceneDesc: 'Colour swap on the beat, a single provocative line', productPose: 'type-only', copyText: 'The old way is broken', textZone: 'none', kicker: '' },
    { beat: 'turn', role: 'The turn', sceneDesc: 'Bold word emphasised in accent, kinetic per-word motion', productPose: 'type + accent word', copyText: 'So we built different', textZone: 'none', kicker: '' },
    { beat: 'vision', role: 'Vision line', sceneDesc: 'Wide statement, generous negative space, calm hold', productPose: 'type-only', copyText: 'For people who make things', textZone: 'none', kicker: '' },
    { beat: 'rally', role: 'Rally line', sceneDesc: 'High-energy colour block, the biggest type of the film', productPose: 'type slam', copyText: 'Make something real', textZone: 'none', kicker: '' },
    { beat: 'lockup', role: 'Brand lockup', sceneDesc: 'Wordmark resolves on a clean field, quiet motto, hold', productPose: 'wordmark', copyText: '{brand}', textZone: 'bottom', kicker: '' },
  ],
}

function fill(text: string, brand: BrandKit): string {
  return text.replace(/\{brand\}/g, brand.logoText || titleFromTone(brand))
}
function titleFromTone(brand: BrandKit): string {
  return brand.logoText || 'Your Brand'
}

let _bid = 0
const bid = () => `frame_${(_bid++).toString(36)}`

function toSlice(b: BeatDef, brand: BrandKit, register: string): FrameSlice {
  const title = fill(b.copyText, brand)
  return {
    id: bid(),
    index: 0,
    beat: b.beat,
    role: b.role,
    sceneDesc: b.sceneDesc,
    productPose: b.productPose,
    copyText: title,
    textZone: b.textZone,
    stub: { register, kicker: b.kicker || brand.logoText || '', title },
  }
}

/**
 * Fit a use case's canonical beats to exactly N frames.
 * - N < beats: keep the most load-bearing beats (head + tail priority), drop middles.
 * - N > beats: duplicate the hero/showcase beat as alternate angles to pad out.
 */
export function fitBeatsToN(useCase: UseCase, n: number, brand: BrandKit): FrameSlice[] {
  const N = Math.max(1, Math.floor(n))
  const beats = GRAMMARS[useCase] || GRAMMARS.saas_explainer
  const register = REGISTER[useCase] || 'product'

  let chosen: BeatDef[]
  if (N === beats.length) {
    chosen = beats
  } else if (N < beats.length) {
    // Always keep the first (hook/title) and last (cta/lockup); fill the middle
    // by sampling evenly across the remaining beats.
    const head = beats[0]
    const tail = beats[beats.length - 1]
    const middleNeeded = N - 2
    if (N <= 1) chosen = [head]
    else if (N === 2) chosen = [head, tail]
    else {
      const pool = beats.slice(1, -1)
      const step = pool.length / (middleNeeded + 1)
      const mids: BeatDef[] = []
      for (let i = 1; i <= middleNeeded; i++) mids.push(pool[Math.min(pool.length - 1, Math.round(i * step) - 1)])
      chosen = [head, ...mids, tail]
    }
  } else {
    // N > beats: pad by repeating the "hero" beat (index 0 for type films, else a
    // showcase/feature beat) as alternate angles before the closing beat.
    const extra = N - beats.length
    const heroIdx = Math.min(1, beats.length - 1) // a showcase/feature beat
    const hero = beats[heroIdx]
    const pad: BeatDef[] = []
    for (let i = 0; i < extra; i++) {
      pad.push({ ...hero, beat: `${hero.beat}_alt${i + 1}`, role: `${hero.role} (angle ${i + 2})` })
    }
    // insert the alternate angles right after the hero beat
    chosen = [...beats.slice(0, heroIdx + 1), ...pad, ...beats.slice(heroIdx + 1)]
  }

  return chosen.slice(0, N).map((b) => toSlice(b, brand, register))
}

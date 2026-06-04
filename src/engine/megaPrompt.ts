// ── Stage C: mega-prompt assembly ───────────────────────────────────────────
// Turns the GenSpec + grid layout into the single prompt the image model gets
// for the ONE storyboard grid image. Block order is FIXED and deliberate:
// the grid directive and consistency contract come first (they constrain the
// whole image), brand/use-case/style set the register, then per-frame slices,
// the product reference, and finally the negatives.
//
// IMPORTANT: this is a STILL-IMAGE prompt. It must hold back all motion and
// timing language — that lives in the video plan (Stage F), never here.

import type { GenSpec } from '../spec'
import { useCaseDef } from '../spec'
import type { GridLayout } from './gridGeometry'

export interface PromptBlock {
  title: string
  body: string
}

export interface MegaPrompt {
  blocks: PromptBlock[]
  text: string
}

const ZONE_LABEL: Record<string, string> = {
  none: 'no text',
  top: 'text in the top band',
  bottom: 'text in the bottom band',
  left: 'text on the left third',
  right: 'text on the right third',
}

export function assembleMegaPrompt(spec: GenSpec, grid: GridLayout): MegaPrompt {
  const { brand, canvas, style, frames } = spec
  const def = useCaseDef(spec.useCase)
  const colors = brand.colors

  const gridDirective =
    `Produce ONE single image: a ${grid.cols}×${grid.rows} storyboard grid of ${frames.length} ` +
    `distinct ${canvas.aspect} panels, read left-to-right, top-to-bottom. ` +
    `Each panel is a self-contained frame. Separate panels with a clean ${Math.round((grid.gutter / grid.cellW) * 100)}% gutter. ` +
    `Do not bleed content between panels; keep each panel's composition fully inside its cell.`

  const consistency =
    `Treat all panels as frames of the SAME film: identical art direction, lighting model, colour grade, ` +
    `lens character and type system across every cell. The same subject must remain recognisably consistent ` +
    `from panel to panel (same product, same brand world). Maintain a single coherent visual identity.`

  const brandBlock =
    `Surface ${colors.surface}; primary ${colors.primary}; secondary ${colors.secondary}` +
    (colors.accent ? `; accent ${colors.accent}` : '') + `. ` +
    `Title type: ${brand.titleFont}. Body type: ${brand.bodyFont}. Tone: ${brand.tone}.` +
    (brand.logoText ? ` Brand wordmark: "${brand.logoText}".` : '') +
    (brand.register ? ` Register: ${brand.register}.` : '')

  const useCaseBlock =
    `${def.title} — ${def.blurb} Commit to the ${def.register} register. ` +
    `Scene grammar should read as a ${spec.useCase.replace(/_/g, ' ')} sequence.`

  const styleBlock =
    `Template: ${style.templateId}. Treatment: ${style.treatment}.` +
    (style.notes ? ` Notes: ${style.notes}.` : '') +
    ` Compose each panel with intentional negative space and a clear focal point.`

  const sliceLines = frames.map((f) => {
    const pos = f.cell ? `[r${f.cell.row + 1}c${f.cell.col + 1}]` : `[${f.index + 1}]`
    const txt = f.textZone === 'none' ? ZONE_LABEL.none : `${ZONE_LABEL[f.textZone]} reading "${f.copyText}"`
    return `${pos} ${f.role}: ${f.sceneDesc}. Product: ${f.productPose}. ${txt}.`
  })
  const slicesBlock = sliceLines.join('\n')

  const productBlock = spec.product.images.length
    ? `Use the ${spec.product.images.length} supplied reference image(s) as the canonical product/subject. ` +
      `Preserve its real geometry, materials and proportions across every panel.` +
      (spec.product.description ? ` Description: ${spec.product.description}.` : '')
    : `No product reference supplied — render a tasteful CSS/3D stand-in consistent with the brand world` +
      (spec.product.description ? `: ${spec.product.description}.` : '.')

  const negatives =
    `No motion blur, no speed lines, no arrows, no timeline, no film strip borders, no panel numbers baked in, ` +
    `no watermark, no captions outside the specified text zones, no mismatched lighting between panels, ` +
    `no duplicated logos, no gibberish text. Avoid clutter; keep each panel clean and on-brand.`

  const blocks: PromptBlock[] = [
    { title: 'GRID DIRECTIVE', body: gridDirective },
    { title: 'CONSISTENCY CONTRACT', body: consistency },
    { title: 'BRAND', body: brandBlock },
    { title: 'USE-CASE', body: useCaseBlock },
    { title: 'VISUAL STYLE', body: styleBlock },
    { title: 'PER-FRAME SLICES', body: slicesBlock },
    { title: 'PRODUCT REFERENCE', body: productBlock },
    { title: 'NEGATIVES', body: negatives },
  ]

  const text = blocks.map((b) => `## ${b.title}\n${b.body}`).join('\n\n')
  return { blocks, text }
}

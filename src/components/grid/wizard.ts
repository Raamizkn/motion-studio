// Shared draft state + helpers for the Storyboard-Grid studio wizard.
import type { UseCase, GridAspect, Pacing, ClipJoin, BrandKit, ProductRef, GenSpec } from '../../spec'
import { compileSpec, defaultBrand, useCaseDef } from '../../spec'
import type { VibeTheme } from '../../data'

export interface Draft {
  useCase: UseCase
  brandThemeId: string // selected theme id ('' = default/custom)
  brand: BrandKit
  product: ProductRef
  aspect: GridAspect
  durationSec: number
  frameCount: number
  treatment: string
  pacing: Pacing
  transitions: ClipJoin[]
  templateId: string
  notes: string
  audioId: string // selected soundtrack id ('' = none)
}

export function initialDraft(useCase: UseCase = 'saas_explainer'): Draft {
  const def = useCaseDef(useCase)
  return {
    useCase,
    brandThemeId: 'midnight',
    brand: defaultBrand(),
    product: { assetIds: [], images: [] },
    aspect: def.suggestedAspect,
    durationSec: 15,
    frameCount: 9,
    treatment: def.suggestedTreatment,
    pacing: def.suggestedPacing,
    transitions: [],
    templateId: def.suggestedTemplateId,
    notes: '',
    audioId: 'cinematic_dark',
  }
}

// Re-seed style suggestions when the style (use case) changes. Keeps brand,
// product and the user's canvas/duration/frames choices — only the hidden
// treatment/pacing/template defaults follow the style.
export function applyUseCase(draft: Draft, useCase: UseCase): Draft {
  const def = useCaseDef(useCase)
  return {
    ...draft,
    useCase,
    treatment: def.suggestedTreatment,
    pacing: def.suggestedPacing,
    templateId: def.suggestedTemplateId,
  }
}

export function buildSpec(draft: Draft): GenSpec {
  return compileSpec({
    useCase: draft.useCase,
    brand: draft.brand,
    product: draft.product,
    aspect: draft.aspect,
    durationSec: draft.durationSec,
    frameCount: draft.frameCount,
    style: {
      templateId: draft.templateId,
      treatment: draft.treatment,
      pacing: draft.pacing,
      transitions: draft.transitions,
      notes: draft.notes,
    },
  })
}

export function themeToBrand(theme: VibeTheme): BrandKit {
  return {
    titleFont: theme.titleFont,
    bodyFont: theme.bodyFont,
    colors: {
      surface: theme.colors.surface,
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      accent: theme.colors.accent || theme.colors.tertiary,
    },
    tone: theme.register,
    register: theme.register,
    logoText: theme.logoText,
  }
}

// Downscale an uploaded image to <= maxPx on its long edge (quota-friendly).
export function downscaleImage(dataUrl: string, maxPx = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      if (scale >= 1) return resolve(dataUrl)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(dataUrl)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.86))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export async function ingestProductFiles(
  files: File[],
  existing: ProductRef['images'],
): Promise<ProductRef['images']> {
  const room = Math.max(0, 4 - existing.length) // cap at 4 product images
  const slice = files.slice(0, room)
  const read = await Promise.all(
    slice.map(
      (f) =>
        new Promise<{ id: string; name: string; dataUrl: string } | null>((resolve) => {
          const reader = new FileReader()
          reader.onload = async () => {
            const small = await downscaleImage(String(reader.result))
            resolve({ id: `asset_${Math.random().toString(36).slice(2, 9)}`, name: f.name, dataUrl: small })
          }
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(f)
        }),
    ),
  )
  return [...existing, ...read.filter(Boolean) as ProductRef['images']]
}

// Tiny hash for deterministic stub colours / picks.
function h32(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function hostFromUrl(url: string): string { try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return url.replace(/^https?:\/\//, '').slice(0, 32) } }
function siteNameFromHost(host: string): string { const base = host.split('.')[0] || 'Brand'; return base.charAt(0).toUpperCase() + base.slice(1) }

// Stub — "fetches" a brand kit from a product URL. Deterministic palette per host.
export function importThemeFromUrlStub(url: string): { name: string; colors: { surface: string; primary: string; secondary: string; accent?: string }; titleFont: string; bodyFont: string; logoText: string } {
  const host = hostFromUrl(url)
  const name = siteNameFromHost(host)
  const seed = h32(host)
  const PAL: string[][] = [
    ['#8a3ffc', '#4e7bff', '#2dd4bf'],
    ['#ec4899', '#8a3ffc', '#3b82f6'],
    ['#ff6b6b', '#ff9f45', '#ffd93d'],
    ['#22c55e', '#3b82f6', '#a855f7'],
    ['#06b6d4', '#8b5cf6', '#f43f5e'],
  ]
  const pick = PAL[seed % PAL.length]
  const FONTS = [['Outfit', 'Inter'], ['Space Grotesk', 'Inter'], ['Source Serif 4', 'DM Sans'], ['Archivo Black', 'Inter']]
  const font = FONTS[(seed >> 5) % FONTS.length]
  return {
    name: `${name} Brand`,
    colors: { surface: '#0a0a0c', primary: '#ffffff', secondary: pick[0], accent: pick[1] },
    titleFont: font[0],
    bodyFont: font[1],
    logoText: name,
  }
}

// Stub — fakes a "scraped" product image as an inline SVG, so it survives offline / static hosting.
export function importProductFromUrlStub(url: string): { id: string; name: string; dataUrl: string } {
  const host = hostFromUrl(url)
  const name = siteNameFromHost(host)
  const seed = h32(host)
  const PAL = [['#8a3ffc', '#4e7bff'], ['#ec4899', '#8a3ffc'], ['#ff6b6b', '#ff9f45'], ['#22c55e', '#3b82f6'], ['#06b6d4', '#8b5cf6']]
  const [a, b] = PAL[seed % PAL.length]
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='200' height='200' fill='${a}' opacity='.18'/><rect x='30' y='40' width='140' height='120' rx='14' fill='url(%23g)'/><text x='100' y='118' text-anchor='middle' font-family='ui-sans-serif,system-ui' font-weight='700' font-size='22' fill='white'>${name}</text></svg>`
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/%2523/g, '%23')}`
  return { id: `asset_${(seed >>> 0).toString(36)}`, name: `${name} (from ${host})`, dataUrl }
}

// Map a brand register string to a TemplatePreview register for live previews.
export function registerForBrand(brand: BrandKit): 'editorial' | 'product' | 'bold' | 'minimal' | 'poster' | 'presentation' | 'infographic' {
  const t = (brand.register || brand.tone || '').toLowerCase()
  if (t.includes('editorial') || t.includes('institutional')) return 'editorial'
  if (t.includes('minimal') || t.includes('luxury')) return 'minimal'
  if (t.includes('playful') || t.includes('consumer')) return 'bold'
  if (t.includes('presentation') || t.includes('deck')) return 'presentation'
  return 'product'
}

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
    frameCount: 6,
    treatment: def.suggestedTreatment,
    pacing: def.suggestedPacing,
    transitions: [],
    templateId: def.suggestedTemplateId,
    notes: '',
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

// Map a brand register string to a TemplatePreview register for live previews.
export function registerForBrand(brand: BrandKit): 'editorial' | 'product' | 'bold' | 'minimal' | 'poster' | 'presentation' | 'infographic' {
  const t = (brand.register || brand.tone || '').toLowerCase()
  if (t.includes('editorial') || t.includes('institutional')) return 'editorial'
  if (t.includes('minimal') || t.includes('luxury')) return 'minimal'
  if (t.includes('playful') || t.includes('consumer')) return 'bold'
  if (t.includes('presentation') || t.includes('deck')) return 'presentation'
  return 'product'
}

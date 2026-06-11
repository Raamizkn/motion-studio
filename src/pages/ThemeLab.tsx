// Dev-only visual harness for the deterministic Theme Kit. Renders every
// built-in theme's thumbnail variants + product preview so the rendering can be
// eyeballed and tuned without clicking through the studio wizard.
// Reachable at /theme-lab — not linked from the product chrome.
import { BUILTIN_THEMES } from '../data'
import type { VibeTheme } from '../data'
import { ThemeThumb, ThemePreviewFrame, fromVibeTheme } from '../components/theme/themeKit'
import type { ThumbVariant } from '../components/theme/themeKit'

// A couple of synthetic user-style themes to exercise odd palettes / fonts.
const EXTRA: VibeTheme[] = [
  { id: 'x1', name: 'Aurora Labs', register: 'modern product / tech', colors: { surface: '#070b14', primary: '#eaf2ff', secondary: '#22d3ee', tertiary: '#6366f1', accent: '#f472b6' }, titleFont: 'Space Grotesk', bodyFont: 'Inter' },
  { id: 'x2', name: 'Greenhouse', register: 'playful / consumer', colors: { surface: '#fbfdf6', primary: '#10241a', secondary: '#16a34a', tertiary: '#84cc16', accent: '#f59e0b' }, titleFont: 'Outfit', bodyFont: 'DM Sans' },
  { id: 'x3', name: 'Helvetica Co', register: 'minimal / luxury', colors: { surface: '#0d0d0d', primary: '#ffffff', secondary: '#ffffff', tertiary: '#6a6a6a', accent: '#c0a062' }, titleFont: 'Helvetica Neue', bodyFont: 'Helvetica Neue' },
  { id: 'x4', name: 'Rosewood', register: 'editorial / institutional', colors: { surface: '#fdf7f4', primary: '#2a1416', secondary: '#b91c1c', tertiary: '#9a3412', accent: '#0f766e' }, titleFont: 'Source Serif 4', bodyFont: 'DM Sans' },
]

const VARIANTS: { id: ThumbVariant; label: string }[] = [
  { id: 'glow-bottom', label: 'Glow · bottom' },
  { id: 'glow-top', label: 'Glow · top' },
  { id: 'glow-side', label: 'Glow · side' },
  { id: 'glow-corner', label: 'Glow · corner' },
  { id: 'glow-spot', label: 'Glow · spotlight' },
  { id: 'blocks', label: 'Mosaic' },
  { id: 'corner', label: 'Corner' },
  { id: 'quadrant', label: 'Quadrant' },
  { id: 'arch', label: 'Arch' },
  { id: 'bauhaus', label: 'Bauhaus' },
  { id: 'diagonal', label: 'Diagonal' },
  { id: 'priority', label: 'Priority bar' },
  { id: 'rail', label: 'Rail' },
  { id: 'columns', label: 'Columns' },
]

const SHAPES: NonNullable<Parameters<typeof ThemePreviewFrame>[0]['meta']>['shape'][] = ['arc', 'blobs', 'panel', 'orbit']
const GLOW_PVS: NonNullable<Parameters<typeof ThemePreviewFrame>[0]['meta']>['glow'][] = ['bottom', 'corner', 'spot', 'side', 'wide']

export function ThemeLab() {
  const themes = [...BUILTIN_THEMES, ...EXTRA]
  const heading: React.CSSProperties = { fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }
  return (
    <div style={{ position: 'fixed', inset: 0, height: '100vh', overflowY: 'auto', background: 'var(--bg)', color: 'var(--text)', padding: 40, fontFamily: 'var(--font)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Theme Kit · Visual Lab</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 36 }}>Deterministic thumbnails + product previews. Colours &amp; fonts are the only variables.</p>

      {/* Thumbnail variants — each row is one design across all themes */}
      {VARIANTS.map((v) => (
        <section key={v.id} style={{ marginBottom: 40 }}>
          <h2 style={heading}>Thumbnail · {v.label}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
            {themes.map((t) => <ThemeThumb key={t.id} theme={fromVibeTheme(t)} variant={v.id} />)}
          </div>
        </section>
      ))}

      <section style={{ marginBottom: 40 }}>
        <h2 style={heading}>Thumbnails @ small (96px) — Priority</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {themes.map((t) => <div key={t.id} style={{ width: 96 }}><ThemeThumb theme={fromVibeTheme(t)} variant="priority" radius={12} /></div>)}
        </div>
      </section>

      {/* Glow previews — glow-thumbnail logic, white airpods seated in the bloom */}
      {GLOW_PVS.map((glow) => (
        <section key={glow} style={{ marginBottom: 40 }}>
          <h2 style={heading}>Glow preview · {glow} · airpods</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 22 }}>
            {themes.map((t) => (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ height: 470, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <ThemePreviewFrame theme={fromVibeTheme(t)} meta={{ durationSec: 15, product: 'airpods', glow }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.name} · {t.titleFont} / {t.bodyFont}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Preview shape variants — big shapes carry the palette */}
      {SHAPES.map((shape) => (
        <section key={shape} style={{ marginBottom: 40 }}>
          <h2 style={heading}>Preview · shape = {shape} · headphones</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 22 }}>
            {themes.map((t) => (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ height: 470, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <ThemePreviewFrame theme={fromVibeTheme(t)} meta={{ durationSec: 15, product: 'headphones', shape }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.name} · {t.titleFont} / {t.bodyFont}</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2 style={heading}>Preview · shape = arc · airpods</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 22 }}>
          {themes.slice(0, 4).map((t) => (
            <div key={t.id} style={{ height: 470, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <ThemePreviewFrame theme={fromVibeTheme(t)} meta={{ durationSec: 15, product: 'airpods', shape: 'arc' }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

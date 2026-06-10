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
  { id: 'strip', label: 'Strip (original)' },
  { id: 'priority', label: 'Priority bar' },
  { id: 'stack', label: 'Stacked deck' },
  { id: 'columns', label: 'Columns' },
  { id: 'blocks', label: 'Mosaic' },
]

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
        <h2 style={heading}>Thumbnails @ small (96px) — Strip</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {themes.map((t) => <div key={t.id} style={{ width: 96 }}><ThemeThumb theme={fromVibeTheme(t)} variant="strip" radius={12} /></div>)}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={heading}>Preview frames · product = headphones</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 22 }}>
          {themes.map((t) => (
            <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ height: 470, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <ThemePreviewFrame theme={fromVibeTheme(t)} meta={{ durationSec: 15, product: 'headphones' }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.name} · {t.titleFont} / {t.bodyFont}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={heading}>Preview frames · product = airpods</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 22 }}>
          {themes.slice(0, 4).map((t) => (
            <div key={t.id} style={{ height: 470, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <ThemePreviewFrame theme={fromVibeTheme(t)} meta={{ durationSec: 15, product: 'airpods' }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

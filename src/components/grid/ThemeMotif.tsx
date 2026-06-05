// Static, designed theme thumbnails — one crafted "frame" per theme, derived
// from the brand-film templates and painted with the theme's own palette + font.
// No animation: these are poster-quality stills.
import type { VibeTheme } from '../../data'

export type MotifKind = 'editorial' | 'product' | 'bold' | 'minimal'

// Which crafted look each builtin theme wears.
export const THEME_MOTIF: Record<string, MotifKind> = {
  editorial: 'editorial',
  midnight: 'product',
  sunrise: 'bold',
  mono: 'minimal',
}

function Spark({ size, color, style }: { size: number; color: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden>
      <path d="M12 0c.7 5.5 2.5 7.3 8 8-5.5.7-7.3 2.5-8 8-.7-5.5-2.5-7.3-8-8 5.5-.7 7.3-2.5 8-8z" />
    </svg>
  )
}

export function ThemeMotif({ theme, kind }: { theme: VibeTheme; kind?: MotifKind }) {
  const k = kind || THEME_MOTIF[theme.id] || 'product'
  const c = theme.colors
  const font = `'${theme.titleFont}', var(--font-display)`
  const name = (theme.logoText || theme.name)
  const accent = c.accent || c.secondary
  const wrap: React.CSSProperties = { position: 'absolute', inset: 0, overflow: 'hidden' }

  // ── Editorial Press — masthead, oversized serif, hairline rules ──
  if (k === 'editorial') {
    return (
      <div style={{ ...wrap, background: c.surface, padding: '13px 14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'var(--font)', fontSize: 7.5, fontWeight: 600, letterSpacing: '.24em', color: c.primary, opacity: .72 }}>
          <span>{name.toUpperCase()}</span><span>Nº 01</span>
        </div>
        <div style={{ height: 1.5, background: c.primary, marginTop: 6 }} />
        <div style={{ height: 1, background: c.primary, opacity: .5, marginTop: 2.5 }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontFamily: font, fontWeight: 600, fontSize: 25, lineHeight: .98, color: c.primary, letterSpacing: '-.015em' }}>
            The art<br />of the <span style={{ color: c.secondary, fontStyle: 'italic' }}>page</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, background: accent, flex: 'none' }} />
          <span style={{ flex: 1, height: 1, background: c.primary, opacity: .26 }} />
          <span style={{ flex: 1, height: 1, background: c.primary, opacity: .26 }} />
        </div>
      </div>
    )
  }

  // ── Midnight Product — dark cinematic, glass card, gradient accent word ──
  if (k === 'product') {
    const grad = `linear-gradient(90deg, ${c.secondary}, ${accent})`
    return (
      <div style={{ ...wrap, background: `radial-gradient(130% 100% at 78% -10%, ${c.secondary}45, transparent 55%), radial-gradient(90% 90% at -10% 110%, ${accent}26, transparent 60%), ${c.surface}` }}>
        <Spark size={12} color={accent} style={{ position: 'absolute', left: '12%', top: '17%' }} />
        <Spark size={7} color={c.secondary} style={{ position: 'absolute', left: '20%', top: '30%', opacity: .8 }} />
        {/* glass UI card */}
        <div style={{ position: 'absolute', right: '9%', top: '15%', width: '46%', borderRadius: 9, background: `${c.primary}10`, border: `1px solid ${c.primary}2e`, boxShadow: '0 12px 30px rgba(0,0,0,.45)', overflow: 'hidden' }}>
          <div style={{ height: 9, background: grad }} />
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ height: 4, width: '72%', borderRadius: 3, background: `${c.primary}33` }} />
            <div style={{ height: 4, width: '46%', borderRadius: 3, background: `${c.primary}1f` }} />
            <div style={{ height: 4, width: '58%', borderRadius: 3, background: `${c.primary}1f` }} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: '11%', right: '10%', bottom: '15%' }}>
          <div style={{ fontFamily: 'var(--font)', fontSize: 7.5, fontWeight: 600, letterSpacing: '.22em', color: c.primary, opacity: .55, marginBottom: 5 }}>{name.toUpperCase()}</div>
          <div style={{ fontFamily: font, fontWeight: 800, fontSize: 21, lineHeight: 1.02, color: c.primary }}>
            Ship it <span style={{ background: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>faster</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Sunrise Bold — warm canvas, sun block, heavy headline with highlight ──
  if (k === 'bold') {
    return (
      <div style={{ ...wrap, background: c.surface }}>
        <div style={{ position: 'absolute', right: '-12%', top: '-26%', width: '46%', aspectRatio: '1', borderRadius: '999px', background: c.tertiary || accent, opacity: .9 }} />
        <div style={{ position: 'absolute', left: '11%', top: '15%', fontFamily: 'var(--font)', fontSize: 7.5, fontWeight: 700, letterSpacing: '.2em', color: c.primary, opacity: .55 }}>{name.toUpperCase()}</div>
        <div style={{ position: 'absolute', left: '11%', top: '34%', fontFamily: font, fontWeight: 900, fontSize: 28, lineHeight: .92, color: c.primary, letterSpacing: '-.02em' }}>
          <span style={{ background: c.secondary, color: c.surface, padding: '0 6px', borderRadius: 6, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>BOLD</span><br />
          <span style={{ position: 'relative' }}>MOVES</span>
        </div>
        <div style={{ position: 'absolute', left: '11%', bottom: '17%', width: 44, height: 4, borderRadius: 999, background: c.tertiary || accent }} />
        <span style={{ position: 'absolute', left: '11%', bottom: '11%', width: 9, height: 9, borderRadius: 999, background: accent }} />
      </div>
    )
  }

  // ── Mono Minimal — vast black, thin gold frame, centered wordmark ──
  return (
    <div style={{ ...wrap, background: `radial-gradient(80% 70% at 50% 120%, ${accent}1a, transparent 70%), ${c.surface}` }}>
      <div style={{ position: 'absolute', inset: 11, border: `1px solid ${accent}59`, borderRadius: 2 }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
        <Spark size={9} color={accent} />
        <div style={{ fontFamily: font, fontWeight: 500, fontSize: 15, letterSpacing: '.28em', color: c.primary, textAlign: 'center', paddingLeft: '.28em' }}>{name.toUpperCase()}</div>
        <div style={{ width: 32, height: 1, background: accent }} />
        <div style={{ fontFamily: 'var(--font)', fontSize: 7, letterSpacing: '.24em', color: c.primary, opacity: .4 }}>EST. MMXXVI</div>
      </div>
    </div>
  )
}

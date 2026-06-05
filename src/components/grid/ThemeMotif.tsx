// Animated theme thumbnails derived from the brand-film templates
// (Gemini · Madison · Spotify · Supahub). Each motif paints with the theme's
// own palette + title font and loops a few subtle CSS animations, so every
// theme card reads as "this is how this theme moves".
import type { VibeTheme } from '../../data'

export type MotifKind = 'gemini' | 'madison' | 'spotify' | 'supahub'

// Which template look each builtin theme wears.
export const THEME_MOTIF: Record<string, MotifKind> = {
  editorial: 'madison',
  midnight: 'supahub',
  sunrise: 'spotify',
  mono: 'gemini',
}

// A 4-point sparkle glyph (the Gemini/Supahub motif).
function Spark({ size, color, style }: { size: number; color: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden>
      <path d="M12 0c.7 5.5 2.5 7.3 8 8-5.5.7-7.3 2.5-8 8-.7-5.5-2.5-7.3-8-8 5.5-.7 7.3-2.5 8-8z" />
    </svg>
  )
}

export function ThemeMotif({ theme, kind }: { theme: VibeTheme; kind?: MotifKind }) {
  const k = kind || THEME_MOTIF[theme.id] || 'supahub'
  const c = theme.colors
  const font = `'${theme.titleFont}', var(--font-display)`
  const name = theme.logoText || theme.name
  const accent = c.accent || c.secondary
  const wrap: React.CSSProperties = { position: 'absolute', inset: 0, overflow: 'hidden' }

  if (k === 'supahub') {
    // dark gradient world · twinkling sparkle · drifting integration pills
    const grad = `linear-gradient(90deg, ${c.secondary}, ${accent}, ${c.tertiary || c.secondary})`
    return (
      <div style={{ ...wrap, background: `radial-gradient(120% 90% at 30% 0%, ${c.secondary}33, transparent 60%), ${c.surface}` }}>
        <Spark size={16} color={accent} style={{ position: 'absolute', left: '11%', top: '20%', animation: 'tmf-tw 2.4s ease-in-out infinite' }} />
        <Spark size={9} color={c.secondary} style={{ position: 'absolute', right: '16%', top: '30%', animation: 'tmf-tw 2.4s ease-in-out .8s infinite' }} />
        <div style={{ position: 'absolute', left: '11%', top: '46%', right: '11%' }}>
          <div style={{ fontFamily: font, fontWeight: 800, fontSize: 21, lineHeight: 1.04, color: c.primary }}>
            Ship it <span style={{ background: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>faster</span>
          </div>
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: 'absolute', bottom: `${16 + i * 16}%`, left: `${18 + i * 26}%`, width: 30, height: 11, borderRadius: 999, background: `${c.primary}14`, border: `1px solid ${accent}55`, animation: `tmf-drift 3.${4 + i}s ease-in-out ${i * 0.4}s infinite` }} />
        ))}
      </div>
    )
  }

  if (k === 'gemini') {
    // calm, lots of negative space · soft center glow · single sparkle (Mono fits)
    return (
      <div style={{ ...wrap, background: `radial-gradient(90% 70% at 50% 60%, ${accent}1f, transparent 70%), ${c.surface}` }}>
        <Spark size={13} color={accent} style={{ position: 'absolute', left: '50%', top: '26%', transform: 'translateX(-50%)', animation: 'tmf-tw 3s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '44%', textAlign: 'center', fontFamily: font, fontWeight: 600, letterSpacing: '.14em', fontSize: 16, color: c.primary }}>
          {name.toUpperCase()}
        </div>
        <div style={{ position: 'absolute', left: '50%', bottom: '26%', transform: 'translateX(-50%)', height: 1.5, background: accent, animation: 'tmf-build 3s ease-in-out infinite' }} />
      </div>
    )
  }

  if (k === 'spotify') {
    // full-bleed flat field that flips surface↔brand · huge headline (Sunrise)
    return (
      <div style={{ ...wrap, background: c.surface }}>
        <div style={{ position: 'absolute', inset: 0, background: c.secondary, animation: 'tmf-flip 3.2s steps(1,end) infinite' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: '12%', textAlign: 'center', fontFamily: font, fontWeight: 700, fontSize: 9, letterSpacing: '.12em', color: c.primary, mixBlendMode: 'difference' }}>
          {name.toUpperCase()}
        </div>
        <div style={{ position: 'absolute', left: '10%', right: '10%', top: '38%', fontFamily: font, fontWeight: 900, fontSize: 27, lineHeight: .96, color: '#fff', mixBlendMode: 'difference', animation: 'tmf-pop 3.2s ease-in-out infinite' }}>
          BOLD<br />MOVES
        </div>
      </div>
    )
  }

  // madison — bright canvas · clean UI card rising · floating chips · accent wordmark (Editorial)
  return (
    <div style={{ ...wrap, background: c.surface }}>
      <div style={{ position: 'absolute', left: '12%', top: '20%', right: '12%', height: '46%', borderRadius: 8, background: '#fff', boxShadow: `0 6px 16px ${c.primary}1a`, border: `1px solid ${c.primary}14`, animation: 'tmf-rise 3.4s ease-in-out infinite', overflow: 'hidden' }}>
        <div style={{ height: 9, background: c.secondary }} />
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ height: 5, width: '70%', borderRadius: 3, background: `${c.primary}22` }} />
          <div style={{ height: 5, width: '50%', borderRadius: 3, background: `${c.primary}14` }} />
        </div>
      </div>
      {[0, 1].map((i) => (
        <div key={i} style={{ position: 'absolute', top: `${22 + i * 40}%`, right: `${6 + i * 2}%`, width: 16, height: 16, borderRadius: 999, background: i ? accent : c.secondary, animation: `tmf-drift 3.${5 + i}s ease-in-out ${i * 0.5}s infinite` }} />
      ))}
      <div style={{ position: 'absolute', left: '12%', bottom: '12%', fontFamily: font, fontWeight: 700, fontSize: 18, color: c.primary }}>
        {name.split(' ')[0]} <span style={{ color: c.secondary }}>{name.split(' ')[1] || ''}</span>
      </div>
    </div>
  )
}

import type { TransitionKind } from '../types'

/** Small looping CSS animation previewing a transition style. */
export function TransitionTile({
  kind,
  label,
  active,
  onClick,
}: {
  kind: TransitionKind
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: 5,
        padding: 7,
        width: 56,
        borderRadius: 9,
        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        transition: 'all .15s',
      }}
    >
      <div className={`tt tt-${kind}`}>
        <span className="tt-a" />
        <span className="tt-b" />
      </div>
      <span style={{ fontSize: 10.5, color: active ? 'var(--text)' : 'var(--text-3)' }}>{label}</span>
      <style>{`
        .tt{position:relative;width:34px;height:20px;border-radius:4px;overflow:hidden;background:#0a0a0c}
        .tt .tt-a,.tt .tt-b{position:absolute;inset:0}
        .tt-a{background:linear-gradient(135deg,#7c5cff,#c44bff)}
        .tt-b{background:linear-gradient(135deg,#2dd4bf,#3b82f6)}
        .tt-cut .tt-b{animation:ttcut 1.6s steps(1) infinite}
        @keyframes ttcut{0%,49%{opacity:0}50%,100%{opacity:1}}
        .tt-fade .tt-b{animation:ttfade 1.8s ease-in-out infinite}
        @keyframes ttfade{0%,40%{opacity:0}60%,100%{opacity:1}}
        .tt-slide .tt-b{animation:ttslide 1.8s var(--ease) infinite}
        @keyframes ttslide{0%,30%{transform:translateX(100%)}55%,100%{transform:translateX(0)}}
        .tt-wipe .tt-b{animation:ttwipe 1.8s var(--ease) infinite}
        @keyframes ttwipe{0%,30%{clip-path:inset(0 100% 0 0)}55%,100%{clip-path:inset(0 0 0 0)}}
        .tt-zoom .tt-b{animation:ttzoom 1.8s var(--ease) infinite}
        @keyframes ttzoom{0%,30%{transform:scale(0);opacity:0}55%,100%{transform:scale(1);opacity:1}}
      `}</style>
    </button>
  )
}

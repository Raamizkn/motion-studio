import { useEffect, type ReactNode } from 'react'
import type { ProjectStatus } from '../types'
import { Icon } from './Icon'

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
    setup: { label: 'Draft', color: 'var(--text-2)', bg: 'var(--surface-2)' },
    storyboard_ready: { label: 'Storyboard', color: '#c8b3ff', bg: 'var(--accent-soft)' },
    rendering: { label: 'Rendering', color: 'var(--amber)', bg: 'rgba(242,184,78,.14)' },
    complete: { label: 'Complete', color: 'var(--green)', bg: 'rgba(58,210,127,.14)' },
    error: { label: 'Error', color: 'var(--red)', bg: 'rgba(255,93,93,.14)' },
  }
  const s = map[status]
  return (
    <span
      className="badge"
      style={{ color: s.color, background: s.bg, height: 20, fontSize: 10.5, letterSpacing: '.03em' }}
    >
      {s.label}
    </span>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 520,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeUp .2s ease',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="card"
        style={{
          width,
          maxWidth: '92vw',
          maxHeight: '88vh',
          background: 'var(--bg-elev)',
          boxShadow: 'var(--shadow-lg)',
          borderColor: 'var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn .22s var(--ease)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>
          <button className="btn icon sm ghost" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div style={{ padding: 18, overflow: 'auto' }}>{children}</div>
        {footer && (
          <footer
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              padding: '14px 18px',
              borderTop: '1px solid var(--border)',
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            height: 28,
            padding: '0 12px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: value === o.value ? 'var(--text)' : 'var(--text-3)',
            background: value === o.value ? 'var(--surface-3)' : 'transparent',
            transition: 'all .15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ pct, glow }: { pct: number; glow?: boolean }) {
  return (
    <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, pct))}%`,
          background: 'var(--accent-grad)',
          borderRadius: 99,
          transition: 'width .4s var(--ease)',
          boxShadow: glow ? '0 0 16px var(--accent-glow)' : 'none',
        }}
      />
    </div>
  )
}

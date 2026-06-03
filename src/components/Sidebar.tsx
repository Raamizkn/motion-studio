import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from './Icon'

const NAV_ITEMS = [
  { icon: 'home',      label: 'Home',    to: '/home' },
  { icon: 'apps',      label: 'Apps',    to: '/apps' },
]

const TOOL_ITEMS = [
  { icon: 'image',     label: 'Image',   to: '/image' },
  { icon: 'video',     label: 'Video',   to: '/video' },
  { icon: 'motion',    label: 'Flows',   to: '/studio' },   // Motion Studio = Flows
  { icon: 'edit',      label: 'Edit',    to: '/edit' },
  { icon: 'audio',     label: 'Lipsync', to: '/lipsync' },
  { icon: 'upscale',   label: 'Upscale', to: '/upscale' },
  { icon: 'film',      label: 'Editor',  to: '/film' },
]

const BOTTOM_ITEMS = [
  { icon: 'assets',    label: 'Tools',   to: '/tools' },
  { icon: 'community', label: 'Explore', to: '/community' },
]

function NavItem({
  icon,
  label,
  to,
  disabled,
}: {
  icon: string
  label: string
  to: string
  disabled?: boolean
}) {
  return (
    <NavLink
      to={to}
      onClick={(e) => disabled && e.preventDefault()}
      className={({ isActive }) => `vm-nav-item${isActive && !disabled ? ' active' : ''}`}
      style={{ opacity: disabled ? 0.45 : 1 }}
      title={label}
    >
      <span className="vm-nav-icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="vm-nav-label">{label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="vm-sidebar">
      <style>{`
        .vm-sidebar {
          width: 72px;
          flex: none;
          height: 100%;
          background: var(--bg-elev);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 4px 16px;
          gap: 8px;
          overflow: hidden;
          z-index: 10;
        }

        /* Logo */
        .vm-logo {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          flex: none;
          margin-bottom: 4px;
          cursor: pointer;
        }
        .vm-logo-inner {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: var(--accent-grad);
          display: grid;
          place-items: center;
          box-shadow: 0 0 16px var(--accent-glow);
        }

        /* Separator */
        .vm-sep {
          width: 24px;
          height: 1px;
          background: var(--border-strong);
          border-radius: 999px;
          flex: none;
        }

        /* Nav item */
        .vm-nav-item {
          width: 64px;
          min-height: 58px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          padding: 0 8px 4px;
          gap: 2px;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.14s;
          flex: none;
          align-self: stretch;
        }
        .vm-nav-item:hover .vm-nav-icon {
          background: var(--surface-2);
        }
        .vm-nav-item.active .vm-nav-icon {
          background: var(--surface-3);
          border: 1px solid var(--border-strong);
          box-shadow: 0 0 4px rgba(138,63,252,0.12);
        }

        /* Icon box */
        .vm-nav-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          color: var(--text-2);
          transition: background 0.14s, border-color 0.14s;
          flex: none;
          border: 1px solid transparent;
        }
        .vm-nav-item.active .vm-nav-icon {
          color: var(--text);
        }

        /* Label */
        .vm-nav-label {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 400;
          line-height: 16px;
          letter-spacing: 0.03em;
          color: var(--text-3);
          text-align: center;
          width: 48px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vm-nav-item.active .vm-nav-label {
          color: var(--text-2);
        }

        /* Spacer */
        .vm-spacer { flex: 1; }

        /* Bottom fade */
        .vm-bottom-fade {
          position: absolute;
          bottom: 0;
          left: 4px;
          width: 64px;
          height: 64px;
          background: linear-gradient(0deg, var(--bg-elev) 34%, transparent 100%);
          pointer-events: none;
        }
      `}</style>

      {/* Logo */}
      <div className="vm-logo">
        <div className="vm-logo-inner">
          <Icon name="sparkle" size={16} style={{ color: '#fff' }} />
        </div>
      </div>

      {NAV_ITEMS.map((item) => (
        <NavItem key={item.label} {...item} disabled={item.to !== '/studio' && item.to !== '/home'} />
      ))}

      <div className="vm-sep" />

      {TOOL_ITEMS.map((item) => (
        <NavItem key={item.label} {...item} disabled={item.to !== '/studio'} />
      ))}

      <div className="vm-sep" />

      {BOTTOM_ITEMS.map((item) => (
        <NavItem key={item.label} {...item} disabled />
      ))}

      <div className="vm-spacer" />
      <div className="vm-bottom-fade" />
    </aside>
  )
}

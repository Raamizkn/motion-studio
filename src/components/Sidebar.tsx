import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Icon } from './Icon'

const TOOLS = [
  { icon: 'image', label: 'Image', to: '/image' },
  { icon: 'video', label: 'Video', to: '/video' },
  { icon: 'audio', label: 'Audio', to: '/audio' },
  { icon: 'edit', label: 'Edit', to: '/edit' },
  { icon: 'upscale', label: 'Upscale', to: '/upscale' },
  { icon: 'film', label: 'Film studio', to: '/film' },
  { icon: 'ad', label: 'Ad studio', to: '/ad' },
]

export function Sidebar() {
  const loc = useLocation()
  const [seenNew, setSeen] = useState(() => localStorage.getItem('ms-seen-new') === '1')

  const studioActive = loc.pathname.startsWith('/studio')

  const Item = ({ icon, label, to, disabled }: { icon: string; label: string; to: string; disabled?: boolean }) => (
    <NavLink
      to={to}
      onClick={(e) => disabled && e.preventDefault()}
      className="nav-item"
      style={({ isActive }) => ({
        opacity: disabled ? 0.55 : 1,
        background: isActive && !disabled ? 'var(--surface-2)' : 'transparent',
        color: isActive && !disabled ? 'var(--text)' : 'var(--text-2)',
      })}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </NavLink>
  )

  return (
    <aside className="sidebar">
      <style>{`
        .sidebar{width:var(--sidebar-w);flex:none;height:100%;border-right:1px solid var(--border);
          background:var(--bg-elev);display:flex;flex-direction:column;padding:14px 12px;gap:4px;overflow-y:auto}
        .nav-item{display:flex;align-items:center;gap:11px;height:36px;padding:0 11px;border-radius:9px;
          font-size:13.5px;font-weight:500;transition:all .14s;color:var(--text-2)}
        .nav-item:hover{background:var(--surface);color:var(--text)}
        .nav-label{font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
          color:var(--text-4);padding:14px 11px 5px}
        .brand{display:flex;align-items:center;gap:9px;padding:4px 8px 12px;font-weight:700;font-size:15px}
        .ws{display:flex;align-items:center;gap:9px;height:42px;padding:0 10px;border-radius:11px;
          background:var(--surface);border:1px solid var(--border);margin-bottom:6px;cursor:pointer}
      `}</style>

      <div className="brand">
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: 'var(--accent-grad)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}
        >
          <Icon name="sparkle" size={15} style={{ color: '#fff' }} />
        </div>
        ImagineArt
      </div>

      <div className="ws">
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#c44bff,#7c5cff)' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>ImagineCreative</span>
        <Icon name="chevDown" size={14} style={{ marginLeft: 'auto', color: 'var(--text-3)' }} />
      </div>

      <Item icon="home" label="Home" to="/home" />
      <Item icon="assets" label="Assets" to="/assets" />
      <Item icon="search" label="Search" to="/search" />

      <div className="nav-label">Tools</div>
      {TOOLS.map((t) => (
        <Item key={t.label} {...t} disabled />
      ))}

      {/* ── Motion Studio — the new feature ── */}
      <NavLink
        to="/studio"
        onClick={() => {
          localStorage.setItem('ms-seen-new', '1')
          setSeen(true)
        }}
        className="nav-item"
        style={{
          background: studioActive ? 'var(--accent-soft)' : 'transparent',
          color: studioActive ? '#fff' : 'var(--text)',
          border: studioActive ? '1px solid rgba(124,92,255,.35)' : '1px solid transparent',
          fontWeight: 600,
        }}
      >
        <Icon name="motion" size={18} style={{ color: 'var(--accent-2)' }} />
        <span>Motion Studio</span>
        {!seenNew && <span className="badge new" style={{ marginLeft: 'auto' }}>New</span>}
      </NavLink>

      <div className="nav-label">Apps</div>
      <Item icon="apps" label="All Tools" to="/apps" disabled />
      <Item icon="community" label="Community" to="/community" disabled />

      <div style={{ marginTop: 'auto', display: 'flex', gap: 6, padding: '12px 6px 4px', color: 'var(--text-3)' }}>
        <Icon name="settings" size={17} />
        <Icon name="bell" size={17} />
        <Icon name="assets" size={17} />
      </div>
    </aside>
  )
}

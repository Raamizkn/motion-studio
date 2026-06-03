import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { ProjectSetup } from './pages/ProjectSetup'
import { FlowSetup } from './pages/FlowSetup'
import { StoryboardEditor } from './pages/StoryboardEditor'
import { VideoEditor } from './pages/VideoEditor'
import { Icon } from './components/Icon'
import { Link } from 'react-router-dom'

function TopNav() {
  return (
    <header className="vm-topnav">
      <style>{`
        .vm-topnav {
          height: 64px;
          flex: none;
          width: 100%;
          background: var(--bg-elev);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: flex-start;
          padding: 16px 16px 4px;
          gap: 8px;
        }

        /* Left cluster */
        .vm-topnav-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .vm-all-creations {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 6px 10px;
          background: var(--surface-2);
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
          letter-spacing: 0.03em;
          transition: background 0.14s;
          white-space: nowrap;
        }
        .vm-all-creations:hover { background: var(--surface-3); }

        .vm-topnav-sep {
          width: 1px;
          height: 16px;
          background: var(--border-strong);
          border-radius: 999px;
        }

        /* Segmented control */
        .vm-seg {
          display: flex;
          align-items: center;
          padding: 3px;
          gap: 4px;
          background: var(--surface);
          border-radius: 12px;
        }
        .vm-seg-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 26px;
          padding: 4px 12px;
          border-radius: 40px;
          border: none;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: var(--text-3);
          background: transparent;
          transition: background 0.14s, color 0.14s;
          white-space: nowrap;
          font-family: 'Inter', sans-serif;
        }
        .vm-seg-btn:hover { color: var(--text-2); }
        .vm-seg-btn.active {
          background: rgba(138, 63, 252, 0.18);
          color: var(--accent-2);
        }

        /* Right cluster */
        .vm-topnav-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 4px 0 8px;
        }
        .vm-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          border: none;
          cursor: pointer;
          color: var(--text-2);
          background: transparent;
          transition: background 0.14s;
        }
        .vm-icon-btn:hover { background: var(--surface-2); }

        .vm-upgrade-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 6px 10px;
          background: rgba(138, 63, 252, 0.15);
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 500;
          color: var(--accent-2);
          letter-spacing: 0.03em;
          transition: background 0.14s;
        }
        .vm-upgrade-btn:hover { background: rgba(138, 63, 252, 0.24); }

        .vm-personal-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 32px;
          padding: 6px 10px;
          border: 1px solid var(--border-strong);
          border-radius: 12px;
          background: transparent;
          cursor: pointer;
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
          letter-spacing: 0.03em;
          transition: border-color 0.14s;
        }
        .vm-personal-btn:hover { border-color: var(--border-strong); background: var(--surface); }

        .vm-avatar {
          width: 32px;
          height: 32px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #c44bff, #7c5cff);
          border: 1px solid var(--border-strong);
          flex: none;
        }
      `}</style>

      {/* Left */}
      <div className="vm-topnav-left">
        <button className="vm-all-creations">
          <Icon name="assets" size={16} />
          All creations
          <Icon name="chevDown" size={16} />
        </button>
        <div className="vm-topnav-sep" />
        <div className="vm-seg">
          <button className="vm-seg-btn">Standard</button>
          <button className="vm-seg-btn active">
            <Icon name="sparkle" size={14} />
            Assist
          </button>
          <button className="vm-seg-btn">Apps</button>
        </div>
      </div>

      {/* Right */}
      <div className="vm-topnav-right">
        <button className="vm-icon-btn" aria-label="Search">
          <Icon name="search" size={18} />
        </button>
        <button className="vm-upgrade-btn">
          <Icon name="sparkle" size={16} />
          Upgrade
        </button>
        <button className="vm-personal-btn">
          <div className="vm-avatar" />
          Personal
          <Icon name="chevDown" size={16} />
        </button>
        <button className="vm-icon-btn" aria-label="Feedback">
          <Icon name="bell" size={18} />
        </button>
        <button className="vm-icon-btn" aria-label="Notifications">
          <Icon name="bell" size={18} />
        </button>
        <div className="vm-avatar" />
      </div>
    </header>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <TopNav />
        <main style={{ flex: 1, overflow: 'auto', position: 'relative' }}>{children}</main>
      </div>
    </div>
  )
}

function Placeholder() {
  const loc = useLocation()
  const name = loc.pathname.replace('/', '') || 'page'
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        color: 'var(--text-3)',
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, textTransform: 'capitalize' }}>
          {name}
        </div>
        <p style={{ marginBottom: 18 }}>This area is part of the existing Imagine Art platform.</p>
        <Link to="/studio" className="btn primary" style={{ display: 'inline-flex' }}>
          <Icon name="motion" size={16} /> Open Motion Studio
        </Link>
      </div>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/studio" replace />} />
        <Route path="/studio" element={<Shell><Dashboard /></Shell>} />
        {/* Flow-specific creation screens */}
        <Route path="/studio/create/:flow" element={<Shell><FlowSetup /></Shell>} />
        {/* Generic new project (legacy / advanced) */}
        <Route path="/studio/new" element={<Shell><ProjectSetup /></Shell>} />
        <Route path="/studio/projects/:id/storyboard" element={<Shell><StoryboardEditor /></Shell>} />
        {/* Editor is full-screen — no shell */}
        <Route path="/studio/projects/:id/editor" element={<VideoEditor />} />
        <Route path="*" element={<Shell><Placeholder /></Shell>} />
      </Routes>
    </BrowserRouter>
  )
}

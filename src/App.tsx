import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { ProjectSetup } from './pages/ProjectSetup'
import { StoryboardEditor } from './pages/StoryboardEditor'
import { VideoEditor } from './pages/VideoEditor'
import { Icon } from './components/Icon'
import { Link } from 'react-router-dom'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar />
      <main style={{ flex: 1, height: '100%', overflow: 'auto', position: 'relative' }}>{children}</main>
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
        <Route path="/studio/new" element={<Shell><ProjectSetup /></Shell>} />
        <Route path="/studio/projects/:id/storyboard" element={<Shell><StoryboardEditor /></Shell>} />
        {/* Editor is full-screen — no sidebar */}
        <Route path="/studio/projects/:id/editor" element={<VideoEditor />} />
        <Route path="*" element={<Shell><Placeholder /></Shell>} />
      </Routes>
    </BrowserRouter>
  )
}

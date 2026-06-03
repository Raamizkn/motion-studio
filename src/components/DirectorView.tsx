import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * The Vibe Motion "director" workspace shell, matching the ImagineArt V-3 spec:
 *   ┌──────────────┬────────────────────────────┬─────────────┐
 *   │ assist panel │  video stage (canvas)       │  drawer     │
 *   │ 360px #171717│  + timeline below           │ (collapses) │
 *   └──────────────┴────────────────────────────┴─────────────┘
 * Sits inside <main> (Sidebar + TopNav are provided by the app Shell).
 */

export function VibeAssistPanel({
  children,
  footer,
  title = 'Vibe Motion',
}: {
  children: ReactNode
  footer?: ReactNode
  title?: string
}) {
  return (
    <aside className="dv-assist">
      <style>{`
        .dv-assist {
          width: 384px; flex: none; height: 100%;
          padding: 24px 16px 16px 8px;
          display: flex;
        }
        .dv-assist-frame {
          flex: 1; display: flex; flex-direction: column;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: var(--r-panel);
          box-shadow: 0 2px 4px rgba(0,0,0,0.16);
          overflow: hidden;
        }
        .dv-assist-head {
          height: 64px; flex: none;
          display: flex; align-items: center; gap: 8px;
          padding: 0 16px;
          border-bottom: 1px solid var(--border);
        }
        .dv-assist-title {
          flex: 1; font-family: var(--font-display); font-weight: 500;
          font-size: 16px; color: var(--text); letter-spacing: 0.01em;
        }
        .dv-hbtn {
          width: 32px; height: 32px; border-radius: 999px;
          border: 1px solid var(--border-strong); background: transparent;
          color: var(--text-2); cursor: pointer; display: grid; place-items: center;
          transition: background .14s;
        }
        .dv-hbtn:hover { background: var(--surface); }
        .dv-hbtn.solid { background: var(--surface-3); border-color: transparent; }
        .dv-assist-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
        .dv-assist-foot { flex: none; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      `}</style>
      <div className="dv-assist-frame">
        <div className="dv-assist-head">
          <span className="dv-assist-title">{title}</span>
          <button className="dv-hbtn" aria-label="New"><Icon name="plus" size={16} /></button>
          <button className="dv-hbtn" aria-label="History"><Icon name="undo" size={16} /></button>
          <button className="dv-hbtn solid" aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="dv-assist-body">{children}</div>
        {footer && <div className="dv-assist-foot">{footer}</div>}
      </div>
    </aside>
  )
}

export function DirectorView({
  assist,
  assistFooter,
  stage,
  timeline,
  drawer,
  drawerTitle = 'Layers',
}: {
  assist: ReactNode
  assistFooter?: ReactNode
  stage: ReactNode
  timeline?: ReactNode
  drawer?: ReactNode
  drawerTitle?: string
}) {
  const [drawerOpen, setDrawerOpen] = useState(true)
  return (
    <div className="dv-root">
      <style>{`
        .dv-root { display: flex; height: 100%; width: 100%; background: var(--bg); overflow: hidden; }
        .dv-center {
          flex: 1; min-width: 0; height: 100%;
          display: flex; flex-direction: column;
          padding: 24px 8px 16px;
          gap: 16px;
        }
        .dv-stage {
          flex: 1; min-height: 0;
          display: flex; align-items: center; justify-content: center;
          position: relative;
        }
        .dv-stage-inner {
          width: 100%; height: 100%;
          border-radius: var(--r-lg);
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
        }
        .dv-timeline-wrap { flex: none; }
        .dv-drawer-col { display: flex; height: 100%; padding: 24px 16px 16px 0; }
        .dv-drawer {
          width: 320px; flex: none; display: flex; flex-direction: column;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: var(--r-panel);
          box-shadow: 0 2px 4px rgba(0,0,0,0.16);
          overflow: hidden;
        }
        .dv-drawer-head {
          height: 56px; flex: none; display: flex; align-items: center; justify-content: space-between;
          padding: 0 16px; border-bottom: 1px solid var(--border);
          font-family: var(--font-display); font-weight: 500; font-size: 15px; color: var(--text);
        }
        .dv-drawer-body { flex: 1; overflow-y: auto; padding: 12px; }
        .dv-drawer-tab {
          align-self: center; margin: auto 0;
          width: 28px; height: 56px; border-radius: 12px 0 0 12px;
          background: var(--bg-elev); border: 1px solid var(--border); border-right: none;
          color: var(--text-2); cursor: pointer; display: grid; place-items: center;
        }
      `}</style>

      <VibeAssistPanel footer={assistFooter}>{assist}</VibeAssistPanel>

      <div className="dv-center">
        <div className="dv-stage"><div className="dv-stage-inner">{stage}</div></div>
        {timeline && <div className="dv-timeline-wrap">{timeline}</div>}
      </div>

      {drawer && (
        drawerOpen ? (
          <div className="dv-drawer-col">
            <div className="dv-drawer">
              <div className="dv-drawer-head">
                {drawerTitle}
                <button className="dv-hbtn" onClick={() => setDrawerOpen(false)} aria-label="Collapse" style={{ width: 28, height: 28, border: 'none' }}>
                  <Icon name="chevRight" size={16} />
                </button>
              </div>
              <div className="dv-drawer-body">{drawer}</div>
            </div>
          </div>
        ) : (
          <button className="dv-drawer-tab" onClick={() => setDrawerOpen(true)} aria-label="Expand layers">
            <Icon name="chevLeft" size={16} />
          </button>
        )
      )}
    </div>
  )
}

/* shimmer skeleton block */
export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ borderRadius: 12, background: 'linear-gradient(100deg, var(--surface) 30%, var(--surface-2) 50%, var(--surface) 70%)', backgroundSize: '200% 100%', animation: 'dv-shimmer 1.4s ease-in-out infinite', ...style }}>
      <style>{`@keyframes dv-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  )
}

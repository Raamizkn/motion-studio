import { useRef, useState } from 'react'
import { useStore } from '../store'
import { BUILTIN_THEMES } from '../data'
import type { VibeTheme } from '../data'
import { Icon } from './Icon'

/* ── Theme palette strips (4 swatches across the bottom of a card) ─────────── */
function PaletteStrips({ theme }: { theme: VibeTheme }) {
  const c = theme.colors
  const strips = [c.primary, c.secondary, c.tertiary || c.accent || c.secondary, c.accent || c.primary]
  return (
    <div style={{ display: 'flex', position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%' }}>
      {strips.map((s, i) => (
        <div key={i} style={{ flex: 1, height: 6, background: s }} />
      ))}
    </div>
  )
}

/* ── Themes popover: cards grid + "Create New" → opens the modal ───────────── */
export function ThemePicker({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const userThemes = useStore((s) => s.userThemes)
  const deleteTheme = useStore((s) => s.deleteTheme)
  const [modalOpen, setModalOpen] = useState(false)
  const all = [...userThemes, ...BUILTIN_THEMES]

  return (
    <>
      <div className="ts-pop">
        <style>{`
          .ts-pop {
            width: 328px;
            background: var(--bg-elev);
            border: 1px solid var(--border-strong);
            border-radius: var(--r-xl);
            box-shadow: var(--shadow-pop);
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-height: 420px;
          }
          .ts-pop-head { display: flex; align-items: center; justify-content: space-between; }
          .ts-pop-title { font-family: var(--font-display); font-size: 22px; font-weight: 600; color: var(--text); }
          .ts-grid { display: flex; flex-wrap: wrap; gap: 8px; overflow-y: auto; }
          .ts-card {
            position: relative;
            width: 93px; height: 72px;
            background: var(--surface);
            border: 1px solid transparent;
            border-radius: 8px;
            cursor: pointer;
            overflow: hidden;
            transition: border-color .14s;
          }
          .ts-card:hover { border-color: var(--border-strong); }
          .ts-card.active { border-color: var(--accent); }
          .ts-card-meta { position: absolute; left: 8px; top: 24px; display: flex; flex-direction: column; gap: 2px; }
          .ts-card-font { font-size: 11px; color: var(--text-3); }
          .ts-card-name { font-size: 12px; font-weight: 500; color: var(--text); }
          .ts-create {
            display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-end;
          }
          .ts-create-btn {
            position: absolute; left: 6px; top: 6px;
            width: 26px; height: 26px; border-radius: 999px;
            display: grid; place-items: center;
            background: var(--surface-3); border: none; color: var(--text); cursor: pointer;
          }
          .ts-card-menu {
            position: absolute; right: 4px; top: 4px;
            width: 22px; height: 22px; border-radius: 999px; border: none;
            background: rgba(0,0,0,.35); color: var(--text-2); cursor: pointer;
            display: none; place-items: center; font-size: 13px;
          }
          .ts-card:hover .ts-card-menu { display: grid; }
        `}</style>

        <div className="ts-pop-head">
          <span className="ts-pop-title">Themes</span>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: 999, border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="close" size={16} /></button>
        </div>

        <div className="ts-grid">
          {/* Create New */}
          <div className="ts-card ts-create" onClick={() => setModalOpen(true)} title="Create new theme">
            <button className="ts-create-btn" aria-label="Create new"><Icon name="plus" size={14} /></button>
            <div className="ts-card-meta"><span className="ts-card-name">Create New</span></div>
            <div style={{ display: 'flex', position: 'absolute', bottom: 0, width: '100%' }}>
              {['#2e2e2e', '#212121', '#2a2a2a', '#2e2e2e'].map((s, i) => <div key={i} style={{ flex: 1, height: 6, background: s }} />)}
            </div>
          </div>

          {all.map((t) => (
            <div
              key={t.id}
              className={`ts-card${selectedId === t.id ? ' active' : ''}`}
              onClick={() => { onSelect(t.id); onClose() }}
            >
              {!t.builtin && (
                <button
                  className="ts-card-menu"
                  onClick={(e) => { e.stopPropagation(); deleteTheme(t.id); if (selectedId === t.id) onSelect('') }}
                  aria-label="Delete theme"
                >×</button>
              )}
              <div className="ts-card-meta">
                <span className="ts-card-font">{t.titleFont}</span>
                <span className="ts-card-name">{t.name}</span>
              </div>
              <PaletteStrips theme={t} />
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <ThemeModal
          onClose={() => setModalOpen(false)}
          onSaved={(t) => { setModalOpen(false); onSelect(t.id); onClose() }}
        />
      )}
    </>
  )
}

/* ── Create New Theme modal ────────────────────────────────────────────────── */
export function ThemeModal({ onClose, onSaved }: { onClose: () => void; onSaved: (t: VibeTheme) => void }) {
  const addTheme = useStore((s) => s.addTheme)
  const fileRef = useRef<HTMLInputElement>(null)

  const [logo, setLogo] = useState<string>('')
  const [name, setName] = useState('')
  const [primary, setPrimary] = useState('#000000')
  const [secondary, setSecondary] = useState('#8A3FFC')
  const [tertiary, setTertiary] = useState('')
  const [accent, setAccent] = useState('')
  const [titleFont, setTitleFont] = useState('Helvetica Neue')
  const [bodyFont, setBodyFont] = useState('Helvetica Neue')

  const ingestLogo = (f?: File) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setLogo(String(reader.result))
    reader.readAsDataURL(f)
  }

  const save = () => {
    const t = addTheme({
      name: name.trim() || 'My Theme',
      register: 'custom brand',
      colors: { surface: '#0a0a0c', primary, secondary, tertiary: tertiary || undefined, accent: accent || undefined },
      titleFont,
      bodyFont,
      logoText: name.trim() || undefined,
      styleNotes: logo ? 'brand logo provided' : undefined,
    })
    onSaved(t)
  }

  return (
    <div className="tm-overlay" onClick={onClose}>
      <style>{`
        .tm-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
          display: grid; place-items: center;
        }
        .tm-card {
          width: 700px; max-width: 92vw;
          background: var(--bg-elev);
          border: 1px solid var(--border-strong);
          border-radius: var(--r-xl);
          box-shadow: var(--shadow-lg);
          padding: 28px;
          display: flex; flex-direction: column; gap: 18px;
          font-family: var(--font-display);
        }
        .tm-title { font-size: 26px; font-weight: 600; color: var(--text); letter-spacing: -.01em; }
        .tm-sub { font-size: 13px; color: var(--text-3); margin-top: -10px; }
        .tm-label { font-size: 13px; color: var(--text-2); margin-bottom: 6px; display: block; }
        .tm-drop {
          position: relative;
          border: 1.5px dashed var(--border-strong);
          border-radius: 16px;
          padding: 26px; text-align: center;
          cursor: pointer; color: var(--text-3);
          transition: border-color .14s;
        }
        .tm-drop:hover { border-color: var(--accent); }
        .tm-optional { position: absolute; top: 12px; right: 12px; font-size: 11px; color: var(--text-3); background: var(--surface); padding: 2px 8px; border-radius: 999px; }
        .tm-row { display: flex; gap: 16px; }
        .tm-col { flex: 1; }
        .tm-input {
          width: 100%; height: 44px;
          background: var(--surface); border: 1px solid var(--border-strong);
          border-radius: 12px; padding: 0 14px;
          font-size: 14px; color: var(--text); font-family: var(--font); outline: none;
          transition: border-color .14s;
        }
        .tm-input:focus { border-color: var(--accent); }
        .tm-color { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 12px; }
        .tm-swatch { width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(255,255,255,.2); cursor: pointer; flex: none; background: none; padding: 0; }
        .tm-color input[type=text] { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 14px; font-family: var(--font-mono); }
        .tm-add { color: var(--text-3); display: flex; align-items: center; gap: 6px; font-size: 14px; }
        .tm-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .tm-btn { height: 40px; padding: 0 18px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; font-family: var(--font-display); }
        .tm-btn.ghost { background: var(--surface); color: var(--text-2); }
        .tm-btn.primary { background: var(--accent); color: #fff; }
        .tm-logo-preview { width: 56px; height: 56px; border-radius: 12px; object-fit: contain; background: var(--surface); margin: 0 auto 8px; display: block; }
      `}</style>

      <div className="tm-card" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="tm-title">Create New Theme</div>
        </div>
        <div className="tm-sub">Upload your logo, colors &amp; fonts to create your theme.</div>

        {/* Logo */}
        <div>
          <label className="tm-label">Upload Logo</label>
          <div className="tm-drop" onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); ingestLogo(e.dataTransfer.files?.[0]) }}>
            <span className="tm-optional">Optional</span>
            {logo
              ? <img src={logo} alt="logo" className="tm-logo-preview" />
              : <div style={{ fontSize: 22, marginBottom: 6 }}><Icon name="plus" size={22} /></div>}
            <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{logo ? 'Replace image' : 'Upload image or drag & drop'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>JPG, PNG, WEBP file, up to 50MB</div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => ingestLogo(e.target.files?.[0])} />
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="tm-label">Name</label>
          <input className="tm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Theme Name" />
        </div>

        {/* Colors */}
        <div className="tm-row">
          <div className="tm-col">
            <label className="tm-label">Primary Color</label>
            <div className="tm-color">
              <input className="tm-swatch" type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} style={{ background: primary }} />
              <input type="text" value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </div>
          </div>
          <div className="tm-col">
            <label className="tm-label">Secondary Color</label>
            <div className="tm-color">
              <input className="tm-swatch" type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} style={{ background: secondary }} />
              <input type="text" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="tm-row">
          <div className="tm-col">
            <label className="tm-label">Tertiary Color</label>
            {tertiary
              ? <div className="tm-color"><input className="tm-swatch" type="color" value={tertiary} onChange={(e) => setTertiary(e.target.value)} style={{ background: tertiary }} /><input type="text" value={tertiary} onChange={(e) => setTertiary(e.target.value)} /></div>
              : <button className="tm-color tm-add" onClick={() => setTertiary('#8A8575')}><Icon name="plus" size={14} /> Add Color</button>}
          </div>
          <div className="tm-col">
            <label className="tm-label">Accent Color</label>
            {accent
              ? <div className="tm-color"><input className="tm-swatch" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ background: accent }} /><input type="text" value={accent} onChange={(e) => setAccent(e.target.value)} /></div>
              : <button className="tm-color tm-add" onClick={() => setAccent('#E8590C')}><Icon name="plus" size={14} /> Add Color</button>}
          </div>
        </div>

        {/* Fonts */}
        <div className="tm-row">
          <div className="tm-col">
            <label className="tm-label">Title Font</label>
            <input className="tm-input" value={titleFont} onChange={(e) => setTitleFont(e.target.value)} placeholder="Helvetica Neue" />
          </div>
          <div className="tm-col">
            <label className="tm-label">Body Font</label>
            <input className="tm-input" value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} placeholder="Helvetica Neue" />
          </div>
        </div>

        <div className="tm-footer">
          <button className="tm-btn ghost" onClick={onClose}>Cancel</button>
          <button className="tm-btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}

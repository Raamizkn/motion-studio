import { useRef, useState } from 'react'
import { useStore } from '../store'
import { BUILTIN_THEMES } from '../data'
import type { VibeTheme } from '../data'
import { Icon } from './Icon'
import { importThemeFromUrlStub } from './grid/wizard'

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

/* ── Live theme preview — mirrors the colors & fonts as the user edits ─────── */
function ThemeVisualizer({
  logo, name, primary, secondary, tertiary, accent, titleFont, bodyFont,
}: {
  logo: string; name: string; primary: string; secondary: string
  tertiary: string; accent: string; titleFont: string; bodyFont: string
}) {
  const waves = [primary, secondary, tertiary || accent || secondary, accent || secondary]
  const paths = [
    'M0,70 C60,40 130,92 268,55 L268,250 L0,250 Z',
    'M0,120 C70,95 155,142 268,108 L268,250 L0,250 Z',
    'M0,165 C80,140 165,188 268,150 L268,250 L0,250 Z',
    'M0,206 C90,186 175,226 268,200 L268,250 L0,250 Z',
  ]
  const chips = [primary, secondary, tertiary, accent].filter(Boolean)
  return (
    <div className="tm-vis" style={{ background: '#0c0c0f' }}>
      <span className="tm-vis-badge">Preview</span>
      <span className="tm-vis-logo" style={{ background: logo ? 'rgba(255,255,255,.1)' : secondary }}>
        {logo ? <img src={logo} alt="" /> : (name.trim()[0] || 'T').toUpperCase()}
      </span>
      <div className="tm-vis-copy">
        <div className="tm-vis-title" style={{ fontFamily: `'${titleFont}', var(--font-display)`, color: '#fff' }}>
          {name.trim() || 'Theme Name'}
        </div>
        <div className="tm-vis-sub" style={{ fontFamily: `'${bodyFont}', var(--font)`, color: secondary }}>
          This is how your titles &amp; copy read across the storyboard.
        </div>
      </div>
      <svg className="tm-vis-wave" viewBox="0 0 268 250" preserveAspectRatio="none" aria-hidden>
        {paths.map((d, i) => <path key={i} d={d} fill={waves[i]} />)}
      </svg>
      <div className="tm-vis-chips">
        {chips.map((c, i) => <span key={i} className="tm-vis-chip" style={{ background: c }} />)}
      </div>
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
  const [brandUrl, setBrandUrl] = useState('')

  // Stub — prefill the form from a brand URL (deterministic palette/fonts).
  const importFromUrl = () => {
    if (!brandUrl.trim()) return
    const s = importThemeFromUrlStub(brandUrl.trim())
    setName(s.name)
    setSecondary(s.colors.secondary)
    if (s.colors.accent) setAccent(s.colors.accent)
    setTitleFont(s.titleFont)
    setBodyFont(s.bodyFont)
  }

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
          width: 840px; max-width: 94vw; max-height: 92vh;
          background: var(--bg-elev);
          border: 1px solid var(--border-strong);
          border-radius: var(--r-xl);
          box-shadow: var(--shadow-lg);
          padding: 24px;
          display: flex; flex-direction: column; gap: 14px;
          font-family: var(--font-display);
        }
        .tm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .tm-title { font-size: 26px; font-weight: 600; color: var(--text); letter-spacing: -.01em; }
        .tm-sub { font-size: 13px; color: var(--text-3); margin-top: 2px; }
        .tm-x { width: 32px; height: 32px; flex: none; border-radius: 999px; border: none; background: var(--surface-3); color: var(--text-2); cursor: pointer; display: grid; place-items: center; }
        .tm-body { display: flex; gap: 18px; min-height: 0; }
        .tm-form { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding-right: 2px; }

        /* Live theme visualizer */
        .tm-vis { position: relative; width: 268px; flex: none; align-self: stretch; border-radius: 16px; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; min-height: 420px; }
        .tm-vis-badge { position: absolute; top: 14px; right: 14px; z-index: 3; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.12); color: rgba(255,255,255,.85); backdrop-filter: blur(4px); }
        .tm-vis-logo { position: absolute; top: 14px; left: 14px; z-index: 3; width: 34px; height: 34px; border-radius: 9px; overflow: hidden; display: grid; place-items: center; background: rgba(255,255,255,.1); color: #fff; font-size: 16px; font-weight: 700; }
        .tm-vis-logo img { width: 100%; height: 100%; object-fit: contain; }
        .tm-vis-copy { position: relative; z-index: 3; padding: 64px 18px 0; }
        .tm-vis-title { font-size: 24px; font-weight: 600; line-height: 1.15; }
        .tm-vis-sub { font-size: 14px; line-height: 1.4; margin-top: 8px; }
        .tm-vis-wave { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 58%; z-index: 1; }
        .tm-vis-chips { position: absolute; left: 18px; bottom: 16px; z-index: 3; display: flex; gap: 6px; }
        .tm-vis-chip { width: 22px; height: 22px; border-radius: 7px; border: 1px solid rgba(255,255,255,.25); }
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
        .tm-btn { height: 40px; padding: 0 20px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; font-family: var(--font-display); transition: background .14s, color .14s, opacity .14s; }
        .tm-btn.ghost { background: var(--surface-3); color: var(--text); }
        .tm-btn.primary { background: #fff; color: #0a0a0c; }
        .tm-btn.primary:disabled { background: var(--surface-3); color: var(--text-4); cursor: not-allowed; }
        .tm-logo-preview { width: 56px; height: 56px; border-radius: 12px; object-fit: contain; background: var(--surface); margin: 0 auto 8px; display: block; }
      `}</style>

      <div className="tm-card" onClick={(e) => e.stopPropagation()}>
        <div className="tm-head">
          <div>
            <div className="tm-title">Create New Theme</div>
            <div className="tm-sub">Paste a brand URL to autofill, or set your logo, colors &amp; fonts manually.</div>
          </div>
          <button className="tm-x" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>

        <div className="tm-body">
          {/* Live preview — reflects colors & fonts as you edit */}
          <ThemeVisualizer
            logo={logo} name={name} primary={primary} secondary={secondary}
            tertiary={tertiary} accent={accent} titleFont={titleFont} bodyFont={bodyFont}
          />

          <div className="tm-form">
            {/* Import from URL */}
            <div>
              <label className="tm-label">Import from URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="tm-input"
                  placeholder="www.your-brand.com"
                  value={brandUrl}
                  onChange={(e) => setBrandUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') importFromUrl() }}
                />
                <button className="tm-btn primary" onClick={importFromUrl} disabled={!brandUrl.trim()}>Autofill</button>
              </div>
            </div>

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
      </div>
    </div>
  )
}

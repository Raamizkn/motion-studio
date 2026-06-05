// Minimal inline icon set (stroke-based, 1.6 weight) — no icon dependency.
import type { CSSProperties } from 'react'

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5',
  assets: 'M4 5h16v14H4zM4 9h16M9 9v10',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  image: 'M4 5h16v14H4zM4 16l4-4 3 3 4-5 5 6',
  video: 'M4 6h12v12H4zM16 9l4-2v10l-4-2',
  audio: 'M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4',
  edit: 'M4 20h4L18 9l-4-4L4 16zM14 5l4 4',
  upscale: 'M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7',
  film: 'M4 4h16v16H4zM4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
  ad: 'M3 5h18v11H3zM8 21h8M12 16v5M7 11l2-3 2 3M7.5 10h3',
  motion: 'M5 4v16l5-4 5 4V4M9 9l2 2 4-4',
  apps: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  community: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 6l6 6-6 6',
  chevLeft: 'M15 6l-6 6 6 6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  play: 'M7 5l12 7-12 7z',
  pause: 'M8 5h3v14H8zM13 5h3v14h-3z',
  undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h3',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  trash: 'M5 7h14M9 7V5h6v2M6 7l1 13h10l1-13',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M4 4l16 16M9.5 9.5A3 3 0 0 0 12 15a3 3 0 0 0 2.5-1.3M6.5 6.7C3.8 8.3 2 12 2 12s4 7 10 7c1.7 0 3.2-.4 4.5-1M10 5.2A9 9 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-2.2 2.9',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.5-1.8',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M20 11a8 8 0 1 0-1 5M20 5v6h-6',
  scissors: 'M6 6l12 12M6 18L18 6M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  type: 'M5 5h14M12 5v14M9 19h6',
  share: 'M16 6l-4-4-4 4M12 2v13M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  check: 'M5 12l5 5L20 6',
  link: 'M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0',
  caption: 'M4 5h16v14H4zM7 11h4M7 14h6M14 11h3',
  music: 'M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  italic: 'M10 5h7M7 19h7M14 5l-4 14',
  alignCenter: 'M4 6h16M7 12h10M5 18h14',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
}

// ImagineArt brand mark — filled glyph (not part of the stroke set).
export function ImagineMark({ size = 18, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
      <path d="M21.8308 9.75073C19.3137 9.15943 16.4601 8.97391 17.1561 4.37102L22.2484 5.7971L24 6.21449C23.9072 2.77102 21.0885 0 17.6201 0H6.34518C2.84205 0 0 2.84058 0 6.34203V11.6754C0 13.4609 0.962917 13.9594 2.16929 14.2493C4.68644 14.8406 7.53988 15.0261 6.84389 19.629L1.75158 18.2029L0 17.7855C0.0695986 21.229 2.87685 24 6.34518 24H17.655C21.1581 24 24 21.1594 24 17.658V12.3246C24 10.5391 23.0372 10.0406 21.8308 9.75073ZM19.2673 12C15.7874 13.1594 13.1311 15.8957 12.0059 19.258C10.8923 15.9073 8.23594 13.1594 4.74441 12C8.22434 10.8406 10.8807 8.09276 12.0059 4.74203C13.1195 8.09276 15.7758 10.8406 19.2673 12Z" />
    </svg>
  )
}

interface IconProps {
  name: keyof typeof P | string
  size?: number
  className?: string
  style?: CSSProperties
  fill?: boolean
}

export function Icon({ name, size = 18, className, style }: IconProps) {
  const d = P[name] || P.sparkle
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {d.split('M').filter(Boolean).map((seg, i) => (
        <path key={i} d={'M' + seg} />
      ))}
    </svg>
  )
}

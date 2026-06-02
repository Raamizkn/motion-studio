import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { SceneSeed, AspectRatio } from '../types'
import { buildSceneHtml } from '../scene'

export const ASPECT_RATIO: Record<AspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
}

interface Props {
  seed: SceneSeed
  /** width:height ratio of the box (defaults 16:9) */
  ratio?: number
  rounded?: number
  className?: string
  style?: CSSProperties
  /** disables pointer events so parent click handlers fire */
  passthrough?: boolean
}

/**
 * Renders a live, infinitely-animated Kinetic scene in a sandboxed iframe.
 * Used everywhere a preview is shown — template cards, project thumbnails,
 * storyboard frames and the editor canvas. Every preview animates.
 */
export function ScenePreview({ seed, ratio = 16 / 9, rounded = 0, className, style, passthrough = true }: Props) {
  const html = useMemo(() => buildSceneHtml(seed), [seed])
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: String(ratio),
        borderRadius: rounded,
        overflow: 'hidden',
        background: '#0a0a0c',
        ...style,
      }}
    >
      <iframe
        title="scene"
        srcDoc={html}
        sandbox="allow-scripts"
        scrolling="no"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          pointerEvents: passthrough ? 'none' : 'auto',
        }}
      />
    </div>
  )
}

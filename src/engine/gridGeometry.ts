// ── Stage B: grid geometry ──────────────────────────────────────────────────
// Given N frames and the canvas aspect, lay out a near-square grid of cells.
// Wide (16:9) cells stack vertically; tall (9:16) cells sit side by side; the
// gutter is ~2% of a cell's width. Emits exactly N cell boxes (row-major);
// non-tiling N (5, 7…) leaves a trailing empty slot the UI draws as inert.
//
// IMPORTANT: this geometry is used ONLY to (1) write the grid directive into the
// mega-prompt and (2) arrange the frames for display. We DO NOT crop anything —
// the grid model's API returns the storyboard already split into N frame images.

import type { GridAspect, BBox } from '../spec'

const CELL: Record<GridAspect, { w: number; h: number }> = {
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
  '1:1': { w: 1024, h: 1024 },
}

export interface GridLayout {
  cols: number
  rows: number
  gutter: number
  cellW: number
  cellH: number
  gridW: number
  gridH: number
  cells: BBox[]
}

export function computeGrid(n: number, aspect: GridAspect): GridLayout {
  const N = Math.max(1, Math.floor(n))
  let cols = Math.ceil(Math.sqrt(N))
  let rows = Math.ceil(N / cols)
  if (aspect === '16:9' && cols > rows) [cols, rows] = [rows, cols] // wide cells stack vertically
  if (aspect === '9:16' && rows > cols) [cols, rows] = [rows, cols] // tall cells sit side by side
  const c = CELL[aspect]
  const gutter = Math.round(c.w * 0.02)
  const gridW = cols * c.w + (cols - 1) * gutter
  const gridH = rows * c.h + (rows - 1) * gutter
  const cells: BBox[] = []
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / cols)
    const col = i % cols
    cells.push({ x: col * (c.w + gutter), y: r * (c.h + gutter), w: c.w, h: c.h })
  }
  return { cols, rows, gutter, cellW: c.w, cellH: c.h, gridW, gridH, cells }
}

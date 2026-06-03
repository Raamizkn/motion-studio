import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error - plain .mjs node module
import { renderPlugin } from './server/renderPlugin.mjs'
// @ts-expect-error - plain .mjs node module
import { claudePlugin } from './server/claudePlugin.mjs'
// @ts-expect-error - plain .mjs node module
import { aiPlugin } from './server/aiPlugin.mjs'

export default defineConfig({
  // claudePlugin runs first: it owns /api/ai/status, /api/ai/compose and
  // /api/ai/edit-composition. aiPlugin (Gemini) stays for legacy storyboard
  // endpoints as a fallback only.
  plugins: [react(), renderPlugin(), claudePlugin(), aiPlugin()],
  server: { host: true, port: 5173 },
})

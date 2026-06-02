import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error - plain .mjs node module
import { renderPlugin } from './server/renderPlugin.mjs';
// @ts-expect-error - plain .mjs node module
import { aiPlugin } from './server/aiPlugin.mjs';
export default defineConfig({
    plugins: [react(), renderPlugin(), aiPlugin()],
    server: { host: true, port: 5173 },
});

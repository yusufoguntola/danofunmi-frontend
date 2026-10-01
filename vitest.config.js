import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Separate from vite.config.js deliberately — that one wires up the PWA
// plugin (service worker build, manifest), which has no business running
// during a test pass and isn't needed for it.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})

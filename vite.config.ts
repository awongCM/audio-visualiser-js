import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['butterchurn', 'butterchurn-presets'],
  },
})

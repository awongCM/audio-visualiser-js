import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/audio-visualiser-js/' : '/',
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
})

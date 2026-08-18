import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative assets keep one production build valid at both the GitHub Pages
  // project path (/git2/) and the custom-domain root (/).
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
})

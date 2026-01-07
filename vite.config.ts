import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path - use '/' for server deployment or '/switch-library/' for GitHub Pages
  base: process.env.VITE_BASE_PATH || '/',
})

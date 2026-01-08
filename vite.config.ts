import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path - use '/' for server deployment or '/switch-library/' for GitHub Pages
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    proxy: {
      '/api/thegamesdb': {
        target: 'https://api.thegamesdb.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/thegamesdb/, '/v1'),
      },
    },
  },
})

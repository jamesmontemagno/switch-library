import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path - use '/' for custom domain
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    proxy: {
      '/api': {
        // Proxy all /api requests to Azure Functions backend running locally
        target: 'http://localhost:7071',
        changeOrigin: true,
      },
    },
  },
})

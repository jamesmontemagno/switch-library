import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png'],
      manifest: {
        id: '/switch-library/',
        name: 'My Switch Library',
        short_name: 'Switch Library',
        description: 'Track, organize, and share your Nintendo Switch game collection',
        theme_color: '#e60012',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['games', 'utilities', 'entertainment'],
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Add Game',
            short_name: 'Add',
            description: 'Add a new game to your library',
            url: '/search',
            icons: [
              {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'My Library',
            short_name: 'Library',
            description: 'View your game collection',
            url: '/library',
            icons: [
              {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          },
          {
            name: 'Search',
            short_name: 'Search',
            description: 'Search for games',
            url: '/search',
            icons: [
              {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              }
            ]
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        sourcemap: true,
        // Cache static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Cache TheGamesDB API responses
            urlPattern: /^https:\/\/api\.thegamesdb\.net\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'thegamesdb-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache backend API responses
            urlPattern: /^https?:.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'backend-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache images from TheGamesDB
            urlPattern: /^https:\/\/cdn\.thegamesdb\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'thegamesdb-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
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

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // Vercel / local dev: leave BASE_PATH unset (defaults to `/`).
  // GitHub Pages only: BASE_PATH=/ShopLedGer/ (set in the Pages workflow).
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.BASE_PATH || process.env.BASE_PATH || '/'

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo.png'],
        manifest: {
          name: 'ShopLedGer',
          short_name: 'ShopLedGer',
          description: 'Offline-first shop accounting PWA',
          theme_color: '#0f766e',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          lang: 'bn',
          // Relative icon paths so they respect Vite `base` (needed on GitHub Pages).
          id: '.',
          start_url: '.',
          scope: '.',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // GitHub Pages SPA: unknown path গুলো index.html দিয়ে serve হয়।
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
    },
  }
})

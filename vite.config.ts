import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { buildAppShortcuts } from './src/lib/pwaShortcuts'

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
          name: 'কর্ণফুলী সেলস সেন্টার',
          short_name: 'কর্ণফুলী',
          description: 'গবাদি পশুর খাদ্য সরবরাহ ও দোকানের হিসাব — অফলাইন-ফার্স্ট PWA',
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
          // Android অ্যাপ-শর্টকাট: ইনস্টল করা আইকনে লং-প্রেস → কুইক-অ্যাকশন মে뉴।
          // url গুলো base-সহ অ্যাবসল্যুট (scope-এর ভিতরে), আইকন রিলেটিভ (ম্যানিফেস্ট-সাপেক্ষে)।
          shortcuts: buildAppShortcuts(base),
        },
        workbox: {
          // ttf: PDF-এ embed করা বাংলা ফন্ট — অফলাইনেও PDF ডাউনলোড কাজ করার জন্য
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf}'],
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

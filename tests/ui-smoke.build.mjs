/* UI স্মোক বান্ডলার — esbuild দিয়ে src/ কোড এক ফাইলে বান্ডল করে (node_modules বাইরে রাখে)
   আর Vite-এর import.meta.env-এর জায়গায় স্ট্যাব বসায়, যাতে Node-এ পেজ রেন্ডার করা যায়। */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('node_modules/.cache', { recursive: true })

await build({
  entryPoints: ['tests/ui-smoke.customer.tsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  outfile: 'node_modules/.cache/ui-smoke.mjs',
  logLevel: 'error',
  define: {
    'import.meta.env': JSON.stringify({
      BASE_URL: '/',
      MODE: 'test',
      DEV: false,
      PROD: true,
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    }),
  },
})

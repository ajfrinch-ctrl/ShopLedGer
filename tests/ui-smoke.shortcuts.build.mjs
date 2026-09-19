/* শর্টকাট-স্মোক বান্ডলার — tests/ui-smoke.shortcuts.tsx এক ফাইলে বান্ডল করে (node_modules বাইরে),
   import.meta.env-এর স্ট্যাব সহ, যাতে Node-এ পুরো অ্যাপ রেন্ডার করে যাচাই করা যায়। */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('node_modules/.cache', { recursive: true })

await build({
  entryPoints: ['tests/ui-smoke.shortcuts.tsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  outfile: 'node_modules/.cache/ui-smoke-shortcuts.mjs',
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

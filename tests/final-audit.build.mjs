/* চূড়ান্ত অডিট বান্ডলার — ui-smoke.build.mjs-এর মতোই esbuild + env স্টাব */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('node_modules/.cache', { recursive: true })

await build({
  entryPoints: ['tests/final-audit.full.tsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  outfile: 'node_modules/.cache/final-audit.mjs',
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

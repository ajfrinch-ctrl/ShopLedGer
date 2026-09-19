import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

type Handler = (e: unknown) => void

const g = globalThis as unknown as Record<string, unknown>

const handlers: Record<string, Handler[]> = {}
let standalone = false
const store = new Map<string, string>()

g.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}
g.window = {
  addEventListener: (type: string, fn: Handler) => {
    ;(handlers[type] ||= []).push(fn)
  },
  matchMedia: (q: string) => ({
    matches: standalone && q === '(display-mode: standalone)',
    addEventListener: () => {},
  }),
  navigator: {},
  localStorage: g.localStorage,
}

const fire = (type: string, event: unknown) => (handlers[type] || []).forEach((fn) => fn(event))

const mod = await import('../src/lib/pwaInstall')

function fakePrompt(outcome: 'accepted' | 'dismissed') {
  return {
    preventDefault() {},
    platforms: ['web'],
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  }
}

beforeEach(() => {
  mod.__resetForTests()
  for (const k of Object.keys(handlers)) delete handlers[k]
  store.clear()
  standalone = false
})

test('install button hidden until beforeinstallprompt arrives', () => {
  mod.startPwaInstallTracking()
  assert.deepEqual(mod.getState(), { canInstall: false, isInstalled: false })
  fire('beforeinstallprompt', fakePrompt('accepted'))
  assert.deepEqual(mod.getState(), { canInstall: true, isInstalled: false })
})

test('standalone display means installed, so no button', () => {
  standalone = true
  mod.startPwaInstallTracking()
  assert.deepEqual(mod.getState(), { canInstall: false, isInstalled: true })
})

test('accepting the native prompt installs and hides the button permanently', async () => {
  mod.startPwaInstallTracking()
  fire('beforeinstallprompt', fakePrompt('accepted'))
  assert.equal(await mod.promptInstall(), 'accepted')
  assert.deepEqual(mod.getState(), { canInstall: false, isInstalled: true })
  // দ্বিতীয়বার ডাকলে duplicate prompt হবে না
  assert.equal(await mod.promptInstall(), 'unavailable')
})

test('appinstalled event hides button on every page and persists across reload', () => {
  mod.startPwaInstallTracking()
  fire('beforeinstallprompt', fakePrompt('accepted'))
  fire('appinstalled', {})
  assert.equal(mod.getState().isInstalled, true)

  // reload simulation: standalone নয়, কিন্তু flag আছে
  mod.__resetForTests()
  for (const k of Object.keys(handlers)) delete handlers[k]
  mod.startPwaInstallTracking()
  assert.deepEqual(mod.getState(), { canInstall: false, isInstalled: true })
})

test('uninstall brings the button back when Chrome fires beforeinstallprompt again', () => {
  store.set(mod.INSTALLED_FLAG_KEY, '1')
  mod.startPwaInstallTracking()
  assert.equal(mod.getState().isInstalled, true)
  fire('beforeinstallprompt', fakePrompt('accepted'))
  assert.deepEqual(mod.getState(), { canInstall: true, isInstalled: false })
})

test('dismissing keeps app uninstalled and consumes the one-shot event', async () => {
  mod.startPwaInstallTracking()
  fire('beforeinstallprompt', fakePrompt('dismissed'))
  assert.equal(await mod.promptInstall(), 'dismissed')
  assert.deepEqual(mod.getState(), { canInstall: false, isInstalled: false })
})

test('subscribers are notified of state changes', () => {
  mod.startPwaInstallTracking()
  const seen: boolean[] = []
  const off = mod.subscribe((s) => seen.push(s.canInstall))
  fire('beforeinstallprompt', fakePrompt('accepted'))
  off()
  fire('appinstalled', {})
  assert.deepEqual(seen, [false, true])
})

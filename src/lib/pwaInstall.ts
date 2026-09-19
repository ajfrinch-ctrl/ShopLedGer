/**
 * PWA install detection helpers.
 *
 * এই module টি UI-নিরপেক্ষ: শুধু install prompt event ধরে রাখা,
 * installed state detect করা এবং subscriber-দের জানানো।
 *
 * নির্ভরযোগ্য detection দুই ভাবে:
 *  1. `display-mode: standalone` (অথবা iOS `navigator.standalone`) — অ্যাপ হিসেবে চালু হলে।
 *  2. `beforeinstallprompt` / `appinstalled` events — Chrome (Android + Desktop)।
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

export interface PwaInstallState {
  /** Chrome native prompt পাওয়া গেছে কি না (অর্থাৎ install করা যাবে)। */
  canInstall: boolean
  /** অ্যাপ ইতিমধ্যে install করা আছে কি না। */
  isInstalled: boolean
}

/** localStorage key — uninstall করলে browser event আবার আসবে, তাই এটি শুধু hint। */
export const INSTALLED_FLAG_KEY = 'shopledger:pwa-installed'

type Listener = (state: PwaInstallState) => void

const listeners = new Set<Listener>()

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
let started = false

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readInstalledFlag(): boolean {
  return safeStorage()?.getItem(INSTALLED_FLAG_KEY) === '1'
}

function writeInstalledFlag(value: boolean) {
  const store = safeStorage()
  if (!store) return
  try {
    if (value) store.setItem(INSTALLED_FLAG_KEY, '1')
    else store.removeItem(INSTALLED_FLAG_KEY)
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

/** ব্রাউজার window standalone (installed app) হিসেবে চলছে কি না। */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const mm = window.matchMedia
    if (typeof mm === 'function') {
      for (const query of ['(display-mode: standalone)', '(display-mode: fullscreen)', '(display-mode: minimal-ui)', '(display-mode: window-controls-overlay)']) {
        if (mm.call(window, query)?.matches) return true
      }
    }
  } catch {
    /* matchMedia unsupported */
  }
  // iOS Safari
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav?.standalone === true
}

export function getState(): PwaInstallState {
  return {
    canInstall: deferredPrompt !== null && !installed,
    isInstalled: installed,
  }
}

function emit() {
  const state = getState()
  listeners.forEach((fn) => fn(state))
}

function setInstalled(value: boolean) {
  if (value) deferredPrompt = null
  if (installed === value) return
  installed = value
  writeInstalledFlag(value)
  emit()
}

/**
 * Global listener গুলো একবারই attach করে।
 * একাধিক component subscribe করলেও duplicate prompt হবে না।
 */
export function startPwaInstallTracking() {
  if (started || typeof window === 'undefined') return
  started = true

  installed = isStandaloneDisplay() || readInstalledFlag()

  window.addEventListener('beforeinstallprompt', (event) => {
    // Chrome-এর mini-infobar বন্ধ করে নিজেদের button থেকে prompt করা হবে।
    event.preventDefault()
    // এই event আসা মানে অ্যাপ এখনো installed নয় (uninstall করার পরেও আবার আসে)।
    deferredPrompt = event as BeforeInstallPromptEvent
    if (installed) {
      installed = false
      writeInstalledFlag(false)
    }
    emit()
  })

  window.addEventListener('appinstalled', () => {
    setInstalled(true)
  })

  try {
    const mq = window.matchMedia?.('(display-mode: standalone)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setInstalled(true)
    }
    if (mq?.addEventListener) mq.addEventListener('change', onChange)
    else mq?.addListener?.(onChange)
  } catch {
    /* ignore */
  }
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener(getState())
  return () => {
    listeners.delete(listener)
  }
}

/** Native Chrome install prompt চালু করে। */
export async function promptInstall(): Promise<InstallOutcome> {
  const prompt = deferredPrompt
  if (!prompt || installed) return 'unavailable'

  // একই event দুইবার ব্যবহার করা যায় না — সঙ্গে সঙ্গে clear।
  deferredPrompt = null
  emit()

  try {
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      return 'accepted'
    }
    // Dismiss হলে button আবার দেখানো যেতে পারে পরের beforeinstallprompt event-এ।
    return 'dismissed'
  } catch {
    return 'unavailable'
  }
}

/** শুধুমাত্র test-এর জন্য internal state reset. */
export function __resetForTests() {
  listeners.clear()
  deferredPrompt = null
  installed = false
  started = false
}

// স্মোক-প্রিলোড: Node-এ ব্রাউজার-গ্লোবালগুলো বান্ডেল লোড হওয়ার আগেই বসিয়ে দেয়
import 'fake-indexeddb/auto'
import { Window } from 'happy-dom'

const win = new Window({ url: 'http://localhost/' })

const define = (key, value) => {
  if (key in globalThis && globalThis[key] !== undefined) {
    try { delete globalThis[key] } catch { /* ignore */ }
  }
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
}

define('window', win)
define('document', win.document)
define('navigator', { userAgent: 'node', language: 'bn-BD', canShare: () => false })
define('self', globalThis)
define('getComputedStyle', win.getComputedStyle.bind(win))
define('matchMedia', (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
for (const k of ['HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'DocumentFragment', 'Image', 'Blob', 'File', 'FormData', 'requestAnimationFrame', 'cancelAnimationFrame', 'SVGElement', 'Text', 'HTMLCanvasElement', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'location', 'history']) {
  const v = win[k]
  if (v !== undefined) define(k, v)
}

const ls = new Map()
define('localStorage', {
  getItem: (k) => ls.get(k) ?? null,
  setItem: (k, v) => void ls.set(k, String(v)),
  removeItem: (k) => void ls.delete(k),
  clear: () => ls.clear(),
  key: (i) => [...ls.keys()][i] ?? null,
  get length() { return ls.size },
})
define('sessionStorage', globalThis.localStorage)

export {}

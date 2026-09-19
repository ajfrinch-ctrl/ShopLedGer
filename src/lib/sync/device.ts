/**
 * Device identity + permanent UID generation.
 *
 * প্রতিটি ডিভাইসের একটি স্থায়ী `device_id` থাকে যা localStorage-এ জমা হয়।
 * এটি দিয়েই conflict tie-break এবং "কোন ডিভাইস থেকে এসেছে" ট্র্যাক করা যায়।
 */

const DEVICE_ID_KEY = 'shopledger:device-id'

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** RFC-4122 v4 UUID — crypto.randomUUID না থাকলে fallback. */
export function newUid(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (c?.randomUUID) return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)

  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

let cachedDeviceId: string | null = null

/** এই ডিভাইসের স্থায়ী আইডি (প্রথমবার তৈরি হয়ে localStorage-এ থাকে)। */
export function deviceId(): string {
  if (cachedDeviceId) return cachedDeviceId

  const store = safeStorage()
  const existing = store?.getItem(DEVICE_ID_KEY)
  if (existing) {
    cachedDeviceId = existing
    return existing
  }

  const fresh = newUid()
  try {
    store?.setItem(DEVICE_ID_KEY, fresh)
  } catch {
    /* privacy mode — in-memory হলেও session-এ consistent থাকবে */
  }
  cachedDeviceId = fresh
  return fresh
}

/** শুধুমাত্র test-এর জন্য। */
export function __resetDeviceId() {
  cachedDeviceId = null
  try {
    safeStorage()?.removeItem(DEVICE_ID_KEY)
  } catch {
    /* ignore */
  }
}

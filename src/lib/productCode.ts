import type { Product, ProductCategory } from '../types'

export const DEFAULT_CATEGORIES: ProductCategory[] = [
  { name: 'ফিড', prefix: 'FEED' },
  { name: 'ভুষি', prefix: 'BRAN' },
  { name: 'তেল', prefix: 'OIL' },
  { name: 'চাল', prefix: 'RICE' },
  { name: 'ডাল', prefix: 'DAL' },
  { name: 'আটা/ময়দা', prefix: 'FLR' },
  { name: 'চিনি/লবণ', prefix: 'SGR' },
  { name: 'অন্যান্য', prefix: 'GEN' },
]

export const GENERAL_PREFIX = 'GEN'

/** প্রিফিক্স স্যানিটাইজ: শুধু A-Z0-9, সর্বোচ্চ ৬ অক্ষর */
export function normalizePrefix(raw: string): string {
  const p = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return p || GENERAL_PREFIX
}

export function prefixFor(category: string | undefined, categories: ProductCategory[]): string {
  const c = categories.find((x) => x.name === category)
  return c ? c.prefix : GENERAL_PREFIX
}

/** ক্যাটাগরি প্রিফিক্স অনুযায়ী পরবর্তী ক্রমিক কোড: OIL-001, OIL-002 … */
export function nextCode(prefix: string, existing: Pick<Product, 'code'>[]): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`)
  let max = 0
  for (const p of existing) {
    const m = p.code?.match(re)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

export function codeExists(code: string, existing: Pick<Product, 'code' | 'id'>[], exceptId?: string): boolean {
  const c = code.trim().toUpperCase()
  return existing.some((p) => p.id !== exceptId && p.code?.toUpperCase() === c)
}

/** পুরনো পণ্যে কোড না থাকলে ক্রমান্বয়ে কোড বসানো */
export function assignMissingCodes(products: Product[], categories: ProductCategory[]): Product[] {
  const out: Product[] = []
  for (const p of products) {
    if (p.code) {
      out.push(p)
      continue
    }
    const prefix = prefixFor(p.category, categories)
    out.push({ ...p, code: nextCode(prefix, [...out, ...products.filter((x) => x.code)]) })
  }
  return out
}

/** প্রদর্শনের নাম: কোম্পানি থাকলে "নাম – কোম্পানি" */
export function displayName(p: Pick<Product, 'name' | 'company'>): string {
  return p.company ? `${p.name} – ${p.company}` : p.name
}

/** নাম, কোম্পানি বা কোড দিয়ে খোঁজা */
export function matchesProduct(p: Pick<Product, 'name' | 'company' | 'code'>, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return (
    p.name.toLowerCase().includes(s) ||
    (p.company?.toLowerCase().includes(s) ?? false) ||
    (p.code?.toLowerCase().includes(s) ?? false)
  )
}

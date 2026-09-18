import type { Product, Purchase, Sale, StockAdjustment } from '../types'

export interface StockRow extends Product {
  totalPurchased: number
  totalSold: number
  totalAdjusted: number
  currentStock: number
  stockValue: number
  saleValue: number
  potentialProfit: number
  isLow: boolean
}

/** বর্তমান স্টক = প্রারম্ভিক + ক্রয় − বিক্রি ± সমন্বয় */
export function computeStock(
  products: Product[],
  purchases: Purchase[],
  sales: Sale[],
  adjustments: StockAdjustment[] = [],
): StockRow[] {
  const purchased = new Map<string, number>()
  for (const p of purchases) purchased.set(p.product_id, (purchased.get(p.product_id) || 0) + p.quantity)

  const sold = new Map<string, number>()
  for (const s of sales)
    for (const i of s.items) sold.set(i.product_id, (sold.get(i.product_id) || 0) + i.quantity)

  const adjusted = new Map<string, number>()
  for (const a of adjustments) adjusted.set(a.product_id, (adjusted.get(a.product_id) || 0) + a.quantity)

  return products.map((product) => {
    const totalPurchased = purchased.get(product.id) || 0
    const totalSold = sold.get(product.id) || 0
    const totalAdjusted = adjusted.get(product.id) || 0
    const currentStock = round(product.opening_stock + totalPurchased - totalSold + totalAdjusted)
    const stockValue = Math.max(0, currentStock) * product.purchase_price
    const saleValue = Math.max(0, currentStock) * product.sale_price
    const min = product.min_stock ?? 0
    return {
      ...product,
      totalPurchased,
      totalSold,
      totalAdjusted,
      currentStock,
      stockValue,
      saleValue,
      potentialProfit: saleValue - stockValue,
      isLow: min > 0 && currentStock <= min,
    }
  })
}

export function stockMap(rows: StockRow[]): Map<string, StockRow> {
  return new Map(rows.map((r) => [r.id, r]))
}

function round(n: number) {
  return Math.round(n * 1000) / 1000
}

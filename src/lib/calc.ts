import type {
  Collection,
  Customer,
  Expense,
  Product,
  Purchase,
  Sale,
  StockAdjustment,
} from "./types";

export function stockOf(
  product: Product,
  sales: Sale[],
  purchases: Purchase[],
  adjustments: StockAdjustment[],
): number {
  const sold = sales.reduce(
    (sum, s) =>
      sum +
      s.items
        .filter((i) => i.productId === product.id)
        .reduce((a, i) => a + i.quantity, 0),
    0,
  );
  const bought = purchases
    .filter((p) => p.productId === product.id)
    .reduce((a, p) => a + p.quantity, 0);
  const adj = adjustments
    .filter((a) => a.productId === product.id)
    .reduce((a, x) => a + x.quantity, 0);
  return product.openingStock + bought + adj - sold;
}

export function customerDue(
  customerId: string,
  sales: Sale[],
  collections: Collection[],
): number {
  const billed = sales
    .filter((s) => s.customerId === customerId)
    .reduce((a, s) => a + (s.total - s.paid), 0);
  const collected = collections
    .filter((c) => c.kind === "customer" && c.partyId === customerId)
    .reduce((a, c) => a + c.amount, 0);
  return billed - collected;
}

export function supplierDue(
  supplier: string,
  purchases: Purchase[],
  collections: Collection[],
): number {
  const billed = purchases
    .filter((p) => p.supplier === supplier)
    .reduce((a, p) => a + (p.total - p.paid), 0);
  const paid = collections
    .filter((c) => c.kind === "supplier" && c.partyName === supplier)
    .reduce((a, c) => a + c.amount, 0);
  return billed - paid;
}

export function allCustomerDues(customers: Customer[], sales: Sale[], collections: Collection[]) {
  return customers
    .map((c) => ({ customer: c, due: customerDue(c.id, sales, collections) }))
    .filter((x) => x.due > 0.5)
    .sort((a, b) => b.due - a.due);
}

export function saleProfit(s: Sale): number {
  const cogs = s.items.reduce((a, i) => a + i.purchasePrice * i.quantity, 0);
  return s.total - cogs;
}

export function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

export function profitSummary(
  sales: Sale[],
  expenses: Expense[],
  from: string,
  to: string,
) {
  const rows = sales.filter((s) => inRange(s.date, from, to));
  const revenue = rows.reduce((a, s) => a + s.total, 0);
  const cogs = rows.reduce(
    (a, s) => a + s.items.reduce((x, i) => x + i.purchasePrice * i.quantity, 0),
    0,
  );
  const shopExp = expenses
    .filter((e) => e.kind === "shop" && inRange(e.date, from, to))
    .reduce((a, e) => a + e.amount, 0);
  const ownerDraw = expenses
    .filter((e) => e.kind === "owner" && inRange(e.date, from, to))
    .reduce((a, e) => a + e.amount, 0);
  const gross = revenue - cogs;
  const net = gross - shopExp;
  return {
    saleCount: rows.length,
    revenue,
    cogs,
    gross,
    shopExp,
    ownerDraw,
    net,
  };
}

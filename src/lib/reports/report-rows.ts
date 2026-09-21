import { allCustomerDues, stockOf } from "@/lib/calc";
import { bnDate, bnNum, money } from "@/lib/format";
import type { Kind } from "@/components/report-kinds";

export function reportRows(kind: Kind, from: string, to: string, data: {
  sales: any[];
  purchases: any[];
  expenses: any[];
  collections: any[];
  products: any[];
  customers: any[];
  adjustments: any[];
}): string[][] {
  const { sales, purchases, expenses, collections, products, customers, adjustments } = data;
  const inR = (d: string) => d >= from && d <= to;
  if (kind === "sales") {
    return sales.filter((s) => inR(s.date)).sort((a, b) => b.date.localeCompare(a.date)).map((s) => [
      bnDate(s.date), s.customerName,
      s.items.map((i: any) => `${i.productName} × ${bnNum(i.quantity)} ${i.unit}`).join(", "),
      money(s.total),
    ]);
  }
  if (kind === "purchase") {
    return purchases.filter((p) => inR(p.date)).sort((a, b) => b.date.localeCompare(a.date)).map((p) => [bnDate(p.date), p.supplier, money(p.total)]);
  }
  if (kind === "stock") {
    return products.map((p) => {
      const q = stockOf(p, sales, purchases, adjustments);
      const sold = sales.reduce((sum: number, s: any) => sum + s.items.filter((i: any) => i.productId === p.id).reduce((total: number, i: any) => total + i.quantity, 0), 0);
      return [p.id, p.name, `শুরু: ${bnNum(p.openingStock)} ${p.unit}`, `বিক্রি: ${bnNum(sold)} ${p.unit}`, `আছে: ${bnNum(q)} ${p.unit}`];
    });
  }
  if (kind === "customerDue") {
    return allCustomerDues(customers, sales, collections).map((d) => [d.customer.name, d.customer.phone, money(d.due)]);
  }
  if (kind === "collection") {
    return collections.filter((c) => inR(c.date)).sort((a, b) => b.date.localeCompare(a.date)).map((c) => [bnDate(c.date), c.partyName, money(c.amount)]);
  }
  if (kind === "expense") {
    return expenses.filter((e) => inR(e.date)).sort((a, b) => b.date.localeCompare(a.date)).map((e) => [bnDate(e.date), e.category, money(e.amount)]);
  }
  if (kind === "product") {
    const map = new Map<string, number>();
    for (const s of sales.filter((x: any) => inR(x.date))) {
      for (const i of s.items) map.set(i.productName, (map.get(i.productName) ?? 0) + i.total);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([n, t]) => [n, "", money(t)]);
  }
  if (kind === "transaction") {
    const t: { date: string; label: string; amount: number }[] = [];
    for (const s of sales.filter((x: any) => inR(x.date))) t.push({ date: s.date, label: `বিক্রি • ${s.customerName}`, amount: s.total });
    for (const p of purchases.filter((x: any) => inR(x.date))) t.push({ date: p.date, label: `ক্রয় • ${p.supplier}`, amount: p.total });
    for (const e of expenses.filter((x: any) => inR(x.date))) t.push({ date: e.date, label: `খরচ • ${e.category}`, amount: e.amount });
    const listed = t.sort((a, b) => (a.date < b.date ? 1 : -1)).map((r) => [bnDate(r.date), r.label, money(r.amount)]);
    if (listed.length) listed.push(["", "সর্বমোট", money(t.reduce((sum, r) => sum + r.amount, 0))]);
    return listed;
  }
  return [];
}

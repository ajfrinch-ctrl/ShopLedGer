import { test } from "node:test";
import assert from "node:assert/strict";
import { dateKeyToday, entryISOOn, isBackdated, toDateKey } from "../src/lib/profitLoss";
import { buildReport } from "../src/lib/reports/builders";
import type { ReportData, ReportInput } from "../src/lib/reports/core";
import { computeStock } from "../src/lib/stock";
import type { Product, Purchase, Sale, StockAdjustment } from "../src/types";

/* ── টেস্ট ডেটা ── */

const product = (o: Partial<Product>): Product => ({
  id: "p1", name: "সয়ামিল", unit: "বস্তা", opening_stock: 10, purchase_price: 100,
  sale_price: 120, branch_id: "a", created_at: "", updated_at: "", ...o,
});

const sale = (o: Partial<Sale>): Sale => ({
  id: "s1", date: "2026-09-18T10:00:00", items: [], total_amount: 1200, total_profit: 200,
  payment_type: "নগদ", branch_id: "a", created_by: "u1", created_at: "", ...o,
});

const purchase = (o: Partial<Purchase>): Purchase => ({
  id: "pu1", date: "2026-09-05T09:00:00", product_id: "p1", product_name: "সয়ামিল",
  quantity: 50, unit: "বস্তা", purchase_price: 100, total: 5000, payment_type: "নগদ",
  branch_id: "a", created_at: "", ...o,
});

const adjustment = (o: Partial<StockAdjustment>): StockAdjustment => ({
  id: "adj1", date: "2026-09-10", product_id: "p1", product_name: "সয়ামিল", quantity: -2,
  unit: "বস্তা", reason: "নষ্ট", branch_id: "a", created_by: "u1", created_at: "", ...o,
});

const data = (o: Partial<ReportData> = {}): ReportData => ({
  sales: [sale({})], purchases: [], expenses: [], collections: [], entries: [],
  customers: [], products: [product({})], adjustments: [], branches: [], users: [], ...o,
});

const input = (from: string, to: string): ReportInput => ({
  from, to, month: from.slice(0, 7), scope: { branchId: "a" },
});

test("পুরানো তারিখে বিক্রি এন্ট্রি — সেই তারিখের রিপোর্টেই ধরা পড়ে", () => {
  // ১২ সেপ্টেম্বরের বিক্রি, আজ নয়
  const backSale = sale({ id: "s2", date: entryISOOn("2026-09-12"), total_amount: 5000 });
  const todaySale = sale({ id: "s3", date: entryISOOn("2026-09-18"), total_amount: 1200 });

  // ১২ সেপ্টেম্বরের রিপোর্টে কেবল পুরানো বিক্রিটি
  const old = buildReport("sales", input("2026-09-12", "2026-09-12"), data({ sales: [backSale, todaySale] }));
  assert.equal(old.rows.length, 1);
  assert.equal(old.rows[0].cells[0], "১২/৯/২০২৬");

  // ১৮ সেপ্টেম্বরের রিপোর্টে কেবল আজকের বিক্রি
  const now = buildReport("sales", input("2026-09-18", "2026-09-18"), data({ sales: [backSale, todaySale] }));
  assert.equal(now.rows.length, 1);
  assert.equal(now.rows[0].cells[0], "১৮/৯/২০২৬");

  // পুরো মাসে দুটোই
  const month = buildReport("sales", input("2026-09-01", "2026-09-30"), data({ sales: [backSale, todaySale] }));
  assert.equal(month.rows.length, 2);
});

test("পুরানো তারিখের ক্রয় ও স্টক সমন্বয় — স্টক ও ক্রয় রিপোর্টে ঠিক জায়গায়", () => {
  const rows = computeStock(
    [product({ opening_stock: 10 })],
    [purchase({ date: entryISOOn("2026-08-20"), quantity: 50 })],
    [sale({ date: entryISOOn("2026-09-01"), items: [{ product_id: "p1", product_name: "সয়ামিল", quantity: 5, unit: "বস্তা", sale_price: 120, purchase_price: 100, total: 600, profit: 100 }] })],
    [adjustment({ date: "2026-08-25", quantity: -3 })],
  );
  // ১০ + ৫০ − ৫ − ৩ = ৫২ — তারিখ যাই হোক স্টক সঠিক থাকে
  assert.equal(rows[0].currentStock, 52);
  assert.equal(rows[0].totalPurchased, 50);

  const purchaseReport = buildReport(
    "purchase",
    input("2026-08-01", "2026-08-31"),
    data({ purchases: [purchase({ date: entryISOOn("2026-08-20"), quantity: 50 })] }),
  );
  assert.equal(purchaseReport.rows.length, 1);
  assert.equal(purchaseReport.rows[0].cells[0], "২০/৮/২০২৬");

  // আগস্টের রিপোর্টে সেপ্টেম্বরের বিক্রি আসবে না
  const emptyOld = buildReport("sales", input("2026-08-01", "2026-08-31"), data({ sales: [sale({ date: entryISOOn("2026-09-01") })] }));
  assert.equal(emptyOld.rows.length, 0);
});

test("entryISOOn / isBackdated — তারিখ ঠিক রাখে, সময় চলতি ঘড়ি অনুযায়ী", () => {
  const base = new Date(2026, 8, 18, 14, 35, 9); // ১৮ সেপ্টেম্বর ২০২৬, ১৪:৩৫:০৯
  assert.equal(entryISOOn("2026-08-15", base), "2026-08-15T14:35:09");
  assert.equal(entryISOOn("2026-01-01", base), "2026-01-01T14:35:09");
  // খালি/অবৈধ হলে আজকের তারিখেই এন্ট্রি
  assert.equal(entryISOOn("", base), "2026-09-18T14:35:09");
  assert.equal(entryISOOn(" nonsense ", base), "2026-09-18T14:35:09");

  assert.equal(isBackdated("2026-09-18", "2026-09-18"), false);
  assert.equal(isBackdated("2026-09-17", "2026-09-18"), true);
  assert.equal(isBackdated("", "2026-09-18"), false);
  assert.equal(dateKeyToday(), toDateKey(new Date()));
});

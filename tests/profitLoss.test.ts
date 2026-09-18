import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProfitLoss, rangeFor, inRange } from "../src/lib/profitLoss";
import type { Sale, Purchase, Expense } from "../src/types";

const sale = (o: Partial<Sale>): Sale => ({
  id: "s", date: "2026-09-18", items: [], total_amount: 1000, total_profit: 200,
  payment_type: "নগদ", branch_id: "a", created_by: "u", created_at: "", ...o,
});
const purchase = (o: Partial<Purchase>): Purchase => ({
  id: "p", date: "2026-09-18", product_id: "x", product_name: "x", quantity: 1, unit: "kg",
  purchase_price: 5000, total: 5000, branch_id: "a", created_at: "", ...o,
});
const expense = (o: Partial<Expense>): Expense => ({
  id: "e", date: "2026-09-18", category: "ভাড়া", amount: 150, branch_id: "a", created_at: "", ...o,
});

test("net profit = gross profit − expenses; purchases are not deducted", () => {
  const r = computeProfitLoss(
    [sale({}), sale({ id: "s2", payment_type: "বাকি", total_amount: 500, total_profit: 100 })],
    [expense({}), expense({ id: "e2", category: "বিদ্যুৎ", amount: 50 })],
    [purchase({})],
    { from: "2026-09-18", to: "2026-09-18" },
  );
  assert.equal(r.revenue, 1500);
  assert.equal(r.grossProfit, 300);
  assert.equal(r.cogs, 1200);
  assert.equal(r.expenseTotal, 200);
  assert.equal(r.netProfit, 100);
  assert.equal(r.purchaseTotal, 5000);
  assert.equal(r.dueSales, 500);
  assert.equal(r.cashSales, 1000);
  assert.deepEqual(r.expensesByCategory, [
    { category: "ভাড়া", amount: 150 },
    { category: "বিদ্যুৎ", amount: 50 },
  ]);
});

test("loss is negative net profit", () => {
  const r = computeProfitLoss([sale({})], [expense({ amount: 900 })], [], { from: "2026-09-18", to: "2026-09-18" });
  assert.equal(r.netProfit, -700);
});

test("range and branch filtering", () => {
  const r = computeProfitLoss(
    [sale({}), sale({ id: "old", date: "2026-08-31" }), sale({ id: "b", branch_id: "b" })],
    [expense({ date: "2026-09-01T10:00:00.000Z" })],
    [],
    { from: "2026-09-01", to: "2026-09-30" },
    "a",
  );
  assert.equal(r.saleCount, 1);
  assert.equal(r.expenseTotal, 150);
});

test("rangeFor helpers", () => {
  const d = new Date(2026, 8, 18);
  assert.deepEqual(rangeFor("daily", d), { from: "2026-09-18", to: "2026-09-18" });
  assert.deepEqual(rangeFor("monthly", d), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(rangeFor("custom", d, { from: "2026-09-10", to: "2026-09-01" }), { from: "2026-09-01", to: "2026-09-10" });
  assert.ok(inRange("2026-09-18T05:00:00Z", { from: "2026-09-18", to: "2026-09-18" }));
});

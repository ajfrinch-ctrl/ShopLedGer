import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStock } from "../src/lib/stock";
import type { Product, Purchase, Sale, StockAdjustment } from "../src/types";

const product: Product = {
  id: "p1", name: "গম", unit: "কেজি", opening_stock: 100, purchase_price: 40, sale_price: 50,
  min_stock: 20, branch_id: "a", created_at: "", updated_at: "",
};
const purchases: Purchase[] = [{ id: "pu", date: "2026-09-01", product_id: "p1", product_name: "গম", quantity: 50, unit: "কেজি", purchase_price: 40, total: 2000, branch_id: "a", created_at: "" }];
const sales: Sale[] = [{
  id: "s", date: "2026-09-02", total_amount: 0, total_profit: 0, payment_type: "নগদ", branch_id: "a", created_by: "u", created_at: "",
  items: [{ product_id: "p1", product_name: "গম", quantity: 120, unit: "কেজি", sale_price: 50, purchase_price: 40, total: 6000, profit: 1200 }],
}];
const adj: StockAdjustment[] = [{ id: "a", date: "2026-09-03", product_id: "p1", product_name: "গম", quantity: -15, unit: "কেজি", reason: "ক্ষয়", branch_id: "a", created_by: "u", created_at: "" }];

test("current stock = opening + purchased − sold ± adjustments", () => {
  const [r] = computeStock([product], purchases, sales, adj);
  assert.equal(r.currentStock, 15);
  assert.equal(r.totalPurchased, 50);
  assert.equal(r.totalSold, 120);
  assert.equal(r.totalAdjusted, -15);
  assert.equal(r.stockValue, 600);
  assert.equal(r.isLow, true);
});

test("negative stock allowed, value floored at zero, low alert only when min_stock > 0", () => {
  const [r] = computeStock([{ ...product, min_stock: 0, opening_stock: 0 }], [], sales, []);
  assert.equal(r.currentStock, -120);
  assert.equal(r.stockValue, 0);
  assert.equal(r.isLow, false);
});

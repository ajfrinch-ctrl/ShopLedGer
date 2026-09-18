import { test } from "node:test";
import assert from "node:assert/strict";
import { nextCode, assignMissingCodes, normalizePrefix, matchesProduct, displayName, DEFAULT_CATEGORIES } from "../src/lib/productCode";
import type { Product } from "../src/types";

const p = (o: Partial<Product>): Product => ({
  id: o.id || "x", name: "তেল", unit: "লিটার", opening_stock: 0, purchase_price: 0, sale_price: 0,
  branch_id: "a", created_at: "", updated_at: "", ...o,
});

test("nextCode increments per prefix, zero-padded", () => {
  assert.equal(nextCode("OIL", []), "OIL-001");
  assert.equal(nextCode("OIL", [p({ code: "OIL-001" }), p({ code: "OIL-007" }), p({ code: "RICE-020" })]), "OIL-008");
  assert.equal(nextCode("RICE", [p({ code: "OIL-001" })]), "RICE-001");
});

test("assignMissingCodes fills gaps by category and keeps existing codes", () => {
  const out = assignMissingCodes(
    [p({ id: "1", category: "তেল" }), p({ id: "2", code: "OIL-005" }), p({ id: "3", category: "তেল" }), p({ id: "4" })],
    DEFAULT_CATEGORIES,
  );
  assert.deepEqual(out.map((x) => x.code), ["OIL-006", "OIL-005", "OIL-007", "GEN-001"]);
});

test("normalizePrefix and search helpers", () => {
  assert.equal(normalizePrefix(" oil-x "), "OILX");
  assert.equal(normalizePrefix("তেল"), "GEN");
  const tir = p({ company: "তীর", code: "OIL-001" });
  assert.equal(displayName(tir), "তেল – তীর");
  assert.ok(matchesProduct(tir, "oil-001"));
  assert.ok(matchesProduct(tir, "তীর"));
  assert.ok(!matchesProduct(tir, "রূপচাঁদা"));
});

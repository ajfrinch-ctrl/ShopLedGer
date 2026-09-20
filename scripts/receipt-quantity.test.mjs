import assert from "node:assert/strict";
import { test } from "node:test";
import { bnQuantity } from "../src/lib/format.ts";

test("receipt quantities retain fractional purchases instead of rounding them", () => {
  assert.equal(bnQuantity(2.5), "২.৫");
  assert.equal(bnQuantity(0.125), "০.১২৫");
  assert.equal(bnQuantity(3), "৩");
  assert.equal(bnQuantity(0), "০");
});

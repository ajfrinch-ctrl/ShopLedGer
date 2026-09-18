import "fake-indexeddb/auto";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, type LedgerEntry } from "../src/lib/db";
import { ledgerRows, saveLedgerEntry, supplierId } from "../src/lib/ledger";
import type { AuthUser } from "../src/stores/authStore";
const owner: AuthUser = {
  id: "owner",
  name: "Owner",
  phone: "",
  role: "owner",
  branch_id: "a",
};
const staff: AuthUser = {
  ...owner,
  id: "staff",
  role: "staff",
  branch_id: "b",
};
function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: crypto.randomUUID(),
    party_id: "customer",
    party_name: "Customer",
    party_type: "customer",
    kind: "opening",
    amount: 100,
    date: "2026-09-18",
    branch_id: "a",
    method: "নগদ টাকা",
    reference: "",
    note: "",
    cancelled: false,
    created_at: new Date().toISOString(),
    created_by: owner.id,
    ...overrides,
  };
}
beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.branches.bulkAdd(
    ["a", "b"].map((id) => ({
      id,
      name: id,
      is_active: true,
      created_at: new Date().toISOString(),
    })),
  );
});
test("cross-branch partial payments, cancellation and audit snapshots", async () => {
  const opening = entry();
  await saveLedgerEntry(opening, owner, [], []);
  const payment = entry({ kind: "payment", amount: 40, branch_id: "b" });
  await saveLedgerEntry(payment, staff, [], []);
  assert.equal(
    ledgerRows("customer", [], [], await db.ledgerEntries.toArray()).at(-1)
      ?.balance,
    60,
  );
  await saveLedgerEntry(
    { ...payment, amount: 50 },
    staff,
    [],
    [],
    "correct amount",
  );
  const audit = (await db.ledgerAudits.toArray()).find(
    (a) => a.action === "সংশোধন",
  )!;
  assert.equal(audit.before?.amount, 40);
  assert.equal(audit.after.amount, 50);
  await saveLedgerEntry(
    { ...payment, amount: 50, cancelled: true },
    staff,
    [],
    [],
    "duplicate",
  );
  assert.equal(
    ledgerRows("customer", [], [], await db.ledgerEntries.toArray()).at(-1)
      ?.balance,
    100,
  );
  assert.equal(await db.ledgerAudits.count(), 4);
  assert.ok(await db.customers.get("customer"));
});
test("overpayment and backdated payments roll back without audit", async () => {
  await saveLedgerEntry(entry(), owner, [], []);
  await assert.rejects(
    saveLedgerEntry(entry({ kind: "payment", amount: 101 }), owner, [], []),
    /বকেয়ার/,
  );
  await assert.rejects(
    saveLedgerEntry(
      entry({ kind: "payment", amount: 10, date: "2026-09-17" }),
      owner,
      [],
      [],
    ),
    /বকেয়ার/,
  );
  assert.equal(await db.ledgerEntries.count(), 1);
  assert.equal(await db.ledgerAudits.count(), 1);
});
test("cannot reduce or cancel opening balance below subsequent payments", async () => {
  const opening = entry();
  await saveLedgerEntry(opening, owner, [], []);
  await saveLedgerEntry(entry({ kind: "payment", amount: 80 }), owner, [], []);
  await assert.rejects(
    saveLedgerEntry({ ...opening, amount: 70 }, owner, [], [], "correction"),
    /বকেয়ার/,
  );
  await assert.rejects(
    saveLedgerEntry({ ...opening, cancelled: true }, owner, [], [], "cancel"),
    /বকেয়ার/,
  );
});
test("role, branch, reason and amount validation", async () => {
  const original = entry();
  await saveLedgerEntry(original, owner, [], []);
  await assert.rejects(
    saveLedgerEntry({ ...original, amount: 200 }, staff, [], [], "edit"),
    /অনুমতি/,
  );
  await assert.rejects(
    saveLedgerEntry(entry(), { ...owner, role: "customer" }, [], []),
    /অনুমতি/,
  );
  await assert.rejects(
    saveLedgerEntry({ ...original, amount: 200 }, owner, [], []),
    /কারণ/,
  );
  for (const amount of [NaN, Infinity, -1, 0, 1.001])
    await assert.rejects(saveLedgerEntry(entry({ amount }), owner, [], []));
});
test("concurrent payments cannot both spend the same outstanding balance", async () => {
  await saveLedgerEntry(entry(), owner, [], []);
  const results = await Promise.allSettled([
    saveLedgerEntry(entry({ kind: "payment", amount: 70 }), owner, [], []),
    saveLedgerEntry(entry({ kind: "payment", amount: 70 }), owner, [], []),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
test("supplier names normalized; legacy and cash purchases excluded", () => {
  assert.equal(supplierId("  ABC   Store "), supplierId("abc store"));
  const p = {
    id: "p",
    date: "2026-09-18",
    product_id: "x",
    product_name: "X",
    quantity: 1,
    unit: "kg",
    purchase_price: 50,
    total: 50,
    supplier: "ABC",
    branch_id: "a",
    created_at: "",
  };
  const rows = ledgerRows(
    supplierId("abc"),
    [],
    [
      p,
      { ...p, id: "cash", payment_type: "নগদ" },
      { ...p, id: "due", branch_id: "b", payment_type: "বাকি" },
    ],
    [],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].balance, 50);
});
test("fractional amounts balance exactly", async () => {
  await saveLedgerEntry(entry({ amount: 0.3 }), owner, [], []);
  await saveLedgerEntry(entry({ kind: "payment", amount: 0.1 }), owner, [], []);
  await saveLedgerEntry(entry({ kind: "payment", amount: 0.2 }), owner, [], []);
  assert.equal(
    ledgerRows("customer", [], [], await db.ledgerEntries.toArray()).at(-1)
      ?.balance,
    0,
  );
});
test("version 1 database upgrades without losing existing branches and collections", async () => {
  const { default: Dexie } = await import("dexie");
  await db.delete();
  const old = new Dexie("shopledger-db");
  old
    .version(1)
    .stores({
      users: "id, phone, role, branch_id, is_active",
      branches: "id, is_active",
      products: "id, branch_id, name",
      purchases: "id, product_id, branch_id, date",
      sales: "id, branch_id, date, customer_id, created_by",
      customers: "id, branch_id, name, phone",
      collections: "id, customer_id, branch_id, date",
      expenses: "id, branch_id, date, category",
      orders: "id, customer_id, branch_id, status",
    });
  await old.table("branches").add({ id: "legacy", name: "Legacy" });
  await old
    .table("collections")
    .add({
      id: "old-payment",
      customer_id: "customer",
      amount: 10,
      date: "2026-09-18",
      branch_id: "legacy",
    });
  old.close();
  await db.open();
  assert.equal((await db.branches.get("legacy"))?.name, "Legacy");
  assert.equal(await db.ledgerEntries.count(), 0);
  assert.equal(
    ledgerRows(
      "customer",
      [],
      [],
      [entry()],
      await db.collections.toArray(),
    ).at(-1)?.balance,
    90,
  );
});

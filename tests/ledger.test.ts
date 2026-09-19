import "fake-indexeddb/auto";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, type LedgerEntry } from "../src/lib/db";
import { ledgerRows, ledgerScopeFor, paymentCapacity, saveLedgerEntry, supplierId, validLedgerDate } from "../src/lib/ledger";
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
  role: "manager",
  branch_id: "b",
  branch_ids: ["b"],
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
  const assigned = { ...staff, branch_ids: ["a", "b"] };
  await saveLedgerEntry(opening, owner, [], []);
  const payment = entry({ kind: "payment", amount: 40, branch_id: "b" });
  await saveLedgerEntry(payment, assigned, [], []);
  assert.equal(
    ledgerRows("customer", [], [], await db.ledgerEntries.toArray()).at(-1)
      ?.balance,
    60,
  );
  await saveLedgerEntry(
    { ...payment, amount: 50 },
    assigned,
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
    assigned,
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
    [],
    { partyType: "supplier" },
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

test("customer/supplier accounts cannot collide even with the same party ID", () => {
  const entries = [entry({ id: 'customer-opening', amount: 100 }), entry({ id: 'supplier-opening', party_type: 'supplier', amount: 900 }),
    entry({ id: 'supplier-payment', party_type: 'supplier', kind: 'payment', amount: 200 })];
  assert.equal(ledgerRows('customer', [], [], entries).at(-1)?.balance, 100);
  assert.equal(ledgerRows('customer', [], [], entries, [], { partyType: 'supplier' }).at(-1)?.balance, 700);
});

test("unauthorized debt is not spendable; authorized combined accounts stay supported", async () => {
  await saveLedgerEntry(entry(), owner, [], []);
  await assert.rejects(saveLedgerEntry(entry({ kind: 'payment', amount: 10, branch_id: 'b' }), staff, [], []), /বকেয়ার/);
  assert.equal(ledgerRows('customer', [], [], await db.ledgerEntries.toArray(), [], ledgerScopeFor(staff)).length, 0);
  assert.equal(ledgerRows('customer', [], [], await db.ledgerEntries.toArray(), [], { branchIds: [] }).length, 0);
  assert.equal(await db.ledgerAudits.count(), 1);
});

test("cross-branch receipts cannot spend an already settled consolidated balance", async () => {
  await saveLedgerEntry(entry({ branch_id: 'b' }), owner, [], []);
  await saveLedgerEntry(entry({ kind: 'payment', amount: 100, branch_id: 'a' }), owner, [], []);
  await assert.rejects(saveLedgerEntry(entry({ kind: 'payment', amount: 10, branch_id: 'b' }), staff, [], []), /বকেয়ার/);
  assert.equal(await db.ledgerEntries.count(), 2);
});

test("salesman cannot create supplier payables or payments", async () => {
  const supplier = entry({ party_type: 'supplier', party_id: supplierId('ABC'), party_name: 'ABC' });
  await assert.rejects(saveLedgerEntry(supplier, { ...owner, role: 'salesman', branch_ids: ['a'] }, [], []), /অনুমতি/);
  await saveLedgerEntry(supplier, owner, [], []);
  assert.equal((await db.customers.toArray()).length, 0);
});

test("party type is immutable; creator metadata cannot be rewritten", async () => {
  const first = entry();
  await saveLedgerEntry(first, owner, [], []);
  const saved = (await db.ledgerEntries.get(first.id))!;
  await assert.rejects(saveLedgerEntry({ ...saved, party_type: 'supplier' }, owner, [], [], 'change type'));
  await saveLedgerEntry({ ...saved, created_by: 'forged', created_at: '1900-01-01', amount: 150 }, owner, [], [], 'fix amount', saved);
  const updated = (await db.ledgerEntries.get(first.id))!;
  assert.equal(updated.created_by, owner.id);
  assert.equal(updated.created_at, saved.created_at);
});

test("invalid calendar days, future dates, invalid enum and supplier key are rejected", async () => {
  assert.equal(validLedgerDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '', '2026-9-1', '2999-01-01'])
    await assert.rejects(saveLedgerEntry(entry({ date }), owner, [], []));
  for (const patch of [{ kind: 'unknown' }, { party_type: 'other' }, { cancelled: true }, { party_type: 'supplier', party_name: 'ABC' }])
    await assert.rejects(saveLedgerEntry(entry(patch as Partial<LedgerEntry>), owner, [], []));
  assert.equal(await db.ledgerAudits.count(), 0);
});

test("stale edits and receipt ID collisions do not overwrite entries", async () => {
  const first = entry();
  await saveLedgerEntry(first, owner, [], [], '', null);
  const saved = (await db.ledgerEntries.get(first.id))!;
  await assert.rejects(saveLedgerEntry({ ...saved, amount: 999 }, owner, [], [], '', null), /ইতিমধ্যে/);
  await saveLedgerEntry({ ...saved, amount: 110 }, owner, [], [], 'edit', saved);
  await assert.rejects(saveLedgerEntry({ ...saved, amount: 120 }, owner, [], [], 'stale', saved), /ইতিমধ্যে/);
  assert.equal((await db.ledgerEntries.get(first.id))?.amount, 110);
  assert.equal(await db.ledgerAudits.count(), 2);
});

test("new-customer ID collision does not merge two people's opening debt", async () => {
  await saveLedgerEntry(entry(), owner, [], []);
  await assert.rejects(saveLedgerEntry(entry({ party_name: 'Another person' }), owner, [], [], '', null, true), /আইডি/);
  assert.equal(await db.ledgerEntries.count(), 1);
});

test("backdated payment capacity reserves subsequent payments", async () => {
  await saveLedgerEntry(entry({ date: '2026-09-01' }), owner, [], []);
  await saveLedgerEntry(entry({ date: '2026-09-15', kind: 'payment', amount: 80 }), owner, [], []);
  const rows = ledgerRows('customer', [], [], await db.ledgerEntries.toArray());
  assert.equal(paymentCapacity(rows, '2026-08-31'), 0);
  assert.equal(paymentCapacity(rows, '2026-09-05'), 20);
  await assert.rejects(saveLedgerEntry(entry({ kind: 'payment', amount: 21, date: '2026-09-05' }), owner, [], []), /বকেয়ার/);
  await saveLedgerEntry(entry({ kind: 'payment', amount: 20, date: '2026-09-05' }), owner, [], []);
});

test("inactive branches accept cancellation of old records, not new records", async () => {
  const first = entry();
  await saveLedgerEntry(first, owner, [], []);
  await db.branches.update('a', { is_active: false });
  await assert.rejects(saveLedgerEntry(entry(), owner, [], []), /সক্রিয়/);
  await saveLedgerEntry({ ...first, cancelled: true }, owner, [], [], 'branch closed');
  assert.equal((await db.ledgerEntries.get(first.id))?.cancelled, true);
});

test("row source separates legacy receipts from ledger IDs", () => {
  const rows = ledgerRows('customer', [], [], [entry({ id: 'same', amount: 100 })], [{ id: 'same', customer_id: 'customer', date: '2026-09-18', amount: 20, branch_id: 'a' }]);
  assert.deepEqual(rows.map(r => r.source), ['ledger', 'legacy']);
  assert.equal(rows[1].balance, 80);
});

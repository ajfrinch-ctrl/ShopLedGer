import { db, type LedgerEntry } from "./db";
import type { Purchase, Sale } from "../types";
import type { AuthUser } from "../stores/authStore";

export const supplierId = (name: string) =>
  `supplier:${name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()}`;
export const money = (n: number) =>
  `৳ ${n.toLocaleString("bn-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const cents = (n: number) => Math.round(n * 100);
export interface LedgerRow {
  order?: string;
  id: string;
  date: string;
  branch_id: string;
  label: string;
  debit: number;
  credit: number;
  balance: number;
}
export function ledgerRows(
  party: string,
  sales: Sale[],
  purchases: Purchase[],
  entries: LedgerEntry[],
  collections: {
    id: string;
    customer_id: string;
    date: string;
    branch_id: string;
    amount: number;
  }[] = [],
): LedgerRow[] {
  const rows: Omit<LedgerRow, "balance">[] = [];
  sales
    .filter((s) => s.customer_id === party && s.payment_type === "বাকি")
    .forEach((s) =>
      rows.push({
        id: s.id,
        date: s.date,
        branch_id: s.branch_id,
        label: "বিক্রয় বিল",
        debit: cents(s.total_amount),
        credit: 0,
      }),
    );
  purchases
    .filter(
      (p) =>
        p.supplier &&
        supplierId(p.supplier) === party &&
        p.payment_type === "বাকি",
    )
    .forEach((p) =>
      rows.push({
        id: p.id,
        date: p.date,
        branch_id: p.branch_id,
        label: "ক্রয় বিল",
        debit: cents(p.total),
        credit: 0,
      }),
    );
  collections
    .filter((c) => c.customer_id === party)
    .forEach((c) =>
      rows.push({
        id: c.id,
        date: c.date,
        branch_id: c.branch_id,
        label: "পূর্বের আদায়",
        debit: 0,
        credit: cents(c.amount),
      }),
    );
  entries
    .filter((e) => e.party_id === party && !e.cancelled)
    .forEach((e) =>
      rows.push({
        id: e.id,
        order: e.created_at,
        date: e.date,
        branch_id: e.branch_id,
        label:
          e.kind === "opening"
            ? "পুরোনো বাকি"
            : e.party_type === "customer"
              ? "আদায়"
              : "পরিশোধ",
        debit: e.kind === "opening" ? cents(e.amount) : 0,
        credit: e.kind === "payment" ? cents(e.amount) : 0,
      }),
    );
  let balance = 0;
  return rows
    .sort(
      (a, b) =>
        a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)) ||
        Number(a.credit > 0) - Number(b.credit > 0) ||
        (a.order || a.date).localeCompare(b.order || b.date) ||
        a.id.localeCompare(b.id),
    )
    .map((r) => {
      balance += r.debit - r.credit;
      return {
        ...r,
        debit: r.debit / 100,
        credit: r.credit / 100,
        balance: balance / 100,
      };
    });
}
export async function saveLedgerEntry(
  entry: LedgerEntry,
  actor: AuthUser,
  sales: Sale[],
  purchases: Purchase[],
  reason = "",
) {
  await db.transaction(
    "rw",
    db.ledgerEntries,
    db.ledgerAudits,
    db.branches,
    db.collections,
    db.customers,
    async () => {
      const before = await db.ledgerEntries.get(entry.id);
      if (
        actor.role === "customer" ||
        (actor.role === "staff" &&
          (entry.branch_id !== actor.branch_id ||
            (before && before.branch_id !== actor.branch_id)))
      )
        throw new Error("এই শাখার লেনদেন পরিবর্তনের অনুমতি নেই");
      if (!(await db.branches.get(entry.branch_id))?.is_active)
        throw new Error("সক্রিয় শাখা নির্বাচন করুন");
      if (
        !entry.party_id ||
        !entry.party_name.trim() ||
        !Number.isFinite(entry.amount) ||
        entry.amount <= 0 ||
        !Number.isSafeInteger(cents(entry.amount)) ||
        Math.abs(cents(entry.amount) - entry.amount * 100) > 0.0001 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
        !Number.isFinite(Date.parse(entry.date))
      )
        throw new Error(
          "সঠিক নাম, তারিখ ও টাকার পরিমাণ দিন (সর্বোচ্চ দুই দশমিক)",
        );
      if (before && (!reason.trim() || before.cancelled))
        throw new Error(
          "পরিবর্তনের কারণ দিন; বাতিল এন্ট্রি পরিবর্তন করা যাবে না",
        );
      if (
        before &&
        (before.party_id !== entry.party_id ||
          before.kind !== entry.kind ||
          before.branch_id !== entry.branch_id)
      )
        throw new Error("ব্যক্তি, ধরন ও শাখা পরিবর্তন করা যাবে না");
      const entries = (await db.ledgerEntries.toArray()).filter(
        (e) => e.id !== entry.id,
      );
      const rows = ledgerRows(
        entry.party_id,
        sales,
        purchases,
        [...entries, entry],
        await db.collections.toArray(),
      );
      if (rows.some((r) => r.balance < 0))
        throw new Error(
          "বকেয়ার বেশি আদায়/পরিশোধ বা আগের তারিখে ঋণাত্মক ব্যালেন্স করা যাবে না",
        );
      if (
        entry.party_type === "customer" &&
        !(await db.customers.get(entry.party_id))
      ) {
        await db.customers.add({
          id: entry.party_id,
          name: entry.party_name,
          branch_id: entry.branch_id,
          created_at: entry.created_at,
        });
      }
      await db.ledgerEntries.put(entry);
      await db.ledgerAudits.add({
        id: crypto.randomUUID(),
        entry_id: entry.id,
        actor: actor.name,
        actor_id: actor.id,
        at: new Date().toISOString(),
        action: before ? (entry.cancelled ? "বাতিল" : "সংশোধন") : "নতুন",
        before,
        after: entry,
        reason,
      });
    },
  );
}

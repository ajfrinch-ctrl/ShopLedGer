import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectionRecords,
  computeCollectionsReport,
  computeCustomerDues,
  computeSalesReport,
  duesShareText,
  rangeForPreset,
  rangeLabel,
  summariseDues,
  salesShareText,
} from "../src/lib/report";
import type { DbCollection, DbCustomer, LedgerEntry } from "../src/lib/db";
import type { Sale } from "../src/types";

const sale = (o: Partial<Sale>): Sale => ({
  id: "s", date: "2026-09-18", items: [], total_amount: 1000, total_profit: 200,
  payment_type: "নগদ", branch_id: "a", created_by: "staff-1", created_at: "", ...o,
});

const item = (o: Partial<Sale["items"][number]>) => ({
  product_id: "p1", product_name: "সয়াবিন তেল", quantity: 2, unit: "লিটার",
  sale_price: 100, purchase_price: 80, total: 200, profit: 40, ...o,
});

const entry = (o: Partial<LedgerEntry>): LedgerEntry => ({
  id: "e", party_id: "c1", party_name: "করিম", party_type: "customer", kind: "payment",
  amount: 500, date: "2026-09-18", branch_id: "a", method: "নগদ টাকা", reference: "",
  note: "", cancelled: false, created_at: "", created_by: "staff-1", ...o,
});

const legacy = (o: Partial<DbCollection>): DbCollection => ({
  id: "lc", date: "2026-09-01", customer_id: "c1", customer_name: "করিম", amount: 300,
  branch_id: "a", created_at: "", ...o,
});

const customer = (o: Partial<DbCustomer>): DbCustomer => ({
  id: "c1", name: "করিম", phone: "01700000000", branch_id: "a", created_at: "", ...o,
});

test("rangeForPreset প্রিসেট ও উল্টো কাস্টম রেঞ্জ ঠিক করে", () => {
  const base = new Date(2026, 8, 18); // ১৮ সেপ্টেম্বর ২০২৬
  assert.deepEqual(rangeForPreset("today", base), { from: "2026-09-18", to: "2026-09-18" });
  assert.deepEqual(rangeForPreset("yesterday", base), { from: "2026-09-17", to: "2026-09-17" });
  assert.deepEqual(rangeForPreset("last7", base), { from: "2026-09-12", to: "2026-09-18" });
  assert.deepEqual(rangeForPreset("thisMonth", base), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(rangeForPreset("lastMonth", base), { from: "2026-08-01", to: "2026-08-31" });
  assert.deepEqual(
    rangeForPreset("custom", base, { from: "2026-09-10", to: "2026-09-01" }),
    { from: "2026-09-01", to: "2026-09-10" },
  );
  assert.equal(rangeLabel({ from: "2026-09-01", to: "2026-09-10" }), "2026-09-01 থেকে 2026-09-10");
  assert.equal(rangeLabel({ from: "2026-09-01", to: "2026-09-01" }), "2026-09-01");
});

test("collectionRecords — বাতিল/সাপ্লায়ার বাদ, পুরোনো কালেকশন ধরা, শাখা ফিল্টার", () => {
  const records = collectionRecords(
    [
      entry({ id: "p1", amount: 500 }),
      entry({ id: "p2", cancelled: true, amount: 999 }), // বাতিল → বাদ
      entry({ id: "p3", kind: "opening", amount: 700 }), // পুরোনো বাকি → আদায় নয়
      entry({ id: "p4", party_type: "supplier", amount: 400 }), // সাপ্লায়ার → বাদ
      entry({ id: "p5", branch_id: "b", amount: 250 }), // অন্য শাখা
    ],
    [legacy({ id: "l1", amount: 300 }), legacy({ id: "l2", branch_id: "b", amount: 100 })],
  );
  // স্কোপ ছাড়া = সব শাখা, তাই l2/p5-ও থাকবে
  assert.deepEqual(records.map((r) => r.id).sort(), ["l1", "l2", "p1", "p5"]);

  const onlyA = collectionRecords(
    [entry({ id: "p1" }), entry({ id: "p5", branch_id: "b" })],
    [legacy({ id: "l1" }), legacy({ id: "l2", branch_id: "b" })],
    { branchId: "a" },
  );
  // নতুন তারিখ আগে আসে (সাজানো), আর সোর্স আলাদা করে চেনা যায়
  assert.deepEqual(onlyA.map((r) => r.id), ["p1", "l1"]);
  assert.equal(onlyA.find((r) => r.id === "p1")?.source, "ledger");
  assert.equal(onlyA.find((r) => r.id === "l1")?.source, "legacy");
});

test("computeSalesReport — সামারি, দৈনিক ও পণ্যভিত্তিক হিসাব", () => {
  const report = computeSalesReport(
    [
      sale({
        id: "s1",
        items: [item({}), item({ product_id: "p2", product_name: "চাল", unit: "কেজি", quantity: 5, total: 400, profit: 50 })],
        total_amount: 600, total_profit: 90, customer_id: "c1", customer_name: "করিম",
      }),
      sale({ id: "s2", date: "2026-09-17", payment_type: "বাকি", total_amount: 400, total_profit: 60, customer_id: "c1", customer_name: "করিম" }),
      sale({ id: "s3", date: "2026-08-30", total_amount: 5000, total_profit: 900 }), // রেঞ্জের বাইরে
      sale({ id: "s4", branch_id: "b", total_amount: 700, total_profit: 100 }), // অন্য শাখা
    ],
    { from: "2026-09-01", to: "2026-09-30" },
    { branchId: "a" },
  );
  assert.equal(report.billCount, 2);
  assert.equal(report.revenue, 1000);
  assert.equal(report.cashSales, 600);
  assert.equal(report.dueSales, 400);
  assert.equal(report.profit, 150);
  assert.equal(report.averageBill, 500);
  assert.equal(report.itemLines, 2);
  assert.deepEqual(report.byDate.map((d) => [d.date, d.bills, d.amount]), [
    ["2026-09-18", 1, 600],
    ["2026-09-17", 1, 400],
  ]);
  assert.equal(report.byProduct[0].name, "চাল");
  assert.equal(report.byCustomer[0].name, "করিম");
  assert.equal(report.byCustomer[0].due, 400);
  assert.deepEqual(report.byStaff, [{ staffId: "staff-1", bills: 2, amount: 1000, profit: 150 }]);
  assert.deepEqual(report.byBranch, [{ branchId: "a", bills: 2, amount: 1000, profit: 150 }]);
  assert.equal(report.rows[0].id, "s1");
});

test("computeCollectionsReport — মোট/গড়/সর্বোচ্চ ও ব্রেকডাউন", () => {
  const records = collectionRecords(
    [
      entry({ id: "p1", amount: 500, date: "2026-09-18" }),
      entry({ id: "p2", amount: 1500, date: "2026-09-18", method: "বিকাশ" }),
      entry({ id: "p3", amount: 200, date: "2026-09-10", party_id: "c2", party_name: "রহিম" }),
      entry({ id: "p4", amount: 900, date: "2026-08-20" }), // রেঞ্জের বাইরে
    ],
    [legacy({ id: "l1", amount: 300, date: "2026-09-18" })],
  );
  const report = computeCollectionsReport(records, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(report.count, 4);
  assert.equal(report.total, 2500);
  assert.equal(report.average, 625);
  assert.equal(report.largest, 1500);
  assert.equal(report.largestName, "করিম");
  assert.deepEqual(report.byDate[0], { date: "2026-09-18", count: 3, amount: 2300 });
  assert.equal(report.byCustomer[0].name, "করিম");
  assert.equal(report.byCustomer[0].amount, 2300);
  assert.equal(report.byMethod.find((m) => m.method === "বিকাশ")?.amount, 1500);
});

test("computeCustomerDues — বিক্রি + পুরোনো বাকি − আদায়", () => {
  const dues = computeCustomerDues(
    [customer({}), customer({ id: "c2", name: "রহিম" })],
    [
      sale({ id: "d1", payment_type: "বাকি", customer_id: "c1", customer_name: "করিম", total_amount: 2000 }),
      sale({ id: "d2", payment_type: "নগদ", customer_id: "c2", customer_name: "রহিম", total_amount: 999 }),
      sale({ id: "d3", payment_type: "বাকি", customer_id: "c2", customer_name: "রহিম", total_amount: 800, date: "2026-09-05" }),
      sale({ id: "d4", payment_type: "বাকি", customer_id: "c1", branch_id: "b", total_amount: 5000 }),
    ],
    [
      entry({ id: "o1", kind: "opening", amount: 500, date: "2026-08-01" }),
      entry({ id: "p1", kind: "payment", amount: 1200, date: "2026-09-12" }),
      entry({ id: "x1", kind: "payment", amount: 300, cancelled: true }), // বাতিল → গোনা হয় না
      entry({ id: "p2", kind: "payment", amount: 100, party_id: "c2", party_name: "রহিম", date: "2026-09-15" }),
    ],
    [legacy({ id: "l1", amount: 300, date: "2026-09-02" })],
  );
  assert.deepEqual(dues.map((d) => [d.customerId, d.due]), [
    ["c1", 6000], // 2000 + 5000 (শাখা খ) + পুরোনো 500 − আদায় 1200 − পুরোনো কালেকশন 300
    ["c2", 700], // বাকিতে 800 − আদায় 100
  ]);
  assert.equal(dues[0].phone, "01700000000");
  assert.equal(dues[0].lastPaymentDate, "2026-09-12");
  assert.equal(dues[0].lastSaleDate, "2026-09-18");

  // বাকি পরিশোধ হয়ে গেলে তালিকায় থাকে না
  const settled = computeCustomerDues([customer({})], [], [entry({ id: "p9", amount: 500 })], []);
  assert.deepEqual(settled, []);
});

test("computeCustomerDues — কর্মচারীর স্কোপ শুধু নিজের শাখার বাকি দেখে", () => {
  const dues = computeCustomerDues(
    [customer({}), customer({ id: "c2", name: "রহিম", branch_id: "b" })],
    [
      sale({ id: "d1", payment_type: "বাকি", customer_id: "c1", total_amount: 400, branch_id: "a" }),
      sale({ id: "d2", payment_type: "বাকি", customer_id: "c2", total_amount: 900, branch_id: "b" }),
    ],
    [],
    [],
    { branchId: "a" },
  );
  assert.deepEqual(dues.map((d) => [d.customerId, d.due]), [["c1", 400]]);
});

test("summariseDues ও শেয়ার টেক্সট", () => {
  const dues = [
    { customerId: "c1", name: "করিম", branchId: "a", due: 1500 },
    { customerId: "c2", name: "রহিম", branchId: "a", due: 500 },
  ];
  const summary = summariseDues(dues);
  assert.equal(summary.total, 2000);
  assert.equal(summary.customers, 2);
  assert.equal(summary.average, 1000);
  assert.equal(summary.topName, "করিম");

  const meta = {
    title: "বিক্রি রিপোর্ট",
    shopName: "ShopLedGer",
    branchName: "প্রধান শাখা",
    rangeNote: "2026-09-18",
  };
  const salesText = salesShareText(meta, computeSalesReport([sale({ items: [item({})] })], { from: "2026-09-18", to: "2026-09-18" }));
  assert.ok(salesText.includes("বিক্রি রিপোর্ট"));
  assert.ok(salesText.includes("প্রধান শাখা"));
  assert.ok(salesText.includes("সয়াবিন তেল"));

  const duesText = duesShareText(meta, dues, summary);
  assert.ok(duesText.includes("করিম"));
  assert.ok(duesText.includes("মোট বাকি"));
});

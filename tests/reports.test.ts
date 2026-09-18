import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, dueAccounts } from "../src/lib/reports/builders";
import { REPORT_CATALOG, PROFIT_KINDS, SALESMAN_HIDDEN_KINDS, reportsForRole, bnDate, monthRange, reportOptions, reportShareText, reportDefinition, type ReportData, type ReportInput, type ReportKind } from "../src/lib/reports/core";
import { sheetFileName, sheetImageName } from "../src/lib/reports/pdf";
import type { Product, Purchase, Sale, StockAdjustment } from "../src/types";
import type { DbCustomer, DbExpense, DbBranch, DbUser, LedgerEntry } from "../src/lib/db";

/* ── টেস্ট ডেটা ── */

const product = (o: Partial<Product>): Product => ({
  id: "p1", name: "সয়াবিন তেল", unit: "লিটার", opening_stock: 10, purchase_price: 100,
  sale_price: 120, branch_id: "a", created_at: "", updated_at: "", ...o,
});

const sale = (o: Partial<Sale>): Sale => ({
  id: "s1", date: "2026-09-18", items: [], total_amount: 1200, total_profit: 200,
  payment_type: "নগদ", branch_id: "a", created_by: "u1", created_at: "", ...o,
});

const item = (o: Partial<Sale["items"][number]>) => ({
  product_id: "p1", product_name: "সয়াবিন তেল", quantity: 10, unit: "লিটার",
  sale_price: 120, purchase_price: 100, total: 1200, profit: 200, ...o,
});

const purchase = (o: Partial<Purchase>): Purchase => ({
  id: "pu1", date: "2026-09-05", product_id: "p1", product_name: "সয়াবিন তেল",
  quantity: 50, unit: "লিটার", purchase_price: 100, total: 5000, supplier: "রহিম ট্রেডার্স",
  payment_type: "নগদ", branch_id: "a", created_at: "", ...o,
});

const expense = (o: Partial<DbExpense>): DbExpense => ({
  id: "e1", date: "2026-09-18", category: "ভাড়া", amount: 500, kind: "shop",
  branch_id: "a", note: "সেপ্টেম্বরের ভাড়া", created_at: "", ...o,
});

const entry = (o: Partial<LedgerEntry>): LedgerEntry => ({
  id: "le1", party_id: "c1", party_name: "ক্রেতা করিম", party_type: "customer", kind: "payment",
  amount: 400, date: "2026-09-15", branch_id: "a", method: "বিকাশ", reference: "", note: "",
  cancelled: false, created_at: "", created_by: "u1", ...o,
});

const customer = (o: Partial<DbCustomer>): DbCustomer => ({
  id: "c1", name: "ক্রেতা করিম", phone: "01700000000", branch_id: "a", created_at: "", ...o,
});

const adjustment = (o: Partial<StockAdjustment>): StockAdjustment => ({
  id: "adj1", date: "2026-09-10", product_id: "p1", product_name: "সয়াবিন তেল", quantity: -2,
  unit: "লিটার", reason: "নষ্ট", branch_id: "a", created_by: "u1", created_at: "", ...o,
});

const branch = (o: Partial<DbBranch>): DbBranch => ({
  id: "a", name: "প্রধান শাখা", organization: "রহিম ফিড স্টোর", is_active: true, created_at: "", ...o,
});

const user = (o: Partial<DbUser>): DbUser => ({
  id: "u1", name: "কর্মচারী রহিম", phone: "017", password_hash: "", role: "staff",
  branch_id: "a", is_active: true, created_at: "", updated_at: "", ...o,
});

function makeData(): ReportData {
  return {
    sales: [
      sale({ id: "s1", items: [item({})], total_amount: 1200, total_profit: 200 }),
      sale({
        id: "s2", date: "2026-09-12", payment_type: "বাকি", customer_id: "c1", customer_name: "ক্রেতা করিম",
        items: [item({ quantity: 5, total: 600, profit: 100 })], total_amount: 600, total_profit: 100,
      }),
      sale({ id: "s3", branch_id: "b", date: "2026-09-18", total_amount: 900, total_profit: 150, items: [item({ total: 900 })] }),
    ],
    purchases: [purchase({})],
    products: [product({}), product({ id: "p2", name: "চাল", unit: "কেজি", opening_stock: 20, purchase_price: 60, sale_price: 75 })],
    adjustments: [adjustment({})],
    expenses: [expense({}), expense({ id: "e2", category: "সংসার খরচ", kind: "owner", amount: 3000, note: "" })],
    entries: [entry({}), entry({ id: "le2", kind: "opening", amount: 2000, date: "2026-08-01", method: "নগদ টাকা" })],
    collections: [],
    customers: [customer({})],
    branches: [branch({}), branch({ id: "b", name: "দ্বিতীয় শাখা" })],
    users: [user({})],
  };
}

// ডিফল্ট স্কোপ = শাখা a (যেমন একজন কর্মচারীর নিজের শাখা); অন্য স্কোপ টেস্টে আলাদা করে দেওয়া হয়
const input = (o: Partial<ReportInput> = {}): ReportInput => ({
  from: "2026-09-01", to: "2026-09-30", month: "2026-09", scope: { branchId: "a" }, ...o,
});

/* ── ক্যাটালগ ── */

test("ক্যাটালগে ১০টি রিপোর্ট আছে, প্রতিটির নিজস্ব ফিল্টার স্পেক", () => {
  assert.equal(REPORT_CATALOG.length, 10);
  assert.equal(new Set(REPORT_CATALOG.map((r) => r.kind)).size, 10);
  for (const def of REPORT_CATALOG) {
    assert.ok(def.label.length > 0 && def.desc.length > 0);
    assert.ok(Object.keys(def.filters).length > 0, `${def.kind}-এ ফিল্টার নেই`);
  }
  assert.deepEqual(reportDefinition("dailyProfit").filters, { singleDate: true });
  assert.deepEqual(reportDefinition("monthlyProfit").filters, { month: true });
  assert.equal(reportDefinition("sales").filters.dateRange, "required");
  assert.equal(reportDefinition("stock").filters.dateRange, "optional");
  assert.equal(reportDefinition("product").filters.search, true);
});

test("monthRange ঠিক মাসের প্রথম ও শেষ দিন দেয়", () => {
  assert.deepEqual(monthRange("2026-09"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
});

/* ── ১. বিক্রি রিপোর্ট ── */

test("বিক্রি রিপোর্ট: পণ্য-ক্রেতা-নগদ/বাকি, পরিমাণ, মোট", () => {
  const doc = buildReport("sales", input(), makeData());
  assert.equal(doc.title, "বিক্রি রিপোর্ট");
  assert.equal(doc.rows.length, 2); // শাখা b বাদ
  assert.deepEqual(doc.columns.map((c) => c.label), ["তারিখ", "পণ্য", "ক্রেতা", "ধরন", "পরিমাণ", "দর", "বিক্রয় মূল্য"]);
  const find = (label: string) => doc.summary.find((s) => s.label === label)?.value;
  assert.equal(find("মোট বিক্রি"), "৳ ১,৮০০");
  assert.equal(find("নগদ বিক্রি"), "৳ ১,২০০");
  assert.equal(find("বাকিতে বিক্রি"), "৳ ৬০০");
  assert.equal(find("বিল সংখ্যা"), "২টি");
  assert.equal(doc.totals?.[6], "৳ ১,৮০০");
  assert.equal(doc.totals?.[4], "১৫");

  // ফিল্টার: শুধু বাকি
  const dueOnly = buildReport("sales", input({ paymentType: "বাকি" }), makeData());
  assert.equal(dueOnly.rows.length, 1);
  assert.ok(dueOnly.filterNote?.includes("বাকি"));

  // ফিল্টার: শুধু চাল পণ্য
  const rice = buildReport("sales", input({ productId: "p2" }), makeData());
  assert.equal(rice.rows.length, 0);
});

/* ── ২. ক্রয় রিপোর্ট ── */

test("ক্রয় রিপোর্ট: সাপ্লায়ার, পরিমাণ, ক্রয় দর ও মোট", () => {
  const doc = buildReport("purchase", input(), makeData());
  assert.deepEqual(doc.columns.map((c) => c.label), ["তারিখ", "পণ্য", "সাপ্লায়ার", "পরিমাণ", "ক্রয় দর", "ক্রয় মূল্য"]);
  assert.equal(doc.rows.length, 1);
  assert.equal(doc.summary.find((s) => s.label === "মোট ক্রয়")?.value, "৳ ৫,০০০");
  assert.equal(doc.totals?.[5], "৳ ৫,০০০");
  const filtered = buildReport("purchase", input({ supplier: "অন্য কেউ" }), makeData());
  assert.equal(filtered.rows.length, 0);
});

/* ── ৩. স্টক রিপোর্ট ── */

test("স্টক রিপোর্ট: ওপেনিং, ক্রয়, বিক্রয়, বর্তমান স্টক ও মূল্য", () => {
  const doc = buildReport("stock", input(), makeData());
  assert.deepEqual(doc.columns.map((c) => c.label), [
    "পণ্য", "ওপেনিং স্টক", "মোট ক্রয়", "মোট বিক্রয়", "বর্তমান স্টক", "ক্রয় মূল্য", "বিক্রয় মূল্য",
  ]);
  // সয়াবিন: ১ সেপ্টেম্বরের ওপেনিং ১০ + এই সময়ের ক্রয় ৫০ − এই সময়ের বিক্রয় ১৫ − সমন্বয় ২ = ৪৩
  const soybean = doc.rows.find((r) => r.cells[0] === "সয়াবিন তেল");
  assert.ok(soybean);
  assert.equal(soybean.cells[1], "১০ লিটার");
  assert.equal(soybean.cells[2], "৫০ লিটার");
  assert.equal(soybean.cells[3], "১৫ লিটার");
  assert.equal(soybean.cells[4].startsWith("৪৩"), true);
  // চাল: opening ২০, কিছুই হয়নি
  const rice = doc.rows.find((r) => r.cells[0] === "চাল");
  assert.equal(rice?.cells[4].startsWith("২০"), true);
  assert.ok(doc.summary.find((s) => s.label === "মোট ক্রয় মূল্য"));
  assert.ok(doc.summary.find((s) => s.label === "মোট বিক্রয় মূল্য"));
});

/* ── ৪. ক্রেতার বাকি রিপোর্ট ── */

test("ক্রেতার বাকি রিপোর্ট: বাকি বিক্রি, আদায় ও বর্তমান বাকি", () => {
  const doc = buildReport("customerDue", input(), makeData());
  assert.deepEqual(doc.columns.map((c) => c.label), ["ক্রেতা", "ফোন", "বাকিতে বিক্রি", "আদায়", "বর্তমান বাকি"]);
  // বাকি বিক্রি ৬০০ + পুরোনো বাকি ২০০০ − আদায় ৪০০ = ২২০০
  assert.equal(doc.rows[0].cells[0], "ক্রেতা করিম");
  assert.equal(doc.rows[0].cells[3], "৳ ৪০০");
  assert.equal(doc.rows[0].cells[4], "৳ ২,২০০");
  assert.equal(doc.summary.find((s) => s.label === "মোট বাকি")?.value, "৳ ২,২০০");
  assert.equal(doc.summary.find((s) => s.label === "সর্বোচ্চ বাকিওয়ালা")?.value, "ক্রেতা করিম");

  // 'to' তারিখের আগ পর্যন্ত হিসাব — সেপ্টেম্বরের বাকি বিক্রি বাদ পড়ে
  const augustOnly = buildReport("customerDue", input({ from: "", to: "2026-08-31" }), makeData());
  assert.equal(augustOnly.rows[0].cells[4], "৳ ২,০০০");
});

/* ── ৫. বাকি আদায় রিপোর্ট ── */

test("বাকি আদায় রিপোর্ট: তারিখ, ক্রেতা, পদ্ধতি, মোট", () => {
  const doc = buildReport("collection", input(), makeData());
  assert.deepEqual(doc.columns.map((c) => c.label), ["তারিখ", "ক্রেতা", "পেমেন্ট পদ্ধতি", "টাকা"]);
  assert.equal(doc.rows.length, 1);
  assert.equal(doc.rows[0].cells[2], "বিকাশ");
  assert.equal(doc.totals?.[3], "৳ ৪০০");
  assert.equal(doc.summary.find((s) => s.label === "মোট আদায়")?.value, "৳ ৪০০");

  const wrongMethod = buildReport("collection", input({ method: "রকেট" }), makeData());
  assert.equal(wrongMethod.rows.length, 0);
  const rightMethod = buildReport("collection", input({ method: "বিকাশ" }), makeData());
  assert.equal(rightMethod.rows.length, 1);
});

/* ── ৬. খরচ রিপোর্ট ── */

test("খরচ রিপোর্ট: খাত, বিবরণ, মোট ও ধরন ফিল্টার", () => {
  const doc = buildReport("expense", input(), makeData());
  assert.deepEqual(doc.columns.map((c) => c.label), ["তারিখ", "খরচের খাত", "বিবরণ", "টাকা"]);
  assert.equal(doc.rows.length, 2);
  assert.equal(doc.summary.find((s) => s.label === "মোট খরচ")?.value, "৳ ৩,৫০০");
  assert.equal(doc.summary.find((s) => s.label === "দোকানের খরচ")?.value, "৳ ৫০০");
  assert.equal(doc.summary.find((s) => s.label === "মালিকের টাকা তোলা")?.value, "৳ ৩,০০০");

  const shopOnly = buildReport("expense", input({ expenseKind: "shop" }), makeData());
  assert.equal(shopOnly.rows.length, 1);
  assert.equal(shopOnly.totals?.[3], "৳ ৫০০");
  const ownerOnly = buildReport("expense", input({ expenseKind: "owner" }), makeData());
  assert.equal(ownerOnly.totals?.[3], "৳ ৩,০০০");
});

/* ── ৭. দৈনিক লাভ রিপোর্ট ── */

test("দৈনিক লাভ রিপোর্ট: বিক্রি, ক্রয়মূল্য, খরচ, নিট লাভ, নগদ/বাকি, আদায়", () => {
  const doc = buildReport("dailyProfit", input({ from: "2026-09-18", to: "2026-09-18" }), makeData());
  const row = (label: string) => doc.rows.find((r) => r.cells[0] === label)?.cells[1];
  assert.equal(row("মোট বিক্রি"), "৳ ১,২০০");
  assert.equal(row("(−) বিক্রিত পণ্যের ক্রয়মূল্য"), "৳ ১,০০০");
  assert.equal(row("গ্রস লাভ"), "৳ ২০০");
  assert.equal(row("(−) দোকানের খরচ"), "৳ ৫০০");
  assert.equal(row("নিট লাভ"), "৳ -৩০০");
  assert.equal(row("নগদ বিক্রি"), "৳ ১,২০০");
  assert.equal(row("বাকিতে বিক্রি"), "৳ ০");
  assert.equal(row("এই দিনের বাকি আদায়"), "৳ ০");
  assert.equal(doc.rows.find((r) => r.cells[0] === "নিট লাভ")?.emphasis, true);
  assert.equal(doc.summary.find((s) => s.label === "নিট ক্ষতি")?.value, "৳ ৩০০");
});

/* ── ৮. মাসিক লাভ রিপোর্ট ── */

test("মাসিক লাভ রিপোর্ট: সব লাইন আইটেম + সমাপনী বাকি ও স্টক মূল্য", () => {
  const doc = buildReport("monthlyProfit", input(), makeData());
  const row = (label: string) => doc.rows.find((r) => r.cells[0] === label)?.cells[1];
  assert.equal(row("মোট বিক্রি"), "৳ ১,৮০০");
  assert.equal(row("(−) মোট পণ্য ক্রয়"), "৳ ৫,০০০");
  assert.equal(row("(−) বিক্রিত পণ্যের ক্রয়মূল্য"), "৳ ১,৫০০");
  assert.equal(row("গ্রস লাভ"), "৳ ৩০০");
  assert.equal(row("(−) দোকানের খরচ"), "৳ ৫০০");
  assert.equal(row("নিট লাভ"), "৳ -২০০");
  assert.equal(row("বাকিতে বিক্রি"), "৳ ৬০০");
  assert.equal(row("বাকি আদায়"), "৳ ৪০০");
  assert.equal(row("সমাপনী বাকি (পাওনা)"), "৳ ২,২০০");
  assert.ok(row("স্টক মূল্য (ক্রয়মূল্যে)")?.startsWith("৳ "));
  assert.equal(doc.period.length > 0, true);
});

/* ── ৯. পণ্য রিপোর্ট ── */

test("পণ্য রিপোর্ট: ক্রয় দর, বিক্রয় দর, ওপেনিং ও বর্তমান স্টক", () => {
  const doc = buildReport("product", input(), makeData());
  assert.deepEqual(doc.columns.map((c) => c.label), ["পণ্য", "ক্রয় দর", "বিক্রয় দর", "ওপেনিং স্টক", "বর্তমান স্টক"]);
  assert.equal(doc.rows.length, 2);
  const soybean = doc.rows.find((r) => r.cells[0] === "সয়াবিন তেল");
  assert.equal(soybean?.cells[1], "৳ ১০০");
  assert.equal(soybean?.cells[2], "৳ ১২০");
  assert.equal(soybean?.cells[3], "১০ লিটার");
  assert.equal(soybean?.cells[4].startsWith("৪৩"), true);
  assert.equal(doc.summary.find((s) => s.label === "পণ্য সংখ্যা")?.value, "২টি");

  const search = buildReport("product", input({ search: "চাল" }), makeData());
  assert.equal(search.rows.length, 1);
});

/* ── ১০. লেনদেন রিপোর্ট ── */

test("লেনদেন রিপোর্ট: সব ধরন, পণ্য/পক্ষ, পরিমাণ, টাকা, পেমেন্ট অবস্থা", () => {
  const doc = buildReport("transaction", input(), makeData());
  assert.deepEqual(doc.columns.map((c) => c.label), [
    "তারিখ", "লেনদেনের ধরন", "পণ্য", "ক্রেতা / সাপ্লায়ার", "পরিমাণ", "টাকা", "পেমেন্ট অবস্থা",
  ]);
  const types = new Set(doc.rows.map((r) => r.cells[1]));
  assert.ok(types.has("বিক্রি"));
  assert.ok(types.has("ক্রয়"));
  assert.ok(types.has("আদায়"));
  assert.ok(types.has("খরচ"));
  assert.ok(types.has("মালিকের টাকা তোলা"));
  // শাখা b বাদ, তাই ৯০০ নেই
  assert.equal(doc.summary.find((s) => s.label === "মোট বিক্রি")?.value, "৳ ১,৮০০");
  assert.equal(doc.summary.find((s) => s.label === "মোট ক্রয়")?.value, "৳ ৫,০০০");
  assert.equal(doc.summary.find((s) => s.label === "মোট খরচ")?.value, "৳ ৩,৫০০");

  // আগস্ট থেকে শুরু করলে পুরোনো বাকির এন্ট্রিও আসে
  const wider = buildReport("transaction", input({ from: "2026-01-01" }), makeData());
  assert.ok(new Set(wider.rows.map((r) => r.cells[1])).has("পুরোনো বাকি"));

  const typeFilter = buildReport("transaction", input({ txType: "ক্রয়" }), makeData());
  assert.deepEqual([...new Set(typeFilter.rows.map((r) => r.cells[1]))], ["ক্রয়"]);

  const search = buildReport("transaction", input({ search: "রহিম ট্রেডার্স" }), makeData());
  assert.equal(search.rows.length, 1);
});

/* ── স্কোপ (রোল) ও অপশন ── */

test("শাখা স্কোপ: কর্মচারী শুধু নিজের শাখার ডেটা পায়", () => {
  const kinds: ReportKind[] = ["sales", "purchase", "stock", "customerDue", "collection", "expense", "dailyProfit", "monthlyProfit", "product", "transaction"];
  for (const kind of kinds) {
    const scoped = buildReport(kind, input({ scope: { branchId: "b" } }), makeData());
    const flat = JSON.stringify(scoped.rows.concat({ cells: scoped.summary.map((s) => `${s.label} ${s.value}`) }));
    assert.ok(!flat.includes("রহিম ফিড স্টোর"));
    // শাখা b-তে শুধু s3 বিক্রি (৯০০) আছে
    if (kind === "sales") assert.equal(scoped.summary.find((s) => s.label === "মোট বিক্রি")?.value, "৳ ৯০০");
    if (kind === "product") assert.equal(scoped.rows.length, 0);
  }
});

test("reportOptions: স্কোপ ধরে পণ্য/ক্রেতা/সাপ্লায়ার/পদ্ধতির তালিকা", () => {
  const options = reportOptions(makeData(), {});
  assert.deepEqual(options.products.map((p) => p.name).sort(), ["চাল", "সয়াবিন তেল"]);
  assert.deepEqual(options.customers.map((c) => c.name), ["ক্রেতা করিম"]);
  assert.deepEqual(options.suppliers, ["রহিম ট্রেডার্স"]);
  assert.ok(options.expenseCategories.includes("ভাড়া"));
  assert.ok(options.methods.includes("বিকাশ"));

  const scoped = reportOptions(makeData(), { branchId: "b" });
  assert.equal(scoped.customers.length, 0); // শাখা b-তে ক্রেতা নেই
});

/* ── PDF ডকুমেন্ট ── */

test("রোল অনুযায়ী রিপোর্ট: ব্যবস্থাপক সব দেখে, সেলস ম্যান লাভ/ক্রয়/খরচ দেখে না", () => {
  assert.deepEqual([...PROFIT_KINDS].sort(), ["dailyProfit", "monthlyProfit"]);
  // লাভের রিপোর্ট ক্যাটালগেরই অংশ
  for (const kind of PROFIT_KINDS) {
    assert.ok(REPORT_CATALOG.some((r) => r.kind === kind), kind);
  }
  // মালিক ও ব্যবস্থাপক সব ১০টি রিপোর্ট দেখেন
  assert.equal(reportsForRole("owner").length, 10);
  assert.equal(reportsForRole("manager").length, 10);
  // সেলস ম্যান ক্রয়/খরচ/লেনদেন/লাভ দেখে না
  const salesmanKinds = reportsForRole("salesman").map((r) => r.kind);
  assert.equal(salesmanKinds.length, 10 - SALESMAN_HIDDEN_KINDS.length);
  for (const hidden of SALESMAN_HIDDEN_KINDS) {
    assert.ok(!salesmanKinds.includes(hidden), hidden);
  }
  // বিক্রি/ক্রেতার বাকি/আদায়/স্টক/পণ্য সেলস ম্যানের জন্য খোলা
  for (const allowed of ["sales", "customerDue", "collection", "stock", "product"] as ReportKind[]) {
    assert.ok(salesmanKinds.includes(allowed), allowed);
  }
});

test("dueAccounts ও শেয়ার টেক্সট", () => {
  const accounts = dueAccounts(makeData(), {}, "", "2026-09-30");
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].balance, 2200);

  const doc = buildReport("sales", input(), makeData());
  const text = reportShareText(doc, "রহিম ফিড স্টোর", "প্রধান শাখা");
  assert.ok(text.includes("বিক্রি রিপোর্ট"));
  assert.ok(text.includes("রহিম ফিড স্টোর"));
  assert.ok(text.includes("মোট বিক্রি"));
});

test("PDF ফাইল-নাম: নিয়মিত, বাংলা-হীন, নিরাপদ", () => {
  assert.equal(sheetFileName("sales-report", "2026-09-01_2026-09-30"), "sales-report-2026-09-01_2026-09-30.pdf");
  assert.equal(sheetFileName("monthlyProfit-report", "2026-09"), "monthlyProfit-report-2026-09.pdf");
  assert.equal(sheetFileName("dailyProfit-report", "2026-09-18"), "dailyProfit-report-2026-09-18.pdf");
  // কিছু না থাকলে fallback, আর স্পেস/নিষিদ্ধ অক্ষর ঢুকে যায় না
  assert.equal(sheetFileName("stock-report", ""), "stock-report-report.pdf");
  assert.equal(sheetFileName("expense-report", "a b/c"), "expense-report-a-b-c.pdf");
});

test("শেয়ারে সবসময় ছবি: .pdf নাম থেকেই .jpg নাম তৈরি হয়", () => {
  // এক পেজ = একটা ছবি
  assert.equal(sheetImageName("sales-report-2026-09-01_2026-09-30.pdf", 1, 1), "sales-report-2026-09-01_2026-09-30.jpg");
  // লম্বা রিপোর্ট = একাধিক ছবি, প্রতিটি আলাদা নামে (নহলে WhatsApp-এ মিশে যায়)
  assert.equal(sheetImageName("sales-report-2026-09-01_2026-09-30.pdf", 1, 3), "sales-report-2026-09-01_2026-09-30-1.jpg");
  assert.equal(sheetImageName("sales-report-2026-09-01_2026-09-30.pdf", 3, 3), "sales-report-2026-09-01_2026-09-30-3.jpg");
  // রসিদের নামও একই নিয়মে যায়
  assert.equal(sheetImageName("receipt-s1.pdf", 1, 1), "receipt-s1.jpg");
  assert.equal(sheetImageName("receipt-s1", 2, 2), "receipt-s1-2.jpg");
});

test("bnDate: বাংলা তারিখ, বছরে হাজার-বিভাজক বসে না", () => {
  assert.equal(bnDate("2026-09-15"), "১৫/৯/২০২৬");
  assert.equal(bnDate("2026-12-31"), "৩১/১২/২০২৬");
  assert.equal(bnDate("2026-01-05"), "৫/১/২০২৬");
  assert.ok(!bnDate("2026-09-15").includes(","), "হাজার-বিভাজক থাকা যাবে না");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, dueAccounts, saleStatementLines } from "../src/lib/reports/builders";
import { REPORT_CATALOG, PROFIT_KINDS, SALESMAN_HIDDEN_KINDS, reportsForRole, bnDate, inBranch, validateReportInput, monthRange, reportOptions, reportShareText, reportDefinition, type ReportData, type ReportInput } from "../src/lib/reports/core";
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

const moneyCell = (doc: ReturnType<typeof buildReport>, label: string) => doc.totals?.[doc.columns.findIndex(c => c.label === label)];

test("ক্যাটালগ: ১০টি বিষয়, নিজস্ব ফিল্টার ও রোল অনুমতি", () => {
  assert.equal(REPORT_CATALOG.length, 10);
  assert.equal(new Set(REPORT_CATALOG.map(d => d.kind)).size, 10);
  for (const def of REPORT_CATALOG) assert.ok(def.label && def.desc && Object.keys(def.filters).length);
  assert.deepEqual(reportDefinition("dailyProfit").filters, { singleDate: true });
  assert.deepEqual(reportDefinition("monthlyProfit").filters, { month: true });
  assert.equal(reportDefinition("stock").filters.dateRange, "optional");
  assert.equal(reportDefinition("product").filters.asOfDate, true);
  assert.equal(reportsForRole("owner").length, 10);
  assert.equal(reportsForRole("manager").length, 10);
  assert.equal(reportsForRole("staff").length, 10);
  assert.deepEqual(reportsForRole("customer"), []);
  assert.deepEqual(reportsForRole(undefined), []);
  assert.deepEqual(PROFIT_KINDS, ["dailyProfit", "monthlyProfit"]);
  assert.ok(reportsForRole("salesman").every(d => !SALESMAN_HIDDEN_KINDS.includes(d.kind)));
});

test("তারিখ যাচাই: উল্টো/ফাঁকা/অবৈধ রেঞ্জ সবসময়ের হিসাব হয়ে যায় না", () => {
  const required = reportDefinition("sales").filters;
  assert.equal(validateReportInput(required, input()), null);
  for (const patch of [{ from: '' }, { to: '' }, { from: '2026-02-30' }, { from: '2026-10-01' }])
    assert.ok(validateReportInput(required, input(patch)));
  assert.equal(validateReportInput(reportDefinition('stock').filters, input({ from: '' })), null);
  assert.ok(validateReportInput(reportDefinition('product').filters, input({ to: '' })));
  assert.ok(validateReportInput(reportDefinition('monthlyProfit').filters, input({ month: '2026-13' })));
  assert.throws(() => buildReport('sales', input({ to: '' }), makeData()));
  assert.throws(() => buildReport('dailyProfit', input({ from: '', to: '' }), makeData()));
  assert.deepEqual(monthRange('2024-02'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(monthRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthRange('2026-13'), { from: '', to: '' });
  assert.equal(bnDate('2026-09-15'), '১৫/৯/২০২৬');
});

test("প্রতিটি রিপোর্ট সম্পূর্ণ স্টেটমেন্ট, অপ্রয়োজনীয় সামারি নেই", () => {
  for (const { kind } of REPORT_CATALOG) {
    const doc = buildReport(kind, input(), makeData());
    assert.equal(doc.summary, undefined, kind);
    assert.ok(doc.rows.every(r => r.cells.length === doc.columns.length), kind);
    if (doc.totals) assert.equal(doc.totals.length, doc.columns.length, kind);
  }
});

test("বিক্রি: কালানুক্রমিক বিস্তারিত, নিট মোট এবং প্রাসঙ্গিক ফিল্টার", () => {
  const doc = buildReport('sales', input(), makeData());
  assert.equal(doc.rows.length, 2);
  assert.equal(doc.rows[0].cells[0], '১২/৯/২০২৬');
  assert.equal(moneyCell(doc, 'নিট বিক্রি'), '৳ ১,৮০০');
  assert.equal(moneyCell(doc, 'পরিমাণ'), '১৫ লিটার');
  const due = buildReport('sales', input({ paymentType: 'বাকি' }), makeData());
  assert.equal(due.rows.length, 1);
  assert.equal(moneyCell(due, 'নিট বিক্রি'), '৳ ৬০০');
  assert.ok(due.filterNote?.includes('বাকি'));
  assert.equal(buildReport('sales', input({ productId: 'p2' }), makeData()).rows.length, 0);
});

test("ছাড়: পণ্যের অনুপাত, rounding ও ফিল্টারেও বিলের সাথে মিল", () => {
  const data = makeData();
  data.sales = [sale({ items: [item({ total: 100 }), item({ product_id: 'p2', total: 200 })], total_amount: 270, discount: 30 })];
  const lines = saleStatementLines(data.sales[0]);
  assert.deepEqual(lines.map(i => [i.discount, i.net]), [[10, 90], [20, 180]]);
  assert.equal(moneyCell(buildReport('sales', input(), data), 'নিট বিক্রি'), '৳ ২৭০');
  assert.equal(moneyCell(buildReport('sales', input({ productId: 'p2' }), data), 'নিট বিক্রি'), '৳ ১৮০');
  const tiny = saleStatementLines(sale({ items: [item({ total: 1 }), item({ total: 1 }), item({ total: 1 })], total_amount: 2.99 }));
  assert.equal(Math.round(tiny.reduce((s, i) => s + i.net, 0) * 100), 299);
  assert.equal(saleStatementLines(sale({ items: [], total_amount: 99 }))[0].net, 99);
  assert.equal(buildReport('transaction', input({ txType: 'বিক্রি' }), data).totals?.[5], '৳ ২৭০');
});

test("ক্রয়: নগদ/বাকি, সাপ্লায়ার, একক আলাদা করে পরিমাণ", () => {
  const data = makeData();
  data.purchases.push(purchase({ id: 'p2', product_id: 'p2', quantity: 5, unit: 'কেজি', total: 300, payment_type: 'বাকি' }));
  const doc = buildReport('purchase', input(), data);
  assert.equal(moneyCell(doc, 'ক্রয় মূল্য'), '৳ ৫,৩০০');
  assert.equal(moneyCell(doc, 'পরিমাণ'), '৫ কেজি • ৫০ লিটার');
  assert.ok(doc.rows.some(r => r.cells[3] === 'বাকি'));
  assert.equal(buildReport('purchase', input({ supplier: 'অন্য' }), data).rows.length, 0);
});

test("স্টক: ওপেনিং + ক্রয় − বিক্রয় + দৃশ্যমান সমন্বয় = সমাপনী", () => {
  const doc = buildReport('stock', input(), makeData());
  const soybean = doc.rows.find(r => r.cells[0] === 'সয়াবিন তেল')!;
  assert.deepEqual(soybean.cells.slice(1, 6), ['১০ লিটার', '৫০ লিটার', '১৫ লিটার', '-২ লিটার', '৪৩ লিটার']);
  assert.equal(moneyCell(doc, 'ক্রয় মূল্য'), '৳ ৫,৫০০');
  const past = buildReport('stock', input({ from: '', to: '2026-09-09' }), makeData());
  assert.equal(past.rows.find(r => r.cells[0] === 'সয়াবিন তেল')?.cells[5], '৬০ লিটার');
  assert.ok(past.period.includes('৯/৯/২০২৬'));
  assert.ok(!past.period.includes('আজ'));
  const later = buildReport('stock', input({ from: '2026-09-11' }), makeData());
  assert.equal(later.rows.find(r => r.cells[0] === 'সয়াবিন তেল')?.cells[1], '৫৮ লিটার');
});

test("ক্রেতার বাকি: ওপেনিং, চলতি পুরোনো বাকি, বিক্রি, আদায়, সমাপনী", () => {
  const data = makeData();
  data.entries.push(entry({ id: 'opening-new', kind: 'opening', amount: 100 }));
  const doc = buildReport('customerDue', input(), data);
  assert.deepEqual(doc.rows[0].cells.slice(2), ['৳ ২,০০০', '৳ ১০০', '৳ ৬০০', '৳ ৪০০', '৳ ২,৩০০']);
  assert.equal(moneyCell(doc, 'সমাপনী বাকি'), '৳ ২,৩০০');
});

test("ক্রেতার হিসাবে সাপ্লায়ার, বাতিল ও ভবিষ্যৎ এন্ট্রি বাদ", () => {
  const data = makeData();
  data.entries.push(entry({ id: 'supplier', party_type: 'supplier', party_id: 'c1', kind: 'opening', amount: 9999 }),
    entry({ id: 'cancel', cancelled: true, amount: 9999 }), entry({ id: 'future', date: '2026-10-01', amount: 9999 }));
  const accounts = dueAccounts(data, { branchId: 'a' }, '2026-09-01', '2026-09-30');
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].balance, 2200);
  data.entries.push(entry({ id: 'advance', party_id: 'c2', date: '2026-08-01', amount: 500 }));
  assert.ok(buildReport('customerDue', input(), data).rows.some(r => r.cells[6] === '৳ -৫০০'));
});

test("একজন ক্রেতা নির্বাচন করলে তারিখক্রমে চলতি ব্যালেন্সসহ খাতা", () => {
  const doc = buildReport('customerDue', input({ customerId: 'c1' }), makeData());
  assert.equal(doc.title, 'ক্রেতার হিসাব বিবরণী');
  assert.equal(doc.rows[0].cells[4], '৳ ২,০০০');
  assert.deepEqual(doc.rows.slice(1).map(r => r.cells[4]), ['৳ ২,৬০০', '৳ ২,২০০']);
  assert.equal(doc.totals?.[4], '৳ ২,২০০');
  assert.equal(doc.rows.length, 3);
});

test("আদায়: পদ্ধতি, ক্রেতা ও legacy collection-সহ সম্পূর্ণ মোট", () => {
  const data = makeData();
  data.collections.push({ id: 'legacy', date: '2026-09-16', customer_id: 'c1', customer_name: 'ক্রেতা করিম', amount: 200, branch_id: 'a', created_at: '' });
  assert.equal(moneyCell(buildReport('collection', input(), data), 'টাকা'), '৳ ৬০০');
  assert.equal(moneyCell(buildReport('collection', input({ method: 'বিকাশ' }), data), 'টাকা'), '৳ ৪০০');
  assert.equal(buildReport('collection', input({ method: 'রকেট' }), data).rows.length, 0);
});

test("খরচ: মালিকের টাকা তোলা আর দোকানের খরচ আলাদা পরিচয়", () => {
  const doc = buildReport('expense', input(), makeData());
  assert.equal(moneyCell(doc, 'টাকা'), '৳ ৩,৫০০');
  assert.deepEqual(doc.rows.map(r => r.cells[1]), ['দোকানের খরচ', 'মালিকের টাকা তোলা']);
  assert.equal(moneyCell(buildReport('expense', input({ expenseKind: 'shop' }), makeData()), 'টাকা'), '৳ ৫০০');
  assert.equal(moneyCell(buildReport('expense', input({ category: 'সংসার খরচ' }), makeData()), 'টাকা'), '৳ ৩,০০০');
});

test("দৈনিক/মাসিক লাভে অপ্রাসঙ্গিক ক্রয়/স্টক/আদায়ের সামারি নেই", () => {
  const daily = buildReport('dailyProfit', input({ from: '2026-09-18', to: '2026-09-18' }), makeData());
  assert.deepEqual(daily.rows.map(r => r.cells[1]), ['৳ ১,২০০', '৳ ১,০০০', '৳ ২০০', '৳ ৫০০', '৳ -৩০০']);
  const monthly = buildReport('monthlyProfit', input(), makeData());
  assert.deepEqual(monthly.rows.map(r => r.cells[1]), ['৳ ১,৮০০', '৳ ১,৫০০', '৳ ৩০০', '৳ ৫০০', '৳ -২০০']);
  assert.equal(monthly.rows.length, 5);
  assert.equal(monthly.rows[4].emphasis, true);
});

test("পণ্য: নির্দিষ্ট তারিখের স্টক, ভবিষ্যতের বিক্রি বাদ, সার্চ", () => {
  const doc = buildReport('product', input({ to: '2026-09-09' }), makeData());
  assert.equal(doc.rows.find(r => r.cells[0] === 'সয়াবিন তেল')?.cells[5], '৬০ লিটার');
  assert.equal(buildReport('product', input({ search: 'চাল' }), makeData()).rows.length, 1);
});

test("লেনদেন: মিশ্র প্রকৃতির টাকার ভুল যোগফল নয়; ফিল্টার মেনে মোট", () => {
  const data = makeData();
  data.entries.push(entry({ id: 'supplier-opening', party_type: 'supplier', kind: 'opening', amount: 1000 }));
  const doc = buildReport('transaction', input(), data);
  assert.equal(doc.totals, undefined);
  assert.ok(doc.rows.some(r => r.cells[1] === 'পুরোনো দেনা'));
  const one = buildReport('transaction', input({ txType: 'পুরোনো দেনা' }), data);
  assert.equal(one.rows.length, 1);
  assert.equal(one.totals?.[5], '৳ ১,০০০');
  const search = buildReport('transaction', input({ search: 'রহিম ট্রেডার্স' }), data);
  assert.equal(search.rows.length, 1);
  assert.equal(search.totals?.[5], '৳ ৫,০০০');
});

test("সব রিপোর্টে শাখা ফিল্টার, খালি অনুমোদিত শাখা মানে কোনো ডেটা নয়", () => {
  assert.equal(inBranch('a', { branchIds: [] }), false);
  for (const { kind } of REPORT_CATALOG) {
    const scoped = buildReport(kind, input({ scope: { branchId: 'b' } }), makeData());
    assert.ok(!JSON.stringify(scoped.rows).includes('ক্রেতা করিম'), kind);
    if (kind === 'sales') assert.equal(moneyCell(scoped, 'নিট বিক্রি'), '৳ ৯০০');
    const empty = buildReport(kind, input({ scope: { branchIds: [] } }), makeData());
    if (!PROFIT_KINDS.includes(kind)) assert.equal(empty.rows.length, 0, kind);
  }
});

test("অপশনে অন্য শাখার category/method নেই; ledger-only ক্রেতা আছে", () => {
  const data = makeData();
  data.products.push(product({ id: 'other', branch_id: 'b', category: 'গোপন' }));
  data.entries.push(entry({ id: 'c-new', party_id: 'c-new', party_name: 'পুরোনো ক্রেতা' }), entry({ id: 'supplier', party_type: 'supplier', method: 'supplier-only' }));
  data.collections.push({ id: 'l-b', date: '2026-09-01', customer_id: 'b', customer_name: 'ব', branch_id: 'b', amount: 1, payment_method: 'গোপন-মাধ্যম', created_at: '' });
  const options = reportOptions(data, { branchId: 'a' });
  assert.ok(!options.categories.includes('গোপন'));
  assert.ok(!options.methods.includes('গোপন-মাধ্যম'));
  assert.ok(!options.methods.includes('supplier-only'));
  assert.ok(options.customers.some(c => c.id === 'c-new'));
});

test("৫০০-এর বেশি সারি বাদ পড়ে না, মোট দৃশ্যমান সব সারির সাথে মেলে", () => {
  const data = makeData();
  data.sales = Array.from({ length: 601 }, (_, i) => sale({ id: `s${i}`, items: [item({ total: 1 })], total_amount: 1 }));
  const doc = buildReport('sales', input(), data);
  assert.equal(doc.rows.length, 601);
  assert.equal(moneyCell(doc, 'নিট বিক্রি'), '৳ ৬০১');
  assert.equal(buildReport('transaction', input(), data).rows.filter(r => r.cells[1] === 'বিক্রি').length, 601);
});

test("শেয়ারে নির্বাচিত বিষয়/ফিল্টার/মোট; অপ্রয়োজনীয় summary নেই", () => {
  const doc = buildReport('sales', input({ paymentType: 'বাকি' }), makeData());
  const text = reportShareText(doc, 'আমার দোকান', 'শাখা ক');
  assert.ok(text.includes('আমার দোকান') && text.includes('বাকি') && text.includes('নিট বিক্রি: ৳ ৬০০'));
  assert.ok(!text.includes('গড়') && !text.includes('সর্বোচ্চ'));
  assert.equal(sheetFileName('sales-report', '2026-09-01_2026-09-30'), 'sales-report-2026-09-01_2026-09-30.pdf');
  assert.equal(sheetImageName('report.pdf', 1, 1), 'report.jpg');
  assert.equal(sheetImageName('report.pdf', 2, 3), 'report-2.jpg');
});

import "fake-indexeddb/auto";
import { test, beforeEach } from "node:test";

// Node-এ localStorage নেই — authStore সেশন সেভ করতে ব্যবহার করে
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
    configurable: true,
  });
}
import assert from "node:assert/strict";
import { db, type DbCollection, type DbCustomer, type DbUser, type LedgerEntry } from "../src/lib/db";
import {
  buildCustomerStatement,
  customerMessageText,
  dueReminderText,
  normName,
  pendingCustomerUsers,
  reminderWhatsAppLink,
} from "../src/lib/customerAccount";
import { buildCustomerPurchaseStatement } from "../src/lib/customerStatement";
import { normalizePhone, useAuthStore } from "../src/stores/authStore";
import type { Sale } from "../src/types";

const customer = (o: Partial<DbCustomer> = {}): DbCustomer => ({
  id: "c1", name: "ক্রেতা করিম", phone: "01911111111", address: "চট্টগ্রাম", branch_id: "branch-1", created_at: "", ...o,
});

const sale = (o: Partial<Sale> = {}): Sale => ({
  id: "s1", date: "2026-09-10", items: [], total_amount: 2000, total_profit: 300,
  payment_type: "বাকি", customer_id: "c1", customer_name: "ক্রেতা করিম", branch_id: "branch-1",
  created_by: "staff-1", created_at: "", ...o,
});

const entry = (o: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: "e1", party_id: "c1", party_name: "ক্রেতা করিম", party_type: "customer", kind: "payment",
  amount: 500, date: "2026-09-15", branch_id: "branch-1", method: "বিকাশ", reference: "", note: "",
  cancelled: false, created_at: "", created_by: "staff-1", ...o,
});

const legacy = (o: Partial<DbCollection> = {}): DbCollection => ({
  id: "l1", date: "2026-09-05", customer_id: "c1", customer_name: "ক্রেতা করিম", amount: 300, branch_id: "branch-1", created_at: "", ...o,
});

/* ── স্টেটমেন্ট ── */

test("ক্রেতার হিসাব বিবরণী: লেজার সারি, মোট ও সারসংক্ষেপ", () => {
  const doc = buildCustomerStatement(
    customer(),
    [sale({ id: "s1", total_amount: 2000 }), sale({ id: "s2", date: "2026-09-01", payment_type: "নগদ", total_amount: 700 })],
    [entry({ kind: "opening", amount: 1000, date: "2026-09-02" }), entry({ id: "e2", amount: 500, date: "2026-09-15" })],
    [legacy()],
  );

  assert.equal(doc.title, "ক্রেতার হিসাব বিবরণী — ক্রেতা করিম");
  assert.deepEqual(doc.columns.map((c) => c.label), ["তারিখ", "বিবরণ", "বাকি (+)", "জমা (−)", "ব্যালেন্স"]);
  // পুরোনো বাকি ১০০০ + বাকিতে বিক্রি ২০০০ = ৩০০০ বাকি; জমা ৫০০ + ৩০০ = ৮০০
  const value = (label: string) => doc.summary.find((s) => s.label === label)?.value;
  assert.equal(value("বর্তমান বাকি"), "৳ ২,২০০");
  assert.equal(value("মোট কেনাকাটা"), "৳ ২,৭০০"); // নগদ বিক্রিসহ (৭০০ + ২০০০)
  assert.equal(value("বিল সংখ্যা"), "২টি");
  assert.equal(value("মোট জমা"), "৳ ৮০০");
  assert.ok(value("শেষ জমা")?.includes("১৫/৯/২০২৬"));
  assert.equal(doc.totals?.[2], "৳ ৩,০০০");
  assert.equal(doc.totals?.[3], "৳ ৮০০");
  assert.equal(doc.totals?.[4], "৳ ২,২০০");
  assert.ok(doc.filterNote?.includes("01911111111"));
  assert.ok(doc.notes?.length);
  // নগদ বিক্রি লেজারে বাকি বাড়ায় না
  assert.equal(doc.rows.filter((r) => normName(r.cells[1]) === normName("বিক্রয় বিল")).length, 1);
});

test("স্টেটমেন্ট শাখা-স্কোপ মানে", () => {
  const doc = buildCustomerStatement(
    customer(),
    [sale({ branch_id: "branch-2", total_amount: 9999 })],
    [],
    [],
    { branchId: "branch-1" },
  );
  assert.equal(doc.rows.length, 0);
  assert.equal(doc.summary.find((s) => s.label === "বর্তমান বাকি")?.value, "৳ ০");
});

test("customer purchase statement: নিজের cash/due purchase, payments ও selected date range মেলে", () => {
  const sales = [
    sale({ id: "credit-sale", date: "2026-09-10", total_amount: 2000, payment_type: "বাকি", items: [{ product_id: "p", product_name: "চাল", quantity: 2, unit: "কেজি", sale_price: 1000, purchase_price: 800, total: 2000, profit: 400 }] }),
    sale({ id: "cash-sale", date: "2026-09-12", total_amount: 700, payment_type: "নগদ" }),
    sale({ id: "another-customer", date: "2026-09-12", customer_id: "c2", customer_name: "অন্য ক্রেতা", total_amount: 9999, payment_type: "নগদ" }),
  ];
  const entries = [entry({ id: "customer-payment", date: "2026-09-15", amount: 500 }), entry({ id: "supplier-payment", party_type: "supplier", kind: "payment", date: "2026-09-15", amount: 999 })];
  const collections = [legacy({ id: "legacy-payment", date: "2026-09-14", amount: 300 })];
  const before = JSON.stringify({ sales, entries, collections });
  const result = buildCustomerPurchaseStatement(
    customer(), sales, entries, collections,
    { from: "2026-09-10", to: "2026-09-15" },
  );

  assert.deepEqual(result.rows.map((row) => row.receiptNo), ["credit-sale", "cash-sale", "legacy-payment", "customer-payment"]);
  assert.equal(result.totalPurchase, 2700);
  // Cash receipt + legacy collection + current ledger payment.
  assert.equal(result.totalPaid, 1500);
  assert.equal(result.totalDue, 1200);
  assert.equal(result.rows.find((row) => row.receiptNo === "cash-sale")?.due, 2000);
  assert.equal(result.document.columns.map((column) => column.label).join("|"), "তারিখ|Receipt No.|পণ্যের বিবরণ|মোট ক্রয়|পরিশোধ|বাকি");
  assert.ok(result.document.filterNote?.includes("Customer ID: c1"));
  assert.equal(result.document.summary?.find((item) => item.label === "মোট বাকি")?.value, "৳ ১,২০০");
  // Filtering is presentation-only: history inputs stay byte-for-byte intact.
  assert.equal(JSON.stringify({ sales, entries, collections }), before);
});

/* ── তাগাদা ও বার্তা ── */

test("বাকি তাগাদার টেক্সটে দোকান, ক্রেতা ও টাকা থাকে", () => {
  const text = dueReminderText(customer(), { id: "b", name: "প্রধান শাখা", organization: "রহিম ফিড স্টোর", is_active: true, created_at: "" }, 2200, "2026-09-15");
  assert.ok(text.includes("ক্রেতা করিম"));
  assert.ok(text.includes("রহিম ফিড স্টোর"));
  assert.ok(text.includes("২,২০০"));
  assert.ok(text.includes("১৫/৯/২০২৬"));
});

test("WhatsApp লিংক: ৮৮ প্রিফিক্স, টেক্সট এনকোড; নম্বর না থাকলে সাধারণ wa.me", () => {
  const link = reminderWhatsAppLink("বাকি আছে", "01911111111");
  assert.ok(link.startsWith("https://wa.me/8801911111111?text="));
  assert.ok(link.includes(encodeURIComponent("বাকি আছে")));
  const noPhone = reminderWhatsAppLink("হ্যালো");
  assert.equal(noPhone.startsWith("https://wa.me/?text="), true);
  const withCountry = reminderWhatsAppLink("হ্যালো", "8801911111111");
  assert.equal(withCountry.startsWith("https://wa.me/8801911111111?text="), true);
});

test("ক্রেতার বার্তার টেক্সট: ধরন, টাকা, মাধ্যম, মন্তব্য ও বাকি", () => {
  const text = customerMessageText({
    customerName: "ক্রেতা করিম", shopName: "রহিম ফিড স্টোর", kind: "payment",
    amount: 500, method: "বিকাশ", note: "আজকে দিলাম", due: 1700,
  });
  assert.ok(text.includes("রহিম ফিড স্টোর"));
  assert.ok(text.includes("টাকা দিয়েছি"));
  assert.ok(text.includes("৫০০"));
  assert.ok(text.includes("বিকাশ"));
  assert.ok(text.includes("আজকে দিলাম"));
  assert.ok(text.includes("১,৭০০"));

  const other = customerMessageText({ customerName: "করিম", shopName: "দোকান", kind: "other", note: "", due: 0 });
  assert.ok(other.includes("অন্য বিষয়"));
  assert.ok(!other.includes("মাধ্যম"));
});

test("normName: 'য়'-এর দুই রূপ একই নাম ধরে", () => {
  const a = "ক্রেতা করিম" + "\u09df" + "া";      // য় (precomposed)
  const b = "ক্রেতা করিম" + "\u09af\u09bc" + "া"; // য + ়
  assert.equal(normName(a), normName(b));
  assert.equal(normName("  আব্দুল   করিম "), "আব্দুল করিম");
});

/* ── অনুমোদনের অপেক্ষায় ── */

test("pendingCustomerUsers: শুধু অনুমোদন-অপেক্ষমাণ ক্রেতা, নতুন আগে", () => {
  const users: DbUser[] = [
    { id: "u1", name: "ক", phone: "017", password_hash: "", role: "customer", is_active: false, approval: "pending", created_at: "2026-09-10", updated_at: "" },
    { id: "u2", name: "খ", phone: "018", password_hash: "", role: "customer", is_active: false, approval: "pending", created_at: "2026-09-12", updated_at: "" },
    { id: "u3", name: "গ", phone: "019", password_hash: "", role: "customer", is_active: true, approval: "approved", created_at: "2026-09-01", updated_at: "" },
    { id: "u4", name: "ঘ", phone: "016", password_hash: "", role: "staff", is_active: false, approval: "pending", created_at: "2026-09-13", updated_at: "" },
  ];
  assert.deepEqual(pendingCustomerUsers(users).map((u) => u.id), ["u2", "u1"]);
});

/* ── authStore: সাইন-আপ, প্রোফাইল, পাসওয়ার্ড ── */

beforeEach(async () => {
  await db.delete();
  await db.open(); // delete() কানেকশন বন্ধ করে — পরের কাজের জন্য আবার খুলে নিই
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, error: null });
});

test("normalizePhone: ৮৮ প্রিফিক্স ও অবৈধ অক্ষর বাদ", () => {
  assert.equal(normalizePhone("8801911111111"), "01911111111");
  assert.equal(normalizePhone("019-1111 1111"), "01911111111");
  assert.equal(normalizePhone("+8801911111111"), "01911111111");
});

test("register: যাচাই, ডুপ্লিকেট ফোন আটকানো ও অনুমোদন-অপেক্ষমাণ ইউজার তৈরি", async () => {
  const store = useAuthStore.getState();

  assert.equal((await store.register({ name: "", phone: "01911111111", password: "secret123" })).ok, false);
  assert.equal((await store.register({ name: "করিম", phone: "01911", password: "secret123" })).ok, false);
  assert.equal((await store.register({ name: "করিম", phone: "01911111111", password: "123" })).ok, false);

  const first = await store.register({ name: "ক্রেতা করিম", phone: "01911111111", password: "secret123", address: "চট্টগ্রাম" });
  assert.equal(first.ok, true);

  const saved = await db.users.where("phone").equals("01911111111").first();
  assert.ok(saved);
  assert.equal(saved!.role, "customer");
  assert.equal(saved!.is_active, false);
  assert.equal(saved!.approval, "pending");
  assert.notEqual(saved!.password_hash, "secret123"); // পাসওয়ার্ড হ্যাশ করা

  const duplicate = await store.register({ name: "অন্য কেউ", phone: "8801911111111", password: "secret123" });
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.error?.includes("আগেই"));
});

test("login: অনুমোদনের অপেক্ষায় থাকলে ঢুকতে দেয় না, অনুমোদনের পর ঢোকে", async () => {
  const store = useAuthStore.getState();
  await store.register({ name: "ক্রেতা করিম", phone: "01911111111", password: "secret123" });

  assert.equal(await useAuthStore.getState().login("01911111111", "secret123"), false);
  assert.ok(useAuthStore.getState().error?.includes("অনুমোদনের অপেক্ষায়"));

  const user = await db.users.where("phone").equals("01911111111").first();
  await db.users.update(user!.id, { is_active: true, approval: "approved" });

  assert.equal(await useAuthStore.getState().login("01911111111", "secret123"), true);
  assert.equal(useAuthStore.getState().user?.role, "customer");

  // ভুল পাসওয়ার্ড
  useAuthStore.setState({ user: null, isAuthenticated: false });
  assert.equal(await useAuthStore.getState().login("01911111111", "ভুলপাস"), false);
  assert.ok(useAuthStore.getState().error?.includes("পাসওয়ার্ড ভুল"));
});

test("changePassword: বর্তমান পাসওয়ার্ড মিলিয়ে নতুন হ্যাশ সেভ হয়", async () => {
  const store = useAuthStore.getState();
  await store.register({ name: "ক্রেতা করিম", phone: "01911111111", password: "secret123" });
  const saved = await db.users.where("phone").equals("01911111111").first();
  await db.users.update(saved!.id, { is_active: true, approval: "approved" });

  useAuthStore.setState({
    user: { id: saved!.id, name: saved!.name, phone: saved!.phone, role: "customer", branch_id: "branch-1" },
    isAuthenticated: true,
  })

  const wrong = await useAuthStore.getState().changePassword("ভুল", "newpass1");
  assert.equal(wrong.ok, false);
  assert.ok(wrong.error?.includes("বর্তমান পাসওয়ার্ড"));

  const short = await useAuthStore.getState().changePassword("secret123", "123");
  assert.equal(short.ok, false);

  const same = await useAuthStore.getState().changePassword("secret123", "secret123");
  assert.equal(same.ok, false);

  const ok = await useAuthStore.getState().changePassword("secret123", "newpass1");
  assert.equal(ok.ok, true);

  useAuthStore.setState({ user: null, isAuthenticated: false });
  assert.equal(await useAuthStore.getState().login("01911111111", "secret123"), false);
  assert.equal(await useAuthStore.getState().login("01911111111", "newpass1"), true);
});

test("updateProfile: নাম/ফোন/ঠিকানা বদলায়, ব্যবহৃত ফোন আটকায়", async () => {
  const store = useAuthStore.getState();
  await store.register({ name: "ক্রেতা করিম", phone: "01911111111", password: "secret123" });
  await store.register({ name: "ক্রেতা রহিম", phone: "01822222222", password: "secret123" });

  const karim = await db.users.where("phone").equals("01911111111").first();
  await db.users.update(karim!.id, { is_active: true, approval: "approved" });
  useAuthStore.setState({
    user: { id: karim!.id, name: karim!.name, phone: karim!.phone, role: "customer" },
    isAuthenticated: true,
  });

  const taken = await useAuthStore.getState().updateProfile({ phone: "01822222222" });
  assert.equal(taken.ok, false);
  assert.ok(taken.error?.includes("অন্য অ্যাকাউন্ট"));

  const ok = await useAuthStore.getState().updateProfile({ name: "করিম উদ্দিন", address: "পটিয়া" });
  assert.equal(ok.ok, true);
  assert.equal(useAuthStore.getState().user?.name, "করিম উদ্দিন");
  const updated = await db.users.get(karim!.id);
  assert.equal(updated?.name, "করিম উদ্দিন");
  assert.equal(updated?.address, "পটিয়া");
});

/* ── বার্তা টেবিল ── */

test("customerMessages টেবিলে বার্তা সেভ ও দোকান 'দেখেছে' মার্ক করতে পারে", async () => {
  await db.customerMessages.add({
    id: "msg-1", customer_id: "c1", customer_name: "ক্রেতা করিম", phone: "01911111111",
    branch_id: "branch-1", kind: "payment", amount: 500, method: "বিকাশ", note: "",
    created_at: new Date().toISOString(), seen: false,
  });
  const saved = await db.customerMessages.get("msg-1");
  assert.equal(saved?.seen, false);

  await db.customerMessages.update("msg-1", { seen: true, seen_at: new Date().toISOString() });
  const seen = await db.customerMessages.get("msg-1");
  assert.equal(seen?.seen, true);
  assert.ok(seen?.seen_at);
});

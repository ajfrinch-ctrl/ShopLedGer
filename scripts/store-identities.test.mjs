import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";

// Exercise the real Zustand actions/persistence in Node. Only server auth and
// Vite's asset base are stubbed; identity/numbering code is not mocked.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes("/src/lib/") && specifier.startsWith(".")) {
      const url = new URL(specifier, context.parentURL);
      if (!url.pathname.endsWith(".ts") && existsSync(fileURLToPath(url) + ".ts")) {
        return nextResolve(url.href + ".ts", context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith("/src/lib/master-admin.ts")) {
      return {
        format: "module",
        shortCircuit: true,
        source: `
        export const getMasterSystemAdminSession = async () => ({ authenticated: false });
        export const loginMasterSystemAdmin = async () => ({ authenticated: false });
        export const logoutMasterSystemAdmin = async () => {};
      `,
      };
    }
    if (url.endsWith("/src/lib/shop.ts")) {
      return {
        format: "module-typescript",
        shortCircuit: true,
        source: readFileSync(new URL(url), "utf8").replaceAll("import.meta.env.BASE_URL", '"/"'),
      };
    }
    return nextLoad(url, context);
  },
});
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = { localStorage: globalThis.localStorage, setTimeout };
const { useShop } = await import("../src/lib/store.ts");
const { todayKey } = await import("../src/lib/format.ts");
const day = todayKey().slice(2).replaceAll("-", "");
const key = "karnaphuli-shopledger-v1";
const admin = { id: "admin", role: "systemAdmin", name: "Admin", phone: "01700000000" };
const input = { name: "নতুন ক্রেতা", phone: "01712345678", address: "ঢাকা" };
const saleInput = { date: todayKey(), items: [], discount: 0, paid: 0, customerName: "নগদ" };

// অ্যাপ খালি খাতা দিয়ে শুরু হয় — প্রতিটা test-এও সেই অবস্থা থেকে শুরু।
const freshState = () => ({
  products: [],
  customers: [],
  customerRequests: [],
  sales: [],
  purchases: [],
  expenses: [],
  collections: [],
  orders: [],
  adjustments: [],
  numberSequences: {},
});

beforeEach(() => {
  useShop.setState(freshState());
  useShop.setState({ user: admin });
  // পাসওয়ার্ড override আলাদা কীতে থাকে — test-এর মাঝে leak-এর সুযোগ দিই না
  storage.delete("karnaphuli-shopledger-v1-password-overrides");
});

test("every creation path uses a separate dated reference, including order fulfillment", () => {
  const customer = useShop.getState().addCustomer(input);
  assert.equal(customer.id, `C-${day}001`);
  const product = useShop
    .getState()
    .addProduct({
      name: "Feed",
      company: "Shop",
      unit: "bag",
      purchasePrice: 20,
      salePrice: 30,
      openingStock: 10,
      minStock: 1,
    });
  assert.equal(product.id, `P-${day}001`);
  assert.equal(product.code, product.id);
  const purchase = useShop
    .getState()
    .addPurchase({
      date: todayKey(),
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unit: "bag",
      purchasePrice: 20,
      total: 20,
      supplier: "Supplier",
      paid: 20,
    });
  assert.equal(purchase.id, `PU-${day}001`);
  assert.equal(
    useShop.getState().addExpense({ date: todayKey(), category: "Test", amount: 1, kind: "shop" })
      .id,
    `E-${day}001`,
  );
  assert.equal(
    useShop
      .getState()
      .addCollection({
        date: todayKey(),
        partyId: customer.id,
        partyName: customer.name,
        kind: "customer",
        amount: 1,
        method: "নগদ",
      }).id,
    `CL-${day}001`,
  );
  useShop
    .getState()
    .addAdjustment({
      date: todayKey(),
      productId: product.id,
      productName: product.name,
      quantity: 1,
      reason: "Test",
    });
  assert.equal(useShop.getState().adjustments[0].id, `SA-${day}001`);
  const order = useShop
    .getState()
    .addOrder({ customerId: customer.id, customerName: customer.name, items: [], total: 0 });
  assert.equal(order.id, `O-${day}001`);
  const sale = useShop.getState().fulfillOrder(order.id);
  assert.equal(sale.billNo, `B-${day}001`);
  assert.equal(sale.id, sale.billNo);
  assert.equal(sale.note, `অর্ডার ${order.id}`);
  assert.equal(useShop.getState().fulfillOrder(order.id), null);
  assert.equal(useShop.getState().addSale(saleInput).billNo, `B-${day}002`);
});

test("persisted reservations survive deletion, rehydration and data wipe", async () => {
  const first = useShop.getState().addSale(saleInput);
  assert.equal(useShop.getState().deleteSale(first.id), true);
  const saved = storage.get(key);
  useShop.setState({ numberSequences: {} });
  storage.set(key, saved);
  await useShop.persist.rehydrate();
  assert.equal(useShop.getState().addSale(saleInput).billNo, `B-${day}002`);
  // হিসাব মুছে ফেলা গেট নম্বর রিজার্ভেশন ফেরত আনে না
  useShop.setState({ products: [], customers: [], sales: [] });
  assert.equal(useShop.getState().addSale(saleInput).billNo, `B-${day}003`);
});

test("legacy persisted data keeps old IDs and recovers counters from references", async () => {
  const customer = useShop.getState().addCustomer(input);
  useShop.getState().addSale(saleInput);
  const persisted = JSON.parse(storage.get(key));
  delete persisted.state.numberSequences;
  persisted.state.billSeq = 99999;
  storage.set(key, JSON.stringify(persisted));
  await useShop.persist.rehydrate();
  assert.equal(useShop.getState().customers[0].id, customer.id);
  assert.equal(useShop.getState().addSale(saleInput).billNo, `B-${day}002`);
});

test("duplicate customer creation fails in the store, without consuming an ID", () => {
  const first = useShop.getState().addCustomer(input);
  assert.throws(() => useShop.getState().addCustomer({ ...input, phone: "+8801712345678" }));
  assert.throws(() => useShop.getState().addCustomer({ ...input, phone: "" }));
  const next = useShop.getState().addCustomer({ ...input, phone: "01812345678" });
  assert.equal(first.id, `C-${day}001`);
  assert.equal(next.id, `C-${day}002`);
});

test("approved registration, login and transactions retain the original mobile", async () => {
  const shop = () => useShop.getState();
  assert.equal(shop().submitCustomerRegistration(input).ok, true);
  const request = shop().customerRequests[0];
  assert.equal(request.id, `R-${day}001`);
  assert.equal(shop().updateCustomerRegistration(request.id, { phone: "01812345678" }), false);
  assert.equal(shop().approveCustomerRegistration(request.id), true);
  const customer = shop().customers[0];
  const sale = shop().addSale({
    ...saleInput,
    customerId: customer.id,
    customerName: customer.name,
  });
  assert.equal(shop().updateCustomer(customer.id, { phone: "01812345678" }), false);
  assert.equal(
    shop().updateCustomer(customer.id, { whatsappPhone: "01812345678", name: "New name" }),
    true,
  );
  assert.equal(shop().customers[0].phone, input.phone);
  assert.equal(shop().sales.find((row) => row.id === sale.id).customerId, customer.id);
  assert.equal(shop().customerRequests[0].phone, input.phone);
  assert.equal(shop().updateCustomerRegistration(request.id, { phone: "01812345678" }), false);

  // লগইন পেজে ক্রেতা logged-out অবস্থায় থাকে
  shop().logout();
  // ক্রেতা এখন ফোন + পাসওয়ার্ডে লগইন; অন্য নম্বর বা ভুল পাসে যায় না
  assert.equal((await shop().login("01812345678", "123456")).ok, false);
  assert.equal((await shop().login(input.phone, "wrong-pass")).ok, false);
  // ডিফল্ট ১২৩৪৫৬ — প্রথম লগইনে পরিবর্তন বাধ্যতামূলক, session ছাড়াই
  const first = await shop().login(input.phone, "123456");
  assert.equal(first.ok, true);
  assert.equal(first.mustChangePassword, true);
  assert.equal(shop().user, null, "default-password login must not open the app");
  assert.equal(shop().resetPassword(input.phone, "naya-pass-1", "naya-pass-1").ok, true);
  const second = await shop().login(input.phone, "naya-pass-1");
  assert.equal(second.ok, true);
  assert.equal(second.mustChangePassword, false);
  assert.equal(shop().user.customerId, customer.id);
  assert.equal(shop().user.phone, input.phone);
});

test("owner can deactivate a customer; login and live session are blocked", async () => {
  const shop = () => useShop.getState();
  assert.equal(shop().submitCustomerRegistration(input).ok, true);
  const request = shop().customerRequests[0];
  assert.equal(shop().approveCustomerRegistration(request.id), true);
  const customer = shop().customers[0];

  // নতুন ক্রেতা default-এ চালু — ডিফল্ট পাসে লগইনে পরিবর্তন বাধ্যতামূলক
  assert.equal(customer.active, undefined);
  shop().logout();
  const first = await shop().login(input.phone, "123456");
  assert.equal(first.ok, true);
  assert.equal(first.mustChangePassword, true);
  assert.equal(shop().resetPassword(input.phone, "active-pass-1", "active-pass-1").ok, true);
  assert.equal((await shop().login(input.phone, "active-pass-1")).ok, true);
  assert.equal(shop().user.customerId, customer.id);
  const count = shop().customers.length;

  // অচালু করলে চলমান session rehydrate-তে বাদ পড়ে
  assert.equal(shop().updateCustomer(customer.id, { active: false }), true);
  assert.equal(shop().customers[0].active, false);
  await useShop.persist.rehydrate();
  assert.equal(shop().user, null, "deactivated customer session must be cleared");

  // নতুন লগইন ব্লকড, স্পষ্ট বার্তাসহ
  assert.equal((await shop().login(input.phone, "active-pass-1")).ok, false);
  assert.match(shop().loginError, /অচালু/);

  // হিসাব/রেকর্ড অক্ষত
  assert.equal(shop().customers.length, count);
  assert.equal(shop().customerRequests.length, 1);

  // আবার চালু করলে লগইন ফেরে
  assert.equal(shop().updateCustomer(customer.id, { active: true }), true);
  assert.equal((await shop().login(input.phone, "active-pass-1")).ok, true);
  assert.equal(shop().user.customerId, customer.id);

  // ডিফল্ট পাসওয়ার্ডে (override ছাড়া) পুরনো session rehydrate-তে বাদ পড়ে
  storage.delete("karnaphuli-shopledger-v1-password-overrides");
  shop().logout();
  useShop.setState({
    user: {
      id: `customer-user-${customer.id}`,
      name: customer.name,
      phone: customer.phone,
      role: "customer",
      customerId: customer.id,
    },
  });
  await useShop.persist.rehydrate();
  assert.equal(shop().user, null, "default-password customer session must be cleared");
});

test("admin edits cannot rewrite issued references", () => {
  const shop = () => useShop.getState();
  const sale = shop().addSale(saleInput);
  assert.equal(
    shop().updateSale(sale.id, {
      id: "changed",
      billNo: "changed",
      createdAt: "changed",
      note: "Edited",
    }),
    true,
  );
  const updated = shop().sales.find((row) => row.id === sale.id);
  assert.equal(updated.billNo, sale.billNo);
  assert.equal(updated.createdAt, sale.createdAt);
  const product = shop().addProduct({
    name: "Feed",
    company: "Shop",
    unit: "bag",
    purchasePrice: 20,
    salePrice: 30,
    openingStock: 10,
    minStock: 1,
  });
  assert.equal(
    shop().updateProduct(product.id, { id: "changed", code: "changed", name: "Updated" }),
    true,
  );
  assert.equal(shop().products[0].code, product.code);
  assert.equal(shop().products[0].id, product.id);
});

test("backdated documents have their own daily series; editing dates does not renumber", () => {
  const shop = () => useShop.getState();
  const first = shop().addSale({ ...saleInput, date: "2026-09-12" });
  assert.equal(first.billNo, "B-260912001");
  assert.equal(shop().addSale({ ...saleInput, date: "2026-09-13" }).billNo, "B-260913001");
  assert.equal(shop().addSale({ ...saleInput, date: "2026-09-12" }).billNo, "B-260912002");
  shop().updateSale(first.id, { date: "2026-09-13" });
  assert.equal(shop().sales.find((sale) => sale.id === first.id).billNo, first.billNo);
});

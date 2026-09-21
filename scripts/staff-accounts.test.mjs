import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";

// store-identities.test.mjs-এর মতোই — আসল Zustand স্টোর Node-এ চলে,
// শুধু server-auth এবং Vite-এর asset base stub করা হয়।
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
const overrideKey = "karnaphuli-shopledger-v1-password-overrides";
const owner = { id: "u-owner-1", role: "owner", name: "মালিক", phone: "01821989717" };

beforeEach(() => {
  useShop.setState({
    products: [],
    customers: [],
    customerRequests: [],
    staff: [],
    sales: [],
    purchases: [],
    expenses: [],
    collections: [],
    orders: [],
    adjustments: [],
    numberSequences: {},
    user: owner,
  });
  storage.delete(overrideKey);
});

test("owner creates staff accounts with dated IDs; other roles cannot", () => {
  const shop = () => useShop.getState();
  const first = shop().addStaff({ name: "রহিম", phone: "01711111111", role: "salesman" });
  assert.equal(first.ok, true);
  assert.equal(first.staff?.id, `ST-${day}001`);
  assert.equal(first.staff?.active, true);
  const second = shop().addStaff({ name: "করিম", phone: "+8801712222222", role: "manager" });
  assert.equal(second.ok, true);
  assert.equal(second.staff?.id, `ST-${day}002`);
  assert.equal(second.staff?.phone, "01712222222", "phone normalizes to the BD format");

  useShop.setState({ user: { id: "customer-user-x", role: "customer", name: "ক্রেতা", phone: "01713333333" } });
  const denied = shop().addStaff({ name: "ডাকাতি", phone: "01714444444", role: "salesman" });
  assert.equal(denied.ok, false, "non-owner cannot create staff");
});

test("staff phone must be a free 11-digit mobile, never colliding with owner/customer accounts", () => {
  const shop = () => useShop.getState();
  assert.equal(shop().addStaff({ name: "", phone: "01711111111", role: "salesman" }).ok, false, "name required");
  assert.equal(shop().addStaff({ name: "রহিম", phone: "1234", role: "salesman" }).ok, false, "bad phone");
  assert.equal(shop().addStaff({ name: "রহিম", phone: owner.phone, role: "salesman" }).ok, false, "owner phone taken");
  shop().addCustomer({ name: "ক্রেতা", phone: "01715555555", address: "" });
  assert.equal(shop().addStaff({ name: "রহিম", phone: "01715555555", role: "salesman" }).ok, false, "customer phone taken");
  assert.equal(shop().addStaff({ name: "রহিম", phone: "01711111111", role: "salesman" }).ok, true);
  assert.equal(shop().addStaff({ name: "অন্য", phone: "01711111111", role: "manager" }).ok, false, "staff phone taken");
});

test("staff login: factory password forces change, then role-based session opens", async () => {
  const shop = () => useShop.getState();
  const created = shop().addStaff({ name: "রহিম", phone: "01711111111", role: "manager" });
  shop().logout();
  const first = await shop().login("01711111111", "123456");
  assert.deepEqual(first, { ok: true, mustChangePassword: true });
  assert.equal(shop().user, null, "default-password login must not open the app");
  assert.equal((await shop().login("01711111111", "wrong-pass")).ok, false);

  assert.equal(shop().resetPassword("01711111111", "rahim-pass-1", "rahim-pass-1").ok, true);
  const second = await shop().login("01711111111", "rahim-pass-1");
  assert.deepEqual(second, { ok: true, mustChangePassword: false });
  assert.equal(shop().user?.role, "manager");
  assert.equal(shop().user?.id, `staff-user-${created.staff?.id}`);
});

test("salesman cannot manage, manager can; both see sales, neither sees profit by default rule", async () => {
  const shop = () => useShop.getState();
  shop().addStaff({ name: "সেলস", phone: "01711111111", role: "salesman" });
  shop().addStaff({ name: "ম্যানেজার", phone: "01712222222", role: "manager" });
  shop().logout();
  const { canManage, canSeeProfit } = await import("../src/lib/store.ts");
  const salesmanLogin = await shop().login("01711111111", "123456");
  assert.equal(salesmanLogin.mustChangePassword, true);
  shop().resetPassword("01711111111", "sales-pass-1", "sales-pass-1");
  assert.equal((await shop().login("01711111111", "sales-pass-1")).ok, true);
  assert.equal(shop().user?.role, "salesman");
  assert.equal(canManage(shop().user?.role), false);
  assert.equal(canSeeProfit(shop().user?.role), false);
  shop().resetPassword("01712222222", "mgr-pass-1", "mgr-pass-1");
  assert.equal((await shop().login("01712222222", "mgr-pass-1")).ok, true);
  assert.equal(shop().user?.role, "manager");
  assert.equal(canManage(shop().user?.role), true);
  assert.equal(canSeeProfit(shop().user?.role), true);
  // কর্মচারীর বিক্রিতে createdBy-তে কর্মচারীর নাম
  const sale = shop().addSale({ date: todayKey(), items: [], discount: 0, paid: 0, customerName: "নগদ" });
  assert.equal(sale.createdBy, "ম্যানেজার");
});

test("deactivating staff blocks new login and drops the live session on rehydrate", async () => {
  const shop = () => useShop.getState();
  const created = shop().addStaff({ name: "রহিম", phone: "01711111111", role: "salesman" });
  shop().resetPassword("01711111111", "rahim-pass-1", "rahim-pass-1");
  shop().logout();
  assert.equal((await shop().login("01711111111", "rahim-pass-1")).ok, true);
  assert.equal(shop().user?.id, `staff-user-${created.staff?.id}`);

  useShop.setState({ user: owner });
  assert.equal(shop().updateStaff(created.staff.id, { active: false }), true);
  useShop.setState({
    user: { id: `staff-user-${created.staff.id}`, name: "রহিম", phone: "01711111111", role: "salesman" },
  });
  await useShop.persist.rehydrate();
  assert.equal(shop().user, null, "deactivated staff session must be cleared");
  assert.equal((await shop().login("01711111111", "rahim-pass-1")).ok, false, "re-login blocked");
  assert.match(shop().loginError, /অচালু/);

  // চালু করার অধিকারও মালিকের — আগে owner সেশন ফেরত আনতে হয়
  useShop.setState({ user: owner });
  shop().updateStaff(created.staff.id, { active: true });
  shop().logout();
  assert.equal((await shop().login("01711111111", "rahim-pass-1")).ok, true, "re-activated staff can log in");
});

test("edit changes name/role; phone stays immutable; deleting closes the account for good", async () => {
  const shop = () => useShop.getState();
  const created = shop().addStaff({ name: "রহিম", phone: "01711111111", role: "salesman" });
  assert.equal(shop().updateStaff(created.staff.id, { name: "রহিম উদ্দিন", role: "manager" }), true);
  assert.equal(shop().staff[0].name, "রহিম উদ্দিন");
  assert.equal(shop().staff[0].role, "manager");
  assert.equal(shop().staff[0].phone, "01711111111", "phone cannot be rewritten");
  assert.equal(shop().updateStaff(created.staff.id, { name: "   " }), false, "blank name rejected");

  shop().resetPassword("01711111111", "rahim-pass-1", "rahim-pass-1");
  shop().logout();
  assert.equal((await shop().login("01711111111", "rahim-pass-1")).ok, true);
  assert.equal(shop().user?.name, "রহিম উদ্দিন");

  shop().logout();
  useShop.setState({ user: owner });
  assert.equal(shop().deleteStaff(created.staff.id), true);
  assert.equal(shop().staff.length, 0);
  assert.equal((await shop().login("01711111111", "rahim-pass-1")).ok, false, "deleted staff cannot log in");
});

test("owner sets staff passwords directly; short or unchanged passwords are rejected", async () => {
  const shop = () => useShop.getState();
  const created = shop().addStaff({ name: "রহিম", phone: "01711111111", role: "salesman" });
  assert.match(shop().setStaffPassword(created.staff.id, "12").message, /কমপক্ষে/);
  assert.match(shop().setStaffPassword(created.staff.id, "123456").message, /পুরনোর মতো/);
  assert.equal(shop().setStaffPassword(created.staff.id, "naya-pass-9").ok, true);
  shop().logout();
  assert.equal((await shop().login("01711111111", "123456")).ok, false, "factory password no longer works");
  const login = await shop().login("01711111111", "naya-pass-9");
  assert.equal(login.ok, true);
  assert.equal(login.mustChangePassword, false, "owner-set password is not the factory one");
  useShop.setState({ user: { id: "customer-user-x", role: "customer", name: "ক", phone: "01713333333" } });
  assert.equal(shop().setStaffPassword(created.staff.id, "hack-pass-1").ok, false, "non-owner cannot set");
});

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";

// আসল Zustand স্টোর Node-এ — শুধু server-auth এবং Vite-এর asset base stub।
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
const mustChangeKey = "karnaphuli-shopledger-v1-must-change";

beforeEach(() => {
  useShop.setState({
    products: [],
    customers: [],
    customerRequests: [],
    staff: [],
    owners: [],
    sales: [],
    purchases: [],
    expenses: [],
    collections: [],
    orders: [],
    adjustments: [],
    numberSequences: {},
    user: null,
    loginError: "",
  });
  storage.delete(overrideKey);
  storage.delete(mustChangeKey);
});

test("first launch: initial admin is created without login; username is admin.<firstname>", async () => {
  const shop = () => useShop.getState();
  assert.equal(shop().owners.length, 0);
  const created = shop().createAdminAccount({
    name: "Karim Uddin",
    password: "karim-secret-1",
    confirm: "karim-secret-1",
  });
  assert.equal(created.ok, true);
  assert.equal(created.username, "admin.karim");
  assert.match(created.message, /admin\.karim/);
  assert.equal(shop().owners[0].id, `AD-${day}001`);
  assert.equal(shop().owners[0].active, true);

  // নিজের বাছাই করা পাসওয়ার্ডে সরাসরি লগইন — বাধ্যতামূলক পরিবর্তন নয়
  const login = await shop().login("admin.karim", "karim-secret-1");
  assert.deepEqual(login, { ok: true, mustChangePassword: false });
  assert.equal(shop().user?.role, "owner");
  assert.equal(shop().user?.username, "admin.karim");
  assert.equal((await shop().login("admin.karim", "wrong")).ok, false);
});

test("initial admin setup validates input; no hard-coded credentials exist", async () => {
  const shop = () => useShop.getState();
  assert.equal(
    shop().createAdminAccount({ name: "", password: "abcd", confirm: "abcd" }).ok,
    false,
    "name required",
  );
  assert.equal(
    shop().createAdminAccount({ name: "Karim", password: "abc", confirm: "abc" }).ok,
    false,
    "short password",
  );
  assert.equal(
    shop().createAdminAccount({ name: "Karim", password: "abcd", confirm: "abce" }).ok,
    false,
    "confirm must match",
  );
  assert.equal(
    shop().createAdminAccount({ name: "Karim", password: "abcd", confirm: "abcd", phone: "123" }).ok,
    false,
    "bad optional phone",
  );
  assert.equal(shop().owners.length, 0);
  // কোনো ডিফল্ট অ্যাকাউন্টে ঢোকা যায় না
  assert.equal((await shop().login("admin", "admin123")).ok, false);
  assert.equal((await shop().login("01821989717", "123456")).ok, false);
});

test("once an admin exists, initial setup closes — only a signed-in owner adds more", async () => {
  const shop = () => useShop.getState();
  shop().createAdminAccount({ name: "Karim Uddin", password: "karim-secret-1", confirm: "karim-secret-1" });
  // লগইন ছাড়া দ্বিতীয় অ্যাডমিন নয়
  const blocked = shop().createAdminAccount({
    name: "Karim Hossain",
    password: "other-secret-1",
    confirm: "other-secret-1",
  });
  assert.equal(blocked.ok, false);
  assert.equal(shop().owners.length, 1);

  // মালিক লগইন করে দ্বিতীয় অ্যাডমিন বানালে numbering: admin.karim2
  assert.equal((await shop().login("admin.karim", "karim-secret-1")).ok, true);
  const second = shop().createAdminAccount({
    name: "Karim Hossain",
    password: "temp-pass-1",
    confirm: "temp-pass-1",
  });
  assert.equal(second.ok, true);
  assert.equal(second.username, "admin.karim2");
  const third = shop().createAdminAccount({
    name: "Karim Ali",
    password: "temp-pass-2",
    confirm: "temp-pass-2",
  });
  assert.equal(third.username, "admin.karim3");

  // মালিকের দেওয়া পাসওয়ার্ডে প্রথম লগইনে পরিবর্তন বাধ্যতামূলক
  shop().logout();
  const first = await shop().login("admin.karim2", "temp-pass-1");
  assert.deepEqual(first, { ok: true, mustChangePassword: true });
  assert.equal(shop().user, null);
  shop().resetPassword("admin.karim2", "karim2-own-pass", "karim2-own-pass");
  assert.deepEqual(await shop().login("admin.karim2", "karim2-own-pass"), {
    ok: true,
    mustChangePassword: false,
  });
});

test("usernames are unique across the whole app", () => {
  const shop = () => useShop.getState();
  shop().createAdminAccount({ name: "Karim Uddin", password: "karim-secret-1", confirm: "karim-secret-1" });
  const reg = (username) =>
    shop().submitCustomerRegistration({
      name: "ক্রেতা",
      username,
      password: "kreta-pass-1",
      confirm: "kreta-pass-1",
      phone: "01711111111",
      address: "ঢাকা",
    });
  // অ্যাডমিনের ইউজারনেম ক্রেতা নিতে পারে না
  assert.equal(reg("admin.karim").ok, false);
  assert.equal(reg("ADMIN.KARIM").ok, false, "case-insensitive");
  assert.equal(reg("myshop01").ok, true);
  // অপেক্ষমাণ ইউজারনেমও সংরক্ষিত
  assert.equal(
    shop().submitCustomerRegistration({
      name: "অন্য",
      username: "myshop01",
      password: "kreta-pass-2",
      confirm: "kreta-pass-2",
      phone: "01712222222",
      address: "ঢাকা",
    }).ok,
    false,
  );
  // কর্মচারীর auto-ইউজারনেম সংঘর্ষ এড়িয়ে যায়
  useShop.setState({ user: { id: "x", role: "owner", name: "ম", username: "admin.karim", phone: "" } });
  const staff = shop().addStaff({
    name: "Myshop01 Helper",
    phone: "01713333333",
    role: "salesman",
    password: "start-pass-1",
  });
  assert.equal(staff.ok, true);
  assert.equal(staff.staff.username, "sales.myshop01", "prefix differs — valid");
});

test("customer chooses their own username; it can never be changed", async () => {
  const shop = () => useShop.getState();
  const submit = shop().submitCustomerRegistration({
    name: "রহিম",
    username: "rahim123",
    password: "kreta-pass-1",
    confirm: "kreta-pass-1",
    phone: "01711111111",
    address: "ঢাকা",
  });
  assert.equal(submit.ok, true);
  assert.equal(shop().customerRequests[0].username, "rahim123");
  assert.equal(shop().approveCustomerRegistration(shop().customerRequests[0].id), true);
  const customer = shop().customers[0];
  assert.equal(customer.username, "rahim123");

  // নিজের বাছাই — সরাসরি লগইন
  const login = await shop().login("rahim123", "kreta-pass-1");
  assert.deepEqual(login, { ok: true, mustChangePassword: false });
  assert.equal(shop().user.customerId, customer.id);

  // কোনো পথেই ইউজারনেম বদলায় না
  assert.equal(shop().updateCustomer(customer.id, { username: "newname" }), false);
  assert.equal(shop().customers[0].username, "rahim123");
  useShop.setState({
    user: { id: "admin", role: "systemAdmin", name: "A", username: "sys", phone: "" },
  });
  const requestId = shop().customerRequests[0].id;
  assert.equal(shop().updateCustomerRegistration(requestId, { username: "newname" }), false);
});

test("rejected registration frees the username; pending password is discarded", () => {
  const shop = () => useShop.getState();
  const input = {
    name: "রহিম",
    username: "rahim123",
    password: "kreta-pass-1",
    confirm: "kreta-pass-1",
    phone: "01711111111",
    address: "ঢাকা",
  };
  assert.equal(shop().submitCustomerRegistration(input).ok, true);
  const requestId = shop().customerRequests[0].id;
  assert.equal(shop().rejectCustomerRegistration(requestId), true);
  assert.equal(
    JSON.parse(storage.get(overrideKey) ?? "{}")[`pending-registration-${requestId}`],
    undefined,
  );
  // একই নম্বর+ইউজারনেমে আবার রেজিস্ট্রেশন যায়
  assert.equal(shop().submitCustomerRegistration(input).ok, true);
});

test("legacy phone-era records migrate to usernames; history stays linked by stable ID", async () => {
  const shop = () => useShop.getState();
  // পুরনো ডাটা: ইউজারনেম ছাড়া কর্মচারী/ক্রেতা + ক্রেতার বিক্রি
  useShop.setState({
    staff: [
      {
        id: "ST-legacy-1",
        name: "Rahim Mia",
        phone: "01711111111",
        role: "salesman",
        active: true,
        createdAt: "2026-01-01",
      },
    ],
    customers: [
      {
        id: "C-legacy-1",
        name: "করিম মিয়া",
        phone: "01900000000",
        address: "পদুয়া",
        createdAt: "2026-01-01",
      },
    ],
    sales: [
      {
        id: "B-1",
        billNo: "B-1",
        date: "2026-01-02",
        items: [],
        subtotal: 0,
        discount: 0,
        total: 100,
        paid: 0,
        customerId: "C-legacy-1",
        customerName: "করিম মিয়া",
        createdBy: "দোকান",
        createdAt: "2026-01-02T10:00:00",
      },
    ],
  });
  await useShop.persist.rehydrate();
  const staff = shop().staff[0];
  const customer = shop().customers[0];
  assert.equal(staff.username, "sales.rahim");
  assert.equal(customer.username, "করিম");
  assert.equal(customer.id, "C-legacy-1", "stable internal ID intact");
  assert.equal(shop().sales[0].customerId, "C-legacy-1", "history still linked");
  assert.equal(shop().dueOf("C-legacy-1"), 100);

  // পুরনো ডিফল্ট পাসে (সংরক্ষণ ছাড়া) লগইন বন্ধ — রিসেট করে সেট করতে হয়
  assert.equal((await shop().login("sales.rahim", "123456")).ok, false);
  assert.match(shop().loginError, /পাসওয়ার্ড ভুলে গেছেন/);
  assert.equal(shop().resetPassword("sales.rahim", "migrated-1", "migrated-1").ok, true);
  assert.equal((await shop().login("sales.rahim", "migrated-1")).ok, true);
});

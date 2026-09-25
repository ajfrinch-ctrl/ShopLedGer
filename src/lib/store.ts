import { create } from "zustand";
import { persist } from "zustand/middleware";
import { customerDue, stockOf } from "./calc";
import {
  isBangladeshMobile,
  normalizePhone,
  todayKey,
} from "./format";
import { nextRecordNumber, RECORD_PREFIX, type NumberSequences } from "./record-number";
import { customerInput, customerPatch } from "./customer-identity";
import { getMasterSystemAdminSession, loginMasterSystemAdmin, logoutMasterSystemAdmin } from "./master-admin";
import {
  MIN_PASSWORD_LENGTH,
  performPasswordReset,
  readMustChangeIds,
  readPasswordOverrides,
  storedPassword,
  writeMustChangeIds,
  writePasswordOverrides,
} from "./password-reset";
import {
  ADMIN_PREFIX,
  firstNameSlug,
  generatePrefixedUsername,
  MANAGER_PREFIX,
  normalizeUsername,
  SALES_PREFIX,
  validateCustomerUsername,
} from "./usernames";
import type {
  AdminAccount,
  Collection,
  Customer,
  CustomerRegistration,
  Expense,
  Order,
  Product,
  Purchase,
  Sale,
  SaleItem,
  SessionUser,
  StaffAccount,
  StaffRole,
  StockAdjustment,
} from "./types";

export function isOwner(role?: SessionUser["role"]) {
  return role === "owner" || role === "systemAdmin";
}

export function isSystemAdmin(role?: SessionUser["role"]) {
  return role === "systemAdmin";
}

export function canManage(role?: SessionUser["role"]) {
  return isOwner(role) || role === "manager";
}

export function canSeeProfit(role?: SessionUser["role"]) {
  return isOwner(role) || role === "manager";
}

export function roleLabel(role?: SessionUser["role"]) {
  switch (role) {
    case "owner":
      return "মালিক";
    case "systemAdmin":
      return "সিস্টেম অ্যাডমিন";
    case "manager":
      return "ব্যবস্থাপক";
    case "salesman":
      return "সেলস ম্যান";
    case "customer":
      return "ক্রেতা";
    default:
      return "";
  }
}

type MasterSessionStatus = "not-required" | "checking" | "verified";

interface ShopState {
  hydrated: boolean;
  user: SessionUser | null;
  masterSession: MasterSessionStatus;
  products: Product[];
  customers: Customer[];
  customerRequests: CustomerRegistration[];
  staff: StaffAccount[];
  /** দোকানের মালিক/অ্যাডমিন অ্যাকাউন্ট — অ্যাপের ভেতরেই তৈরি হয়। */
  owners: AdminAccount[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  collections: Collection[];
  orders: Order[];
  adjustments: StockAdjustment[];
  numberSequences: NumberSequences;
  loginError: string;
  setHydrated: (v: boolean) => void;
  /** ok=true + mustChangePassword → প্রথম-লগইনে পরিবর্তন বাধ্যতামূলক, ততক্ষণ user সেট হয় না। */
  login: (username: string, password: string) => Promise<{ ok: boolean; mustChangePassword: boolean }>;
  resetPassword: (identity: string, newPassword: string, confirm: string) => { ok: boolean; message: string };
  /** ফিঙ্গারপ্রিন্ট/পিন/ফেস (WebAuthn) verify হওয়ার পর পাসওয়ার্ড ছাড়া লগইন। */
  loginWithPasskey: (username: string) => boolean;
  /**
   * অ্যাডমিন অ্যাকাউন্ট তৈরি — ইউজারনেম স্বয়ংক্রিয় (`admin.` + প্রথম নাম)।
   * কোনো অ্যাডমিন না থাকলে (প্রথম চালু) লগইন ছাড়াই, পরে শুধু মালিক পারে।
   */
  createAdminAccount: (input: {
    name: string;
    password: string;
    confirm: string;
    phone?: string;
  }) => { ok: boolean; message: string; username?: string };
  verifyMasterSession: () => Promise<void>;
  logout: () => void;
  submitCustomerRegistration: (input: {
    name: string;
    username: string;
    password: string;
    confirm: string;
    phone: string;
    address: string;
  }) => { ok: boolean; message: string };
  approveCustomerRegistration: (id: string) => boolean;
  rejectCustomerRegistration: (id: string) => boolean;
  /**
   * ক্রেতা তৈরি — ইউজারনেম না দিলে নাম থেকে স্বয়ংক্রিয়, পাসওয়ার্ড না দিলে
   * লগইন বন্ধ থাকে (রিসেট করে সেট করতে হয়)।
   */
  addCustomer: (
    c: Omit<Customer, "id" | "createdAt" | "username"> & { username?: string; password?: string },
  ) => Customer;
  updateCustomer: (
    id: string,
    patch: Partial<Pick<Customer, "name" | "address" | "whatsappPhone" | "active">>,
  ) => boolean;
  deleteCustomer: (id: string) => boolean;
  /** মালিক-তৈরি কর্মচারীর অ্যাকাউন্ট — মালিকের দেওয়া পাসওয়ার্ডসহ, ইউজারনেম স্বয়ংক্রিয়। */
  addStaff: (input: { name: string; phone: string; role: StaffRole; password: string }) => {
    ok: boolean;
    message: string;
    staff?: StaffAccount;
  };
  updateStaff: (id: string, patch: Partial<Pick<StaffAccount, "name" | "role" | "active">>) => boolean;
  deleteStaff: (id: string) => boolean;
  /** মালিক কর্মচারীর পাসওয়ার্ড সরাসরি সেট করে (আলাদা localStorage কীতে)। */
  setStaffPassword: (id: string, newPassword: string) => { ok: boolean; message: string };
  updateCustomerRegistration: (id: string, patch: Partial<Pick<CustomerRegistration, "name" | "address">>) => boolean;
  deleteCustomerRegistration: (id: string) => boolean;
  addProduct: (p: Omit<Product, "id" | "createdAt" | "code">) => Product;
  updateProduct: (id: string, patch: Partial<Omit<Product, "id" | "createdAt" | "code">>) => boolean;
  deleteProduct: (id: string) => boolean;
  addSale: (input: {
    date: string;
    items: SaleItem[];
    discount: number;
    paid: number;
    customerId?: string;
    customerName: string;
    note?: string;
  }) => Sale;
  updateSale: (id: string, patch: Partial<Omit<Sale, "id" | "createdAt" | "billNo">>) => boolean;
  deleteSale: (id: string) => boolean;
  addPurchase: (input: Omit<Purchase, "id" | "createdAt">) => Purchase;
  updatePurchase: (id: string, patch: Partial<Omit<Purchase, "id" | "createdAt">>) => boolean;
  deletePurchase: (id: string) => boolean;
  addExpense: (input: Omit<Expense, "id" | "createdAt">) => Expense;
  updateExpense: (id: string, patch: Partial<Omit<Expense, "id" | "createdAt">>) => boolean;
  deleteExpense: (id: string) => boolean;
  addCollection: (input: Omit<Collection, "id" | "createdAt">) => Collection;
  updateCollection: (id: string, patch: Partial<Omit<Collection, "id" | "createdAt">>) => boolean;
  deleteCollection: (id: string) => boolean;
  addAdjustment: (input: Omit<StockAdjustment, "id" | "createdAt">) => void;
  updateAdjustment: (id: string, patch: Partial<Omit<StockAdjustment, "id" | "createdAt">>) => boolean;
  deleteAdjustment: (id: string) => boolean;
  addOrder: (input: Omit<Order, "id" | "createdAt" | "updatedAt" | "status">) => Order;
  updateOrder: (id: string, patch: Partial<Omit<Order, "id" | "createdAt" | "updatedAt">>) => boolean;
  deleteOrder: (id: string) => boolean;
  setOrderStatus: (id: string, status: Order["status"]) => void;
  fulfillOrder: (id: string) => Sale | null;
  productStock: (id: string) => number;
  dueOf: (customerId: string) => number;
}

/** অপেক্ষমাণ রেজিস্ট্রেশনের পাসওয়ার্ড — অনুমোদনে ক্রেতার আইডিতে সরে যায়। */
function pendingPasswordKey(registrationId: string): string {
  return `pending-registration-${registrationId}`;
}

/** ইউজারনেম সারা অ্যাপে (অ্যাডমিন/কর্মচারী/ক্রেতা/অপেক্ষমাণ) ব্যবহৃত কিনা। */
function usernameTaken(
  state: Pick<ShopState, "owners" | "staff" | "customers" | "customerRequests">,
  username: string,
): boolean {
  const clean = normalizeUsername(username);
  if (!clean) return true;
  const same = (value?: string) => !!value && normalizeUsername(value) === clean;
  return (
    (state.owners ?? []).some((row) => same(row.username)) ||
    state.staff.some((row) => same(row.username)) ||
    state.customers.some((row) => same(row.username)) ||
    state.customerRequests.some((row) => row.status === "pending" && same(row.username))
  );
}

function clearAuthSecrets(accountId: string): void {
  const overrides = readPasswordOverrides();
  if (overrides[accountId] !== undefined) {
    delete overrides[accountId];
    writePasswordOverrides(overrides);
  }
  const flagged = readMustChangeIds();
  if (flagged.includes(accountId)) {
    writeMustChangeIds(flagged.filter((id) => id !== accountId));
  }
}

function reserveNumber(kind: keyof typeof RECORD_PREFIX, date = todayKey()): string {
  let number = "";
  useShop.setState((state) => {
    const existing = [
      ...state.customers, ...state.customerRequests, ...state.products,
      ...state.sales, ...state.purchases, ...state.collections,
      ...state.expenses, ...state.orders, ...state.adjustments,
      ...(state.owners ?? []),
    ].map((row) => row.id);
    existing.push(...state.sales.map((row) => row.billNo), ...state.products.map((row) => row.code));
    const result = nextRecordNumber(RECORD_PREFIX[kind], date, state.numberSequences ?? {}, existing);
    number = result.number;
    // Reserve before inserting, so even failed/removed records never recycle a number.
    return { numberSequences: result.sequences };
  });
  return number;
}

/**
 * পুরনো (ফোন-লগইনের) ডাটায় ইউজারনেম বসানো — একবারই বদলায়, হিসাব অটুট থাকে।
 * - কর্মচারী: ভূমিকার উপসর্গ + প্রথম নাম (`sales.rahim`)।
 * - ক্রেতা/অপেক্ষমাণ: প্রথম নামের slug — সংঘর্ষে শেষে 2, 3 …।
 * - সব লেনদেন আগের মতোই স্থায়ী internal ID দিয়ে যুক্ত থাকে।
 */
function ensureAuthUsernames(
  state: Pick<ShopState, "owners" | "staff" | "customers" | "customerRequests">,
): Partial<Pick<ShopState, "owners" | "staff" | "customers" | "customerRequests">> | null {
  const owners = state.owners ?? [];
  let changed = state.owners === undefined;
  const taken = new Set<string>();
  const collect = (value?: string) => {
    if (value) taken.add(normalizeUsername(value));
  };
  for (const row of owners) collect(row.username);
  for (const row of state.staff) collect(row.username);
  for (const row of state.customers) collect(row.username);
  for (const row of state.customerRequests) {
    if (row.status === "pending") collect(row.username);
  }
  const isTaken = (username: string) => taken.has(normalizeUsername(username));
  const reserve = (username: string) => {
    taken.add(normalizeUsername(username));
  };
  const customerUsername = (name: string): string => {
    const slug = firstNameSlug(name) || "customer";
    if (!isTaken(slug)) {
      reserve(slug);
      return slug;
    }
    let n = 2;
    while (isTaken(`${slug}${n}`)) n += 1;
    reserve(`${slug}${n}`);
    return `${slug}${n}`;
  };

  const staff = state.staff.map((row) => {
    if (row.username) return row;
    changed = true;
    const prefix = row.role === "manager" ? MANAGER_PREFIX : SALES_PREFIX;
    const username = generatePrefixedUsername(prefix, row.name, isTaken);
    reserve(username);
    return { ...row, username };
  });
  const customers = state.customers.map((row) => {
    if (row.username) return row;
    changed = true;
    return { ...row, username: customerUsername(row.name) };
  });
  const customerRequests = state.customerRequests.map((row) => {
    if (row.status !== "pending" || row.username) return row;
    changed = true;
    return { ...row, username: customerUsername(row.name) };
  });
  if (!changed) return null;
  return { owners, staff, customers, customerRequests };
}

/**
 * Rehydrate-এর পর session যাচাই —
 * 1. সিস্টেম অ্যাডমিন: সার্ভার session verify (আগের মতো)।
 * 2. অ্যাডমিন/কর্মচারী/ক্রেতা: রেকর্ড না থাকলে, অচালু হলে, পাসওয়ার্ড সেট না
 *    থাকলে বা প্রথম-লগইন পরিবর্তন বাকি থাকলে logout।
 */
function revalidatePersistedSession(): void {
  const state = useShop.getState();
  const user = state.user;
  if (!user) return;
  if (user.role === "systemAdmin") {
    void state.verifyMasterSession();
    return;
  }
  const overrides = readPasswordOverrides();
  const mustChange = readMustChangeIds();
  const sessionValid = (accountId: string, active?: boolean): boolean => {
    if (active === false) return false;
    if (storedPassword(accountId, overrides) === null) return false;
    if (mustChange.includes(accountId)) return false;
    return true;
  };
  if (user.role === "customer") {
    const customer = state.customers.find((c) => c.id === user.customerId);
    if (!customer || !sessionValid(customer.id, customer.active)) {
      state.logout();
      return;
    }
    if (normalizeUsername(user.username ?? "") !== normalizeUsername(customer.username)) {
      state.logout();
    }
    return;
  }
  if (user.role === "manager" || user.role === "salesman") {
    // session id-তে staff-user-<id> — রেকর্ড মুছে গেলে বা অচালু হলে session বরাদ্দ
    const accountId = user.id.startsWith("staff-user-") ? user.id.slice("staff-user-".length) : "";
    const staff = state.staff.find((s) => s.id === accountId);
    if (!staff || !sessionValid(staff.id, staff.active)) {
      state.logout();
      return;
    }
    if (normalizeUsername(user.username ?? "") !== normalizeUsername(staff.username)) {
      state.logout();
    }
    return;
  }
  const acc = (state.owners ?? []).find((a) => a.id === user.id);
  if (!acc || !sessionValid(acc.id, acc.active)) {
    // পুরনো hard-coded/ডেমো মালিক session — আর অ্যাকাউন্ট নেই
    state.logout();
    return;
  }
  if (normalizeUsername(user.username ?? "") !== normalizeUsername(acc.username)) {
    state.logout();
  }
}

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      user: null,
      masterSession: "not-required",
      loginError: "",
      // নতুন ডিভাইসে খালি খাতা দিয়ে শুরু হয় — ডেমো/নমুনা ডাটা নেই।
      // আগে ব্যবহৃত ডিভাইসে localStorage-এ সংরক্ষিত হিসাব হাইড্রেট হয়।
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

      setHydrated: (v) => set({ hydrated: v }),

      login: async (username, password) => {
        const identity = normalizeUsername(username);
        if (!identity) {
          set({ loginError: "আইডি বা পাসওয়ার্ড ভুল হয়েছে" });
          return { ok: false, mustChangePassword: false };
        }
        const overrides = readPasswordOverrides();
        const mustChange = readMustChangeIds();
        const sameUser = (value?: string) => !!value && normalizeUsername(value) === identity;
        // মালিক/অ্যাডমিন — অ্যাপের ভেতরে তৈরি অ্যাকাউন্ট
        const acc = (get().owners ?? []).find((a) => sameUser(a.username));
        if (acc) {
          if (acc.active === false) {
            set({ loginError: "এই অ্যাডমিনের অ্যাকাউন্ট অচালু — মালিকের সঙ্গে যোগাযোগ করুন" });
            return { ok: false, mustChangePassword: false };
          }
          const expected = storedPassword(acc.id, overrides);
          if (expected === null) {
            set({ loginError: "এই অ্যাকাউন্টের পাসওয়ার্ড সেট করা নেই — «পাসওয়ার্ড ভুলে গেছেন?» চাপুন" });
            return { ok: false, mustChangePassword: false };
          }
          if (expected !== password) {
            set({ loginError: "আইডি বা পাসওয়ার্ড ভুল হয়েছে" });
            return { ok: false, mustChangePassword: false };
          }
          // প্রথম লগইন: পরিবর্তন বাধ্যতামূলক থাকলে user সেট হয় না —
          // লগইন পেজ থেকে সরাসরি অ্যাপে ঢুকতে পারবে না
          if (mustChange.includes(acc.id)) {
            set({ loginError: "" });
            return { ok: true, mustChangePassword: true };
          }
          const user: SessionUser = {
            id: acc.id,
            name: acc.name,
            username: acc.username,
            phone: acc.phone ?? "",
            role: "owner",
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return { ok: true, mustChangePassword: false };
        }

        // কর্মচারী — মালিক তৈরি, চালু থাকা
        const staff = get().staff.find((s) => sameUser(s.username));
        if (staff) {
          if (staff.active === false) {
            set({ loginError: "এই কর্মচারীর অ্যাকাউন্ট অচালু — মালিকের সঙ্গে যোগাযোগ করুন" });
            return { ok: false, mustChangePassword: false };
          }
          const expected = storedPassword(staff.id, overrides);
          if (expected === null) {
            set({ loginError: "এই অ্যাকাউন্টের পাসওয়ার্ড সেট করা নেই — «পাসওয়ার্ড ভুলে গেছেন?» চাপুন" });
            return { ok: false, mustChangePassword: false };
          }
          if (expected !== password) {
            set({ loginError: "আইডি বা পাসওয়ার্ড ভুল হয়েছে" });
            return { ok: false, mustChangePassword: false };
          }
          if (mustChange.includes(staff.id)) {
            set({ loginError: "" });
            return { ok: true, mustChangePassword: true };
          }
          const user: SessionUser = {
            id: `staff-user-${staff.id}`,
            name: staff.name,
            username: staff.username,
            phone: staff.phone,
            role: staff.role,
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return { ok: true, mustChangePassword: false };
        }

        // ক্রেতা — মালিক তৈরি/অনুমোদিত, চালু থাকা
        const customer = get().customers.find((c) => sameUser(c.username));
        if (customer) {
          if (customer.active === false) {
            set({ loginError: "এই ক্রেতার অ্যাকাউন্ট অচালু — দোকানের সঙ্গে যোগাযোগ করুন" });
            return { ok: false, mustChangePassword: false };
          }
          const expected = storedPassword(customer.id, overrides);
          if (expected === null) {
            set({ loginError: "এই অ্যাকাউন্টের পাসওয়ার্ড সেট করা নেই — «পাসওয়ার্ড ভুলে গেছেন?» চাপুন" });
            return { ok: false, mustChangePassword: false };
          }
          if (expected !== password) {
            set({ loginError: "আইডি বা পাসওয়ার্ড ভুল হয়েছে" });
            return { ok: false, mustChangePassword: false };
          }
          if (mustChange.includes(customer.id)) {
            set({ loginError: "" });
            return { ok: true, mustChangePassword: true };
          }
          const user: SessionUser = {
            id: `customer-user-${customer.id}`,
            name: customer.name,
            username: customer.username,
            phone: customer.phone,
            role: "customer",
            customerId: customer.id,
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return { ok: true, mustChangePassword: false };
        }

        try {
          const master = await loginMasterSystemAdmin({ data: { username: identity, password } });
          if (master.authenticated && master.user) {
            set({ user: master.user, masterSession: "verified", loginError: "" });
            return { ok: true, mustChangePassword: false };
          }
        } catch {
          // Static deployments and local demos do not have the server function.
        }
        set({ loginError: "আইডি বা পাসওয়ার্ড ভুল হয়েছে" });
        return { ok: false, mustChangePassword: false };
      },

      resetPassword: (identity, newPassword, confirm) => {
        // অ্যাডমিন + কর্মচারী + সব ক্রেতা — সংরক্ষিত পাসওয়ার্ডসহ pure ফাংশনে পাঠানো হয়
        const overrides = readPasswordOverrides();
        const accounts = [
          ...(get().owners ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            username: a.username,
            password: storedPassword(a.id, overrides),
          })),
          ...get().staff.map((s) => ({
            id: s.id,
            name: s.name,
            username: s.username,
            password: storedPassword(s.id, overrides),
          })),
          ...get().customers.map((c) => ({
            id: c.id,
            name: c.name,
            username: c.username,
            password: storedPassword(c.id, overrides),
          })),
        ];
        const result = performPasswordReset({
          accounts,
          identity,
          newPassword,
          confirm,
          overrides,
        });
        if (!result.ok) {
          return { ok: false, message: result.message };
        }
        // আলাদা কীতে সেভ — ডেমো রিসেট/ডাটা ব্যাকআপে এটি জড়িয়ে পড়ে না
        writePasswordOverrides(result.overrides);
        // রিসেট মানেই নিজের পাসওয়ার্ড সেট — বাধ্যতামূলক পরিবর্তন শেষ
        writeMustChangeIds(readMustChangeIds().filter((id) => id !== result.accountId));
        return {
          ok: true,
          message: "নতুন পাসওয়ার্ড সেট হয়েছে — এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন",
        };
      },

      loginWithPasskey: (username) => {
        // পাসওয়ার্ড চেক না — WebAuthn signature আগে verify হয়েছে (src/lib/passkey.ts)
        const identity = normalizeUsername(username);
        const sameUser = (value?: string) => !!value && normalizeUsername(value) === identity;
        const acc = (get().owners ?? []).find((a) => sameUser(a.username));
        if (acc) {
          if (acc.active === false) {
            set({ loginError: "এই অ্যাডমিনের অ্যাকাউন্ট অচালু — মালিকের সঙ্গে যোগাযোগ করুন" });
            return false;
          }
          const user: SessionUser = {
            id: acc.id,
            name: acc.name,
            username: acc.username,
            phone: acc.phone ?? "",
            role: "owner",
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return true;
        }
        const staff = get().staff.find((s) => sameUser(s.username));
        if (staff) {
          if (staff.active === false) {
            set({ loginError: "এই কর্মচারীর অ্যাকাউন্ট অচালু — মালিকের সঙ্গে যোগাযোগ করুন" });
            return false;
          }
          const user: SessionUser = {
            id: `staff-user-${staff.id}`,
            name: staff.name,
            username: staff.username,
            phone: staff.phone,
            role: staff.role,
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return true;
        }
        const customer = get().customers.find((c) => sameUser(c.username));
        if (customer) {
          if (customer.active === false) {
            set({ loginError: "এই ক্রেতার অ্যাকাউন্ট অচালু — দোকানের সঙ্গে যোগাযোগ করুন" });
            return false;
          }
          const user: SessionUser = {
            id: `customer-user-${customer.id}`,
            name: customer.name,
            username: customer.username,
            phone: customer.phone,
            role: "customer",
            customerId: customer.id,
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return true;
        }
        set({ loginError: "এই ইউজারনেমের কোনো অ্যাকাউন্ট পাওয়া যায়নি" });
        return false;
      },

      createAdminAccount: (input) => {
        const isInitial = (get().owners ?? []).length === 0;
        if (!isInitial && !isOwner(get().user?.role)) {
          return { ok: false, message: "অ্যাডমিন অ্যাকাউন্ট তৈরি করতে পারবেন শুধু মালিক" };
        }
        const name = input.name.trim();
        if (!name) return { ok: false, message: "নাম দিন" };
        const password = input.password ?? "";
        if (password.length < MIN_PASSWORD_LENGTH) {
          return { ok: false, message: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে` };
        }
        if (password !== (input.confirm ?? "")) {
          return { ok: false, message: "দুটি পাসওয়ার্ড মিলছে না" };
        }
        let phone = "";
        if (input.phone?.trim()) {
          phone = normalizePhone(input.phone);
          if (!isBangladeshMobile(phone)) {
            return { ok: false, message: "সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন" };
          }
        }
        const username = generatePrefixedUsername(ADMIN_PREFIX, name, (candidate) =>
          usernameTaken(get(), candidate),
        );
        const row: AdminAccount = {
          id: reserveNumber("admin"),
          name,
          username,
          phone: phone || undefined,
          active: true,
          createdAt: todayKey(),
        };
        set((s) => ({ owners: [row, ...(s.owners ?? [])] }));
        writePasswordOverrides({ ...readPasswordOverrides(), [row.id]: password });
        if (!isInitial) {
          // মালিক অন্যের জন্য বানালে প্রথম লগইনে নিজের পাসওয়ার্ড সেট করতে হবে
          writeMustChangeIds([...readMustChangeIds().filter((id) => id !== row.id), row.id]);
        }
        return {
          ok: true,
          message: `অ্যাডমিন অ্যাকাউন্ট তৈরি হয়েছে — ইউজারনেম: ${username}`,
          username,
        };
      },

      verifyMasterSession: async () => {
        if (get().user?.role !== "systemAdmin") {
          set({ masterSession: "not-required" });
          return;
        }
        set({ masterSession: "checking" });
        try {
          const result = await getMasterSystemAdminSession();
          if (result.user) {
            set({ user: result.user, masterSession: "verified" });
            return;
          }
        } catch {
          // A missing/unreachable auth server must not leave a stale admin session active.
        }
        set({ user: null, masterSession: "not-required", loginError: "" });
      },

      logout: () => {
        if (get().user?.role === "systemAdmin") void logoutMasterSystemAdmin().catch(() => undefined);
        set({ user: null, masterSession: "not-required", loginError: "" });
      },

      submitCustomerRegistration: (input) => {
        const name = input.name.trim();
        const phone = normalizePhone(input.phone);
        const address = input.address.trim();
        if (!name) return { ok: false, message: "নাম দিন" };
        if (!address) return { ok: false, message: "ঠিকানা দিন" };
        if (!isBangladeshMobile(phone)) {
          return { ok: false, message: "সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন" };
        }
        const checked = validateCustomerUsername(input.username ?? "", (candidate) =>
          usernameTaken(get(), candidate),
        );
        if (!checked.ok) return { ok: false, message: checked.message };
        const password = input.password ?? "";
        if (password.length < MIN_PASSWORD_LENGTH) {
          return { ok: false, message: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে` };
        }
        if (password !== (input.confirm ?? "")) {
          return { ok: false, message: "দুটি পাসওয়ার্ড মিলছে না" };
        }
        const existing = get().customers.some((c) => normalizePhone(c.phone) === phone);
        if (existing) {
          return { ok: false, message: "এই মোবাইল নম্বরের ক্রেতা আগে থেকেই আছে" };
        }
        const pending = get().customerRequests.some(
          (r) => r.status === "pending" && normalizePhone(r.phone) === phone,
        );
        if (pending) {
          return { ok: false, message: "এই নম্বরের রেজিস্ট্রেশন আগে থেকেই অপেক্ষমাণ আছে" };
        }
        const row: CustomerRegistration = {
          id: reserveNumber("registration"),
          name,
          username: checked.username,
          phone,
          address,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ customerRequests: [row, ...s.customerRequests] }));
        // অনুমোদন পর্যন্ত পাসওয়ার্ড আলাদা কীতে — রেকর্ডে নয়
        writePasswordOverrides({
          ...readPasswordOverrides(),
          [pendingPasswordKey(row.id)]: password,
        });
        return {
          ok: true,
          message: "রেজিস্ট্রেশন পাঠানো হয়েছে। মালিক অনুমোদন করলে আপনার ইউজারনেম ও পাসওয়ার্ড দিয়ে প্রবেশ করতে পারবেন",
        };
      },

      approveCustomerRegistration: (id) => {
        const request = get().customerRequests.find(
          (r) => r.id === id && r.status === "pending",
        );
        if (!request) return false;
        const phone = normalizePhone(request.phone);
        const existing = get().customers.find((c) => normalizePhone(c.phone) === phone);
        // এরই মধ্যে ইউজারনেমটি অন্য অ্যাকাউন্ট নিয়ে নিলে অনন্য বিকল্প বানানো হয়
        // (নিজের অপেক্ষমাণ রেকর্ডটি সংঘর্ষ নয়)
        const takenByOther = (candidate: string): boolean => {
          const clean = normalizeUsername(candidate);
          if (!clean) return true;
          const same = (value?: string) => !!value && normalizeUsername(value) === clean;
          const state = get();
          return (
            (state.owners ?? []).some((row) => same(row.username)) ||
            state.staff.some((row) => same(row.username)) ||
            state.customers.some((row) => same(row.username)) ||
            state.customerRequests.some(
              (row) => row.id !== request.id && row.status === "pending" && same(row.username),
            )
          );
        };
        let username = normalizeUsername(request.username ?? "");
        if (!username || takenByOther(username)) {
          const slug = firstNameSlug(request.name) || "customer";
          username = slug;
          let n = 2;
          while (takenByOther(username)) {
            username = `${slug}${n}`;
            n += 1;
          }
        }
        const customer =
          existing ??
          ({
            id: reserveNumber("customer"),
            name: request.name,
            username,
            phone,
            address: request.address,
            createdAt: todayKey(),
          } satisfies Customer);
        set((s) => ({
          customers: existing ? s.customers : [customer, ...s.customers],
          customerRequests: s.customerRequests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: "approved",
                  customerId: customer.id,
                  reviewedAt: new Date().toISOString(),
                }
              : r,
          ),
        }));
        // রেজিস্ট্রেশনের পাসওয়ার্ড নতুন ক্রেতার আইডিতে সরে যায় (নিজের বাছাই — বাধ্যতামূলক পরিবর্তন নয়)
        const overrides = readPasswordOverrides();
        const pendingKey = pendingPasswordKey(request.id);
        if (!existing && overrides[pendingKey]) {
          overrides[customer.id] = overrides[pendingKey];
        }
        delete overrides[pendingKey];
        writePasswordOverrides(overrides);
        return true;
      },

      rejectCustomerRegistration: (id) => {
        const request = get().customerRequests.find(
          (r) => r.id === id && r.status === "pending",
        );
        if (!request) return false;
        set((s) => ({
          customerRequests: s.customerRequests.map((r) =>
            r.id === id
              ? { ...r, status: "rejected", reviewedAt: new Date().toISOString() }
              : r,
          ),
        }));
        const overrides = readPasswordOverrides();
        delete overrides[pendingPasswordKey(request.id)];
        writePasswordOverrides(overrides);
        return true;
      },

      addCustomer: (c) => {
        // বিক্রির সময় দ্রুত ক্রেতা যোগে ইউজারনেম দেওয়া হয় না — নাম থেকে অনন্য slug
        let username = (c.username ?? "").trim();
        if (!username) {
          const slug = firstNameSlug(c.name) || "customer";
          username = slug;
          let n = 2;
          while (usernameTaken(get(), username)) {
            username = `${slug}${n}`;
            n += 1;
          }
        }
        const input = customerInput({ ...c, username }, get().customers);
        if (usernameTaken(get(), input.username)) {
          throw new Error("এই ইউজারনেমটি ব্যবহৃত — অন্য একটি বেছে নিন");
        }
        const row: Customer = { ...input, id: reserveNumber("customer"), createdAt: todayKey() };
        set((s) => ({ customers: [row, ...s.customers] }));
        const password = c.password ?? "";
        if (password) {
          if (password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(`পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে`);
          }
          writePasswordOverrides({ ...readPasswordOverrides(), [row.id]: password });
          // মালিকের দেওয়া পাসওয়ার্ড — প্রথম লগইনে নিজেরটা সেট করতে হবে
          writeMustChangeIds([...readMustChangeIds().filter((flag) => flag !== row.id), row.id]);
        }
        // পাসওয়ার্ড ছাড়া তৈরি হলে লগইন বন্ধ — রিসেট করে সেট করতে হয়
        return row;
      },

      updateCustomer: (id, input) => {
        const current = get().customers.find((customer) => customer.id === id);
        if (!current) return false;
        let patch;
        try {
          patch = customerPatch(current, input);
        } catch {
          return false;
        }
        set((s) => ({
          customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          customerRequests: s.customerRequests.map((r) =>
            r.customerId === id && r.status === "approved"
              ? {
                  ...r,
                  name: patch.name ?? r.name,
                  address: patch.address ?? r.address,
                }
              : r,
          ),
          sales: s.sales.map((sale) =>
            sale.customerId === id && patch.name
              ? { ...sale, customerName: patch.name }
              : sale,
          ),
          collections: s.collections.map((collection) =>
            collection.kind === "customer" && collection.partyId === id && patch.name
              ? { ...collection, partyName: patch.name }
              : collection,
          ),
          orders: s.orders.map((order) =>
            order.customerId === id && patch.name ? { ...order, customerName: patch.name } : order,
          ),
        }));
        return true;
      },

      deleteCustomer: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        const customer = get().customers.find((c) => c.id === id);
        if (!customer) return false;
        const phone = normalizePhone(customer.phone);
        set((s) => ({
          customers: s.customers.filter((c) => c.id !== id),
          customerRequests: s.customerRequests.filter(
            (r) => r.customerId !== id && normalizePhone(r.phone) !== phone,
          ),
          sales: s.sales.filter((sale) => sale.customerId !== id),
          collections: s.collections.filter(
            (collection) => !(collection.kind === "customer" && collection.partyId === id),
          ),
          orders: s.orders.filter((order) => order.customerId !== id),
        }));
        return true;
      },

      addStaff: (input) => {
        if (!isOwner(get().user?.role)) {
          return { ok: false, message: "কর্মচারীর অ্যাকাউন্ট তৈরি করতে পারবেন শুধু মালিক" };
        }
        const name = input.name.trim();
        const phone = normalizePhone(input.phone);
        if (!name) return { ok: false, message: "নাম দিন" };
        if (!isBangladeshMobile(phone)) {
          return { ok: false, message: "সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন" };
        }
        const password = input.password ?? "";
        if (password.length < MIN_PASSWORD_LENGTH) {
          return { ok: false, message: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে` };
        }
        // যোগাযোগের নম্বর একটাই অ্যাকাউন্টে — ডুপ্লিকেটে ভুল বোঝাবুঝি হয়
        const taken =
          (get().owners ?? []).some((a) => a.phone && normalizePhone(a.phone) === phone) ||
          get().staff.some((s) => normalizePhone(s.phone) === phone) ||
          get().customers.some((c) => normalizePhone(c.phone) === phone);
        if (taken) return { ok: false, message: "এই মোবাইল নম্বরের একাউন্ট আগে থেকেই আছে" };
        const prefix = input.role === "manager" ? MANAGER_PREFIX : SALES_PREFIX;
        const username = generatePrefixedUsername(prefix, name, (candidate) =>
          usernameTaken(get(), candidate),
        );
        const row: StaffAccount = {
          id: reserveNumber("staff"),
          name,
          username,
          phone,
          role: input.role,
          active: true,
          createdAt: todayKey(),
        };
        set((s) => ({ staff: [row, ...s.staff] }));
        writePasswordOverrides({ ...readPasswordOverrides(), [row.id]: password });
        // মালিকের দেওয়া পাসওয়ার্ড — প্রথম লগইনে নিজেরটা সেট করতে হবে
        writeMustChangeIds([...readMustChangeIds().filter((flag) => flag !== row.id), row.id]);
        return {
          ok: true,
          message: `কর্মচারী যোগ হয়েছে — ইউজারনেম: ${username} — প্রথম লগইনে নিজের পাসওয়ার্ড সেট করবে`,
          staff: row,
        };
      },

      updateStaff: (id, patch) => {
        if (!isOwner(get().user?.role)) return false;
        const current = get().staff.find((s) => s.id === id);
        if (!current) return false;
        if (patch.name !== undefined && !patch.name.trim()) return false;
        if (patch.role !== undefined && patch.role !== "manager" && patch.role !== "salesman") {
          return false;
        }
        set((s) => ({
          staff: s.staff.map((row) =>
            row.id === id
              ? {
                  ...row,
                  name: patch.name?.trim() || row.name,
                  role: patch.role ?? row.role,
                  active: patch.active ?? row.active,
                }
              : row,
          ),
        }));
        return true;
      },

      deleteStaff: (id) => {
        if (!isOwner(get().user?.role)) return false;
        const current = get().staff.find((s) => s.id === id);
        if (!current) return false;
        clearAuthSecrets(id);
        // আগের লেনদেনে নাম-লেখা (createdBy ইত্যাদি) থাকতেই থাকবে — হিসাব মুছে যায় না
        set((s) => ({ staff: s.staff.filter((row) => row.id !== id) }));
        return true;
      },

      setStaffPassword: (id, newPassword) => {
        if (!isOwner(get().user?.role)) {
          return { ok: false, message: "কর্মচারীর পাসওয়ার্ড বদলাতে পারবেন শুধু মালিক" };
        }
        const current = get().staff.find((s) => s.id === id);
        if (!current) return { ok: false, message: "কর্মচারীটি পাওয়া যায়নি" };
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
          return { ok: false, message: `পাসওয়ার্ড কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষরের হতে হবে` };
        }
        const overrides = readPasswordOverrides();
        if (newPassword === storedPassword(current.id, overrides)) {
          return { ok: false, message: "নতুন পাসওয়ার্ডটা পুরনোর মতো হতে পারে না" };
        }
        writePasswordOverrides({ ...overrides, [current.id]: newPassword });
        // মালিকের সরাসরি সেট করা পাসওয়ার্ডই চূড়ান্ত — বাধ্যতামূলক পরিবর্তন শেষ
        writeMustChangeIds(readMustChangeIds().filter((flag) => flag !== current.id));
        return { ok: true, message: "কর্মচারীর পাসওয়ার্ড পরিবর্তিত হয়েছে" };
      },

      updateCustomerRegistration: (id, patch) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        const current = get().customerRequests.find((request) => request.id === id);
        if (!current) return false;
        // Also reject runtime payloads bypassing TypeScript (including admin edits).
        const immutable = patch as Partial<CustomerRegistration>;
        if ((immutable.username !== undefined && normalizeUsername(immutable.username) !== normalizeUsername(current.username ?? "")) ||
            (immutable.phone !== undefined && normalizePhone(immutable.phone) !== normalizePhone(current.phone)) ||
            (immutable.id !== undefined && immutable.id !== current.id)) return false;
        const next = {
          name: patch.name?.trim() || current.name,
          address: patch.address?.trim() ?? current.address,
        };
        set((s) => ({
          customerRequests: s.customerRequests.map((request) =>
            request.id === id ? { ...request, ...next } : request,
          ),
          customers: current.customerId
            ? s.customers.map((customer) =>
                customer.id === current.customerId ? { ...customer, ...next } : customer,
              )
            : s.customers,
          sales: current.customerId
            ? s.sales.map((sale) =>
                sale.customerId === current.customerId ? { ...sale, customerName: next.name } : sale,
              )
            : s.sales,
          collections: current.customerId
            ? s.collections.map((collection) =>
                collection.kind === "customer" && collection.partyId === current.customerId
                  ? { ...collection, partyName: next.name }
                  : collection,
              )
            : s.collections,
          orders: current.customerId
            ? s.orders.map((order) =>
                order.customerId === current.customerId ? { ...order, customerName: next.name } : order,
              )
            : s.orders,
        }));
        return true;
      },

      deleteCustomerRegistration: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        const exists = get().customerRequests.some((request) => request.id === id);
        if (!exists) return false;
        const overrides = readPasswordOverrides();
        delete overrides[pendingPasswordKey(id)];
        writePasswordOverrides(overrides);
        set((s) => ({ customerRequests: s.customerRequests.filter((request) => request.id !== id) }));
        return true;
      },

      addProduct: (p) => {
        const id = reserveNumber("product");
        const row: Product = { ...p, id, code: id, createdAt: todayKey() };
        set((s) => ({ products: [row, ...s.products] }));
        return row;
      },

      updateProduct: (id, patch) => {
        if (!get().products.some((product) => product.id === id)) return false;
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...patch, id: p.id, code: p.code, createdAt: p.createdAt } : p)),
          sales: s.sales.map((sale) => ({
            ...sale,
            items: sale.items.map((item) =>
              item.productId === id
                ? {
                    ...item,
                    productName: patch.name ?? item.productName,
                    unit: patch.unit ?? item.unit,
                  }
                : item,
            ),
          })),
          purchases: s.purchases.map((purchase) =>
            purchase.productId === id
              ? {
                  ...purchase,
                  productName: patch.name ?? purchase.productName,
                  unit: patch.unit ?? purchase.unit,
                }
              : purchase,
          ),
          adjustments: s.adjustments.map((adjustment) =>
            adjustment.productId === id
              ? { ...adjustment, productName: patch.name ?? adjustment.productName }
              : adjustment,
          ),
          orders: s.orders.map((order) => ({
            ...order,
            items: order.items.map((item) =>
              item.productId === id
                ? {
                    ...item,
                    productName: patch.name ?? item.productName,
                    unit: patch.unit ?? item.unit,
                  }
                : item,
            ),
          })),
        }));
        return true;
      },

      deleteProduct: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().products.some((product) => product.id === id)) return false;
        set((s) => {
          const sales = s.sales
            .map((sale) => {
              const items = sale.items.filter((item) => item.productId !== id);
              if (!items.length) return null;
              const subtotal = items.reduce((sum, item) => sum + item.quantity * item.salePrice, 0);
              const normalizedItems = items.map((item) => ({ ...item, total: item.quantity * item.salePrice }));
              const total = Math.max(0, subtotal - sale.discount);
              return {
                ...sale,
                items: normalizedItems,
                subtotal,
                total,
                paid: Math.min(sale.paid, total),
              };
            })
            .filter((sale): sale is Sale => sale !== null);
          const orders = s.orders
            .map((order) => {
              const items = order.items.filter((item) => item.productId !== id);
              if (!items.length) return null;
              const normalizedItems = items.map((item) => ({ ...item, total: item.quantity * item.salePrice }));
              return {
                ...order,
                items: normalizedItems,
                total: normalizedItems.reduce((sum, item) => sum + item.total, 0),
                updatedAt: new Date().toISOString(),
              };
            })
            .filter((order): order is Order => order !== null);
          return {
            products: s.products.filter((product) => product.id !== id),
            sales,
            purchases: s.purchases.filter((purchase) => purchase.productId !== id),
            adjustments: s.adjustments.filter((adjustment) => adjustment.productId !== id),
            orders,
          };
        });
        return true;
      },

      addSale: (input) => {
        const subtotal = input.items.reduce((a, i) => a + i.total, 0);
        const total = Math.max(0, subtotal - input.discount);
        const paid = Math.min(Math.max(0, input.paid), total);
        const billNo = reserveNumber("bill", input.date);
        const row: Sale = {
          id: billNo,
          billNo,
          date: input.date,
          items: input.items,
          subtotal,
          discount: input.discount,
          total,
          paid,
          customerId: input.customerId,
          customerName: input.customerName,
          createdBy: get().user?.name ?? "দোকান",
          note: input.note,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ sales: [row, ...s.sales] }));
        return row;
      },

      updateSale: (id, patch) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        const current = get().sales.find((sale) => sale.id === id);
        if (!current) return false;
        const rawItems = patch.items ?? current.items;
        const products = get().products;
        const items = rawItems.map((item) => {
          const product = products.find((row) => row.id === item.productId);
          const quantity = Math.max(0, item.quantity);
          const salePrice = Math.max(0, item.salePrice);
          return {
            ...item,
            productName: product?.name ?? item.productName,
            unit: product?.unit ?? item.unit,
            quantity,
            salePrice,
            total: quantity * salePrice,
          };
        });
        const discount = Math.max(0, patch.discount ?? current.discount);
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const total = Math.max(0, subtotal - discount);
        const paid = Math.min(Math.max(0, patch.paid ?? current.paid), total);
        const customerId = patch.customerId ?? current.customerId;
        const linkedCustomer = customerId ? get().customers.find((customer) => customer.id === customerId) : undefined;
        const customerName = linkedCustomer?.name ?? patch.customerName ?? current.customerName;
        set((s) => ({
          sales: s.sales.map((sale) =>
            sale.id === id
              ? {
                  ...sale,
                  ...patch,
                  id: sale.id,
                  createdAt: sale.createdAt,
                  billNo: sale.billNo,
                  items,
                  customerId,
                  customerName,
                  discount,
                  subtotal,
                  total,
                  paid,
                }
              : sale,
          ),
        }));
        return true;
      },

      deleteSale: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().sales.some((sale) => sale.id === id)) return false;
        set((s) => ({ sales: s.sales.filter((sale) => sale.id !== id) }));
        return true;
      },

      addPurchase: (input) => {
        const row: Purchase = { ...input, id: reserveNumber("purchase", input.date), createdAt: new Date().toISOString() };
        set((s) => ({ purchases: [row, ...s.purchases] }));
        return row;
      },

      updatePurchase: (id, patch) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        const current = get().purchases.find((purchase) => purchase.id === id);
        if (!current) return false;
        const productId = patch.productId ?? current.productId;
        const product = get().products.find((row) => row.id === productId);
        const quantity = Math.max(0, patch.quantity ?? current.quantity);
        const purchasePrice = Math.max(0, patch.purchasePrice ?? current.purchasePrice);
        const total = quantity * purchasePrice;
        const paid = Math.min(Math.max(0, patch.paid ?? current.paid), total);
        set((s) => ({
          purchases: s.purchases.map((purchase) =>
            purchase.id === id
              ? {
                  ...purchase,
                  ...patch,
                  id: purchase.id,
                  createdAt: purchase.createdAt,
                  productId,
                  productName: product?.name ?? patch.productName ?? current.productName,
                  unit: product?.unit ?? patch.unit ?? current.unit,
                  quantity,
                  purchasePrice,
                  total,
                  paid,
                }
              : purchase,
          ),
        }));
        return true;
      },

      deletePurchase: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().purchases.some((purchase) => purchase.id === id)) return false;
        set((s) => ({ purchases: s.purchases.filter((purchase) => purchase.id !== id) }));
        return true;
      },

      addExpense: (input) => {
        const row: Expense = { ...input, id: reserveNumber("expense", input.date), createdAt: new Date().toISOString() };
        set((s) => ({ expenses: [row, ...s.expenses] }));
        return row;
      },

      updateExpense: (id, patch) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().expenses.some((expense) => expense.id === id)) return false;
        set((s) => ({
          expenses: s.expenses.map((expense) =>
            expense.id === id
              ? { ...expense, ...patch, id: expense.id, createdAt: expense.createdAt, amount: Math.max(0, patch.amount ?? expense.amount) }
              : expense,
          ),
        }));
        return true;
      },

      deleteExpense: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().expenses.some((expense) => expense.id === id)) return false;
        set((s) => ({ expenses: s.expenses.filter((expense) => expense.id !== id) }));
        return true;
      },

      addCollection: (input) => {
        const row: Collection = {
          ...input,
          id: reserveNumber("collection", input.date),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ collections: [row, ...s.collections] }));
        return row;
      },

      updateCollection: (id, patch) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        const current = get().collections.find((collection) => collection.id === id);
        if (!current) return false;
        const partyId = patch.partyId ?? current.partyId;
        const kind = patch.kind ?? current.kind;
        const customer = kind === "customer" ? get().customers.find((row) => row.id === partyId) : undefined;
        set((s) => ({
          collections: s.collections.map((collection) =>
            collection.id === id
              ? {
                  ...collection,
                  ...patch,
                  id: collection.id,
                  createdAt: collection.createdAt,
                  partyId,
                  kind,
                  partyName: customer?.name ?? patch.partyName ?? current.partyName,
                  amount: Math.max(0, patch.amount ?? collection.amount),
                }
              : collection,
          ),
        }));
        return true;
      },

      deleteCollection: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().collections.some((collection) => collection.id === id)) return false;
        set((s) => ({ collections: s.collections.filter((collection) => collection.id !== id) }));
        return true;
      },

      addAdjustment: (input) => {
        const row: StockAdjustment = {
          ...input,
          id: reserveNumber("adjustment", input.date),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ adjustments: [row, ...s.adjustments] }));
      },

      updateAdjustment: (id, patch) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().adjustments.some((adjustment) => adjustment.id === id)) return false;
        const current = get().adjustments.find((adjustment) => adjustment.id === id);
        if (!current) return false;
        const productId = patch.productId ?? current.productId;
        const product = get().products.find((row) => row.id === productId);
        set((s) => ({
          adjustments: s.adjustments.map((adjustment) =>
            adjustment.id === id
              ? {
                  ...adjustment,
                  ...patch,
                  id: adjustment.id,
                  createdAt: adjustment.createdAt,
                  productId,
                  productName: product?.name ?? patch.productName ?? current.productName,
                  quantity: patch.quantity ?? current.quantity,
                }
              : adjustment,
          ),
        }));
        return true;
      },

      deleteAdjustment: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().adjustments.some((adjustment) => adjustment.id === id)) return false;
        set((s) => ({ adjustments: s.adjustments.filter((adjustment) => adjustment.id !== id) }));
        return true;
      },

      addOrder: (input) => {
        const now = new Date().toISOString();
        const row: Order = {
          ...input,
          id: reserveNumber("order"),
          status: "pending",
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ orders: [row, ...s.orders] }));
        return row;
      },

      updateOrder: (id, patch) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        const current = get().orders.find((order) => order.id === id);
        if (!current) return false;
        const products = get().products;
        const rawItems = patch.items ?? current.items;
        const items = rawItems.map((item) => {
          const product = products.find((row) => row.id === item.productId);
          const quantity = Math.max(0, item.quantity);
          const salePrice = Math.max(0, item.salePrice);
          return {
            ...item,
            productName: product?.name ?? item.productName,
            unit: product?.unit ?? item.unit,
            quantity,
            salePrice,
            total: quantity * salePrice,
          };
        });
        const customerId = patch.customerId ?? current.customerId;
        const linkedCustomer = get().customers.find((customer) => customer.id === customerId);
        set((s) => ({
          orders: s.orders.map((order) =>
            order.id === id
              ? {
                  ...order,
                  ...patch,
                  id: order.id,
                  createdAt: order.createdAt,
                  customerId,
                  customerName: linkedCustomer?.name ?? patch.customerName ?? current.customerName,
                  items,
                  total: items.reduce((sum, item) => sum + item.total, 0),
                  updatedAt: new Date().toISOString(),
                }
              : order,
          ),
        }));
        return true;
      },

      deleteOrder: (id) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        if (!get().orders.some((order) => order.id === id)) return false;
        set((s) => ({ orders: s.orders.filter((order) => order.id !== id) }));
        return true;
      },

      setOrderStatus: (id, status) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o,
          ),
        })),

      fulfillOrder: (id) => {
        const order = get().orders.find((o) => o.id === id);
        if (!order || order.status === "delivered" || order.status === "cancelled") return null;
        const items: SaleItem[] = order.items.map((i) => {
          const p = get().products.find((x) => x.id === i.productId);
          return {
            productId: i.productId,
            productName: i.productName,
            unit: i.unit,
            quantity: i.quantity,
            salePrice: i.salePrice,
            purchasePrice: p?.purchasePrice ?? 0,
            total: i.total,
          };
        });
        const sale = get().addSale({
          date: todayKey(),
          items,
          discount: 0,
          paid: 0,
          customerId: order.customerId,
          customerName: order.customerName,
          note: `অর্ডার ${order.id}`,
        });
        get().setOrderStatus(id, "delivered");
        return sale;
      },

      productStock: (id) => {
        const p = get().products.find((x) => x.id === id);
        if (!p) return 0;
        return stockOf(p, get().sales, get().purchases, get().adjustments);
      },

      dueOf: (customerId) => customerDue(customerId, get().sales, get().collections),
    }),
    {
      name: "karnaphuli-shopledger-v1",
      partialize: (s) => {
        const { hydrated, loginError, masterSession, ...rest } = s;
        void hydrated;
        void loginError;
        void masterSession;
        return rest as unknown as ShopState;
      },
      onRehydrateStorage: () => () => {
        const migrated = ensureAuthUsernames(useShop.getState());
        if (migrated) useShop.setState(migrated);
        useShop.setState({ hydrated: true });
        revalidatePersistedSession();
      },
    },
  ),
);

if (typeof window !== "undefined") {
  void useShop.persist.rehydrate();
  if (!useShop.persist.hasHydrated()) {
    const t = window.setTimeout(() => {
      if (!useShop.getState().hydrated) useShop.setState({ hydrated: true });
    }, 80);
    void t;
  } else {
    useShop.setState({ hydrated: true });
  }
}

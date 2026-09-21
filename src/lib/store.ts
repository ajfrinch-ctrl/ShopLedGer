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
  expectedPassword,
  isUsingDefaultPassword,
  MIN_PASSWORD_LENGTH,
  performPasswordReset,
  readPasswordOverrides,
  writePasswordOverrides,
} from "./password-reset";
import {
  DEFAULT_CUSTOMER_PASSWORD,
  DEFAULT_OWNER_PASSWORD,
  DEFAULT_STAFF_PASSWORD,
  OWNER_ACCOUNTS,
} from "./shop";
import type {
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
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  collections: Collection[];
  orders: Order[];
  adjustments: StockAdjustment[];
  numberSequences: NumberSequences;
  loginError: string;
  setHydrated: (v: boolean) => void;
  /** ok=true + mustChangePassword → ফ্যাক্টরি পাসওয়ার্ডে লগইন, পরিবর্তন না করা পর্যন্ত user সেট হয় না। */
  login: (phone: string, password: string) => Promise<{ ok: boolean; mustChangePassword: boolean }>;
  resetPassword: (identity: string, newPassword: string, confirm: string) => { ok: boolean; message: string };
  /** ফিঙ্গারপ্রিন্ট/পিন/ফেস (WebAuthn) verify হওয়ার পর পাসওয়ার্ড ছাড়া লগইন। */
  loginWithPasskey: (phone: string) => boolean;
  verifyMasterSession: () => Promise<void>;
  logout: () => void;
  submitCustomerRegistration: (input: {
    name: string;
    phone: string;
    address: string;
  }) => { ok: boolean; message: string };
  approveCustomerRegistration: (id: string) => boolean;
  rejectCustomerRegistration: (id: string) => boolean;
  addCustomer: (c: Omit<Customer, "id" | "createdAt">) => Customer;
  updateCustomer: (
    id: string,
    patch: Partial<Pick<Customer, "name" | "address" | "whatsappPhone" | "active">>,
  ) => boolean;
  deleteCustomer: (id: string) => boolean;
  /** মালিক-তৈরি কর্মচারীর অ্যাকাউন্ট — ডিফল্ট পাসওয়ার্ডসহ তৈরি হয়। */
  addStaff: (input: { name: string; phone: string; role: StaffRole }) => {
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

function reserveNumber(kind: keyof typeof RECORD_PREFIX, date = todayKey()): string {
  let number = "";
  useShop.setState((state) => {
    const existing = [
      ...state.customers, ...state.customerRequests, ...state.products,
      ...state.sales, ...state.purchases, ...state.collections,
      ...state.expenses, ...state.orders, ...state.adjustments,
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
 * Rehydrate-এর পর session যাচাই —
 * 1. সিস্টেম অ্যাডমিন: সার্ভার session verify (আগের মতো)।
 * 2. ক্রেতা: tied ক্রেটার record না থাকলে (মুছে ফেলা হতে পারে) session মুছে ফেল।
 * 3. মালিক: অ্যাকাউন্ট না থাকলে (পুরনো ডেমো session) বা ফ্যাক্টরি পাসওয়ার্ড
 *    এখনো চললে logout — আবার লগইনে পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক হবে।
 */
function revalidatePersistedSession(): void {
  const state = useShop.getState();
  const user = state.user;
  if (!user) return;
  if (user.role === "systemAdmin") {
    void state.verifyMasterSession();
    return;
  }
  if (user.role === "customer") {
    const customer = state.customers.find((c) => c.id === user.customerId);
    if (!customer || customer.active === false) {
      state.logout();
      return;
    }
    // মালিকের মতো — ডিফল্ট পাসওয়ার্ডে session চালু থাকতে পারবে না
    if (isUsingDefaultPassword(customer.id, DEFAULT_CUSTOMER_PASSWORD, readPasswordOverrides())) {
      state.logout();
    }
    return;
  }
  if (user.role === "manager" || user.role === "salesman") {
    // session id-তে staff-user-<id> — রেকর্ড মুছে গেলে বা অচালু হলে session বরাদ্দ
    const accountId = user.id.startsWith("staff-user-") ? user.id.slice("staff-user-".length) : "";
    const staff = state.staff.find((s) => s.id === accountId);
    if (!staff || staff.active === false) {
      state.logout();
      return;
    }
    if (isUsingDefaultPassword(staff.id, DEFAULT_STAFF_PASSWORD, readPasswordOverrides())) {
      state.logout();
    }
    return;
  }
  const acc = OWNER_ACCOUNTS.find((a) => a.id === user.id);
  if (!acc) {
    // পুরনো ডেমো অ্যাকাউন্ট (salesman/customer) — আর অ্যাকাউন্ট নেই
    state.logout();
    return;
  }
  if (isUsingDefaultPassword(acc.id, DEFAULT_OWNER_PASSWORD, readPasswordOverrides())) {
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
      sales: [],
      purchases: [],
      expenses: [],
      collections: [],
      orders: [],
      adjustments: [],
      numberSequences: {},

      setHydrated: (v) => set({ hydrated: v }),

      login: async (phone, password) => {
        const identity = phone.trim();
        const normalized = normalizePhone(identity);
        const overrides = readPasswordOverrides();
        // মালিকের নম্বর — ডেমো অ্যাকাউন্ট আর নেই
        const acc = OWNER_ACCOUNTS.find(
          (a) => normalizePhone(a.phone) === normalized || a.name === identity,
        );
        if (acc) {
          // রিসেট/পরিবর্তন করা থাকলে সেটি (এই ডিভাইসে সেভ), নাহলে ফ্যাক্টরি পাসওয়ার্ড
          if (expectedPassword(acc.id, DEFAULT_OWNER_PASSWORD, overrides) !== password) {
            set({ loginError: "আইডি বা পাসওয়ার্ড ভুল হয়েছে" });
            return { ok: false, mustChangePassword: false };
          }
          // প্রথম লগইন: ফ্যাক্টরি পাসওয়ার্ড থাকলে প্রথমেই পরিবর্তন করতে হবে —
          // পর্যন্ত user সেট করব না, যেন লগইন পেজ থেকে সরাসরি অ্যাপে ঢুকতে না পাওয়া যায়
          const mustChangePassword = isUsingDefaultPassword(acc.id, DEFAULT_OWNER_PASSWORD, overrides);
          if (mustChangePassword) {
            set({ loginError: "" });
            return { ok: true, mustChangePassword: true };
          }
          const user: SessionUser = {
            id: acc.id,
            name: acc.name,
            phone: acc.phone,
            role: "owner",
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return { ok: true, mustChangePassword: false };
        }

        // কর্মচারী — মালিক তৈরি, চালু থাকা; ডিফল্ট পাসওয়ার্ড ১২৩৪৫৬
        const staff = get().staff.find((s) => normalizePhone(s.phone) === normalized);
        if (staff) {
          if (staff.active === false) {
            set({ loginError: "এই কর্মচারীর অ্যাকাউন্ট অচালু — মালিকের সঙ্গে যোগাযোগ করুন" });
            return { ok: false, mustChangePassword: false };
          }
          if (expectedPassword(staff.id, DEFAULT_STAFF_PASSWORD, overrides) !== password) {
            set({ loginError: "নম্বর বা পাসওয়ার্ড ভুল হয়েছে" });
            return { ok: false, mustChangePassword: false };
          }
          const mustChangePassword = isUsingDefaultPassword(
            staff.id,
            DEFAULT_STAFF_PASSWORD,
            overrides,
          );
          if (mustChangePassword) {
            set({ loginError: "" });
            return { ok: true, mustChangePassword: true };
          }
          const user: SessionUser = {
            id: `staff-user-${staff.id}`,
            name: staff.name,
            phone: staff.phone,
            role: staff.role,
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return { ok: true, mustChangePassword: false };
        }

        // ক্রেতা — মালিক তৈরি/অনুমোদিত, চালু থাকা; ডিফল্ট পাসওয়ার্ড ১২৩৪৫৬
        const customer = get().customers.find((c) => normalizePhone(c.phone) === normalized);
        if (customer) {
          if (customer.active === false) {
            set({ loginError: "এই ক্রেতার অ্যাকাউন্ট অচালু — দোকানের সঙ্গে যোগাযোগ করুন" });
            return { ok: false, mustChangePassword: false };
          }
          if (expectedPassword(customer.id, DEFAULT_CUSTOMER_PASSWORD, overrides) !== password) {
            set({ loginError: "নম্বর বা পাসওয়ার্ড ভুল হয়েছে" });
            return { ok: false, mustChangePassword: false };
          }
          // মালিকের মতো — ডিফল্ট পাসওয়ার্ডে প্রথম লগইনে পরিবর্তন বাধ্যতামূলক
          const mustChangePassword = isUsingDefaultPassword(
            customer.id,
            DEFAULT_CUSTOMER_PASSWORD,
            overrides,
          );
          if (mustChangePassword) {
            set({ loginError: "" });
            return { ok: true, mustChangePassword: true };
          }
          const user: SessionUser = {
            id: `customer-user-${customer.id}`,
            name: customer.name,
            phone: customer.phone,
            role: "customer",
            customerId: customer.id,
          };
          set({ user, masterSession: "not-required", loginError: "" });
          return { ok: true, mustChangePassword: false };
        }

        try {
          const master = await loginMasterSystemAdmin({ data: { phone, password } });
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
        // মালিক + কর্মচারী + সব ক্রেতা — ফ্যাক্টরি পাসওয়ার্ডসহ pure ফাংশনে পাঠানো হয়
        const accounts = [
          ...OWNER_ACCOUNTS.map((a) => ({ ...a, password: DEFAULT_OWNER_PASSWORD })),
          ...get().staff.map((s) => ({
            id: s.id,
            name: s.name,
            phone: s.phone,
            password: DEFAULT_STAFF_PASSWORD,
          })),
          ...get().customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            password: DEFAULT_CUSTOMER_PASSWORD,
          })),
        ];
        const result = performPasswordReset({
          accounts,
          identity,
          newPassword,
          confirm,
          overrides: readPasswordOverrides(),
        });
        if (!result.ok) {
          return { ok: false, message: result.message };
        }
        // আলাদা কীতে সেভ — ডেমো রিসেট/ডাটা ব্যাকআপে এটি জড়িয়ে পড়ে না
        writePasswordOverrides(result.overrides);
        return {
          ok: true,
          message: "নতুন পাসওয়ার্ড সেট হয়েছে — এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন",
        };
      },

      loginWithPasskey: (phone) => {
        // পাসওয়ার্ড চেক না — WebAuthn signature আগে verify হয়েছে (src/lib/passkey.ts)
        const identity = normalizePhone(phone);
        const acc = OWNER_ACCOUNTS.find(
          (a) => normalizePhone(a.phone) === identity || a.name === phone.trim(),
        );
        if (!acc) {
          set({ loginError: "এই নম্বরের কোনো অ্যাকাউন্ট পাওয়া যায়নি" });
          return false;
        }
        const user: SessionUser = {
          id: acc.id,
          name: acc.name,
          phone: acc.phone,
          role: "owner",
        };
        set({ user, masterSession: "not-required", loginError: "" });
        return true;
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
          phone,
          address,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ customerRequests: [row, ...s.customerRequests] }));
        return {
          ok: true,
          message: "রেজিস্ট্রেশন পাঠানো হয়েছে। মালিক অনুমোদন করলে ডিফল্ট পাসওয়ার্ড ১২৩৪৫৬ দিয়ে প্রবেশ করতে পারবেন",
        };
      },

      approveCustomerRegistration: (id) => {
        const request = get().customerRequests.find(
          (r) => r.id === id && r.status === "pending",
        );
        if (!request) return false;
        const phone = normalizePhone(request.phone);
        const existing = get().customers.find((c) => normalizePhone(c.phone) === phone);
        const customer =
          existing ??
          ({
            id: reserveNumber("customer"),
            name: request.name,
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
        return true;
      },

      addCustomer: (c) => {
        const input = customerInput(c, get().customers);
        const row: Customer = { ...input, id: reserveNumber("customer"), createdAt: todayKey() };
        set((s) => ({ customers: [row, ...s.customers] }));
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
        // লগইন নম্বর একটাই — একই নম্বরে অন্য কোনো অ্যাকাউন্ট থাকলে লগইনে অমিল হবে
        const taken =
          OWNER_ACCOUNTS.some((a) => normalizePhone(a.phone) === phone) ||
          get().staff.some((s) => normalizePhone(s.phone) === phone) ||
          get().customers.some((c) => normalizePhone(c.phone) === phone);
        if (taken) return { ok: false, message: "এই মোবাইল নম্বরের একাউন্ট আগে থেকেই আছে" };
        const row: StaffAccount = {
          id: reserveNumber("staff"),
          name,
          phone,
          role: input.role,
          active: true,
          createdAt: todayKey(),
        };
        set((s) => ({ staff: [row, ...s.staff] }));
        return {
          ok: true,
          message: "কর্মচারী যোগ হয়েছে — প্রথম লগইনে ডিফল্ট পাসওয়ার্ড ১২৩৪৫৬, তারপর নিজের পাসওয়ার্ড সেট করবে",
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
        if (newPassword === expectedPassword(current.id, DEFAULT_STAFF_PASSWORD, overrides)) {
          return { ok: false, message: "নতুন পাসওয়ার্ডটা পুরনোর মতো হতে পারে না" };
        }
        writePasswordOverrides({ ...overrides, [current.id]: newPassword });
        return { ok: true, message: "কর্মচারীর পাসওয়ার্ড পরিবর্তিত হয়েছে" };
      },

      updateCustomerRegistration: (id, patch) => {
        if (!isSystemAdmin(get().user?.role)) return false;
        const current = get().customerRequests.find((request) => request.id === id);
        if (!current) return false;
        // Also reject runtime payloads bypassing TypeScript (including admin edits).
        const immutable = patch as Partial<CustomerRegistration>;
        if ((immutable.phone !== undefined && normalizePhone(immutable.phone) !== normalizePhone(current.phone)) ||
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

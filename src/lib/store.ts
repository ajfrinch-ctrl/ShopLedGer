import { create } from "zustand";
import { persist } from "zustand/middleware";
import { customerDue, stockOf } from "./calc";
import { nid, todayKey, bnNum } from "./format";
import { createSeed } from "./seed";
import { DEMO_ACCOUNTS } from "./shop";
import { normPhone } from "./passkey";
import type {
  Collection,
  Customer,
  Expense,
  Order,
  Product,
  Purchase,
  Sale,
  SaleItem,
  SessionUser,
  StockAdjustment,
} from "./types";

export function canManage(role?: SessionUser["role"]) {
  return role === "owner" || role === "manager";
}

export function canSeeProfit(role?: SessionUser["role"]) {
  return role === "owner" || role === "manager";
}

export function roleLabel(role?: SessionUser["role"]) {
  switch (role) {
    case "owner":
      return "মালিক";
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

interface ShopState {
  hydrated: boolean;
  user: SessionUser | null;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  collections: Collection[];
  orders: Order[];
  adjustments: StockAdjustment[];
  billSeq: number;
  loginError: string;
  setHydrated: (v: boolean) => void;
  login: (phone: string, password: string) => boolean;
  /** ফিঙ্গারপ্রিন্ট/ফেস (WebAuthn) verify হওয়ার পর পাসওয়ার্ড ছাড়া লগইন। */
  loginWithPasskey: (phone: string) => boolean;
  logout: () => void;
  resetDemo: () => void;
  addCustomer: (c: Omit<Customer, "id" | "createdAt">) => Customer;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  addProduct: (p: Omit<Product, "id" | "createdAt">) => Product;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  addSale: (input: {
    date: string;
    items: SaleItem[];
    discount: number;
    paid: number;
    customerId?: string;
    customerName: string;
    note?: string;
  }) => Sale;
  addPurchase: (input: Omit<Purchase, "id" | "createdAt">) => Purchase;
  addExpense: (input: Omit<Expense, "id" | "createdAt">) => Expense;
  addCollection: (input: Omit<Collection, "id" | "createdAt">) => Collection;
  addAdjustment: (input: Omit<StockAdjustment, "id" | "createdAt">) => void;
  addOrder: (input: Omit<Order, "id" | "createdAt" | "updatedAt" | "status">) => Order;
  setOrderStatus: (id: string, status: Order["status"]) => void;
  fulfillOrder: (id: string) => Sale | null;
  productStock: (id: string) => number;
  dueOf: (customerId: string) => number;
}

const seed = createSeed();

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      user: null,
      loginError: "",
      products: seed.products,
      customers: seed.customers,
      sales: seed.sales,
      purchases: seed.purchases,
      expenses: seed.expenses,
      collections: seed.collections,
      orders: seed.orders,
      adjustments: seed.adjustments,
      billSeq: seed.billSeq,

      setHydrated: (v) => set({ hydrated: v }),

      login: (phone, password) => {
        const identity = phone.trim();
        const acc = DEMO_ACCOUNTS.find(
          (a) => a.phone === identity || a.name === identity,
        );
        if (!acc || acc.password !== password) {
          set({ loginError: "আইডি বা পাসওয়ার্ড ভুল হয়েছে" });
          return false;
        }
        const user: SessionUser = {
          id: acc.id,
          name: acc.name,
          phone: acc.phone,
          role: acc.role,
          customerId: "customerId" in acc ? acc.customerId : undefined,
        };
        set({ user, loginError: "" });
        return true;
      },

      loginWithPasskey: (phone) => {
        // পাসওয়ার্ড চেক না — WebAuthn signature আগে verify হয়েছে (src/lib/passkey.ts)
        const identity = normPhone(phone);
        const acc = DEMO_ACCOUNTS.find((a) => normPhone(a.phone) === identity);
        if (!acc) {
          set({ loginError: "এই নম্বরের কোনো অ্যাকাউন্ট পাওয়া যায়নি" });
          return false;
        }
        const user: SessionUser = {
          id: acc.id,
          name: acc.name,
          phone: acc.phone,
          role: acc.role,
          customerId: "customerId" in acc ? acc.customerId : undefined,
        };
        set({ user, loginError: "" });
        return true;
      },

      logout: () => set({ user: null, loginError: "" }),

      resetDemo: () => {
        const next = createSeed();
        set({
          products: next.products,
          customers: next.customers,
          sales: next.sales,
          purchases: next.purchases,
          expenses: next.expenses,
          collections: next.collections,
          orders: next.orders,
          adjustments: next.adjustments,
          billSeq: next.billSeq,
        });
      },

      addCustomer: (c) => {
        const row: Customer = { ...c, id: nid("c"), createdAt: todayKey() };
        set((s) => ({ customers: [row, ...s.customers] }));
        return row;
      },

      updateCustomer: (id, patch) =>
        set((s) => ({
          customers: s.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      addProduct: (p) => {
        const row: Product = { ...p, id: nid("p"), createdAt: todayKey() };
        set((s) => ({ products: [row, ...s.products] }));
        return row;
      },

      updateProduct: (id, patch) =>
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      addSale: (input) => {
        const subtotal = input.items.reduce((a, i) => a + i.total, 0);
        const total = Math.max(0, subtotal - input.discount);
        const paid = Math.min(Math.max(0, input.paid), total);
        const billNo = `বিল-${bnNum(get().billSeq)}`;
        const row: Sale = {
          id: nid("s"),
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
        set((s) => ({ sales: [row, ...s.sales], billSeq: s.billSeq + 1 }));
        return row;
      },

      addPurchase: (input) => {
        const row: Purchase = { ...input, id: nid("pu"), createdAt: new Date().toISOString() };
        set((s) => ({ purchases: [row, ...s.purchases] }));
        return row;
      },

      addExpense: (input) => {
        const row: Expense = { ...input, id: nid("e"), createdAt: new Date().toISOString() };
        set((s) => ({ expenses: [row, ...s.expenses] }));
        return row;
      },

      addCollection: (input) => {
        const row: Collection = {
          ...input,
          id: nid("col"),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ collections: [row, ...s.collections] }));
        return row;
      },

      addAdjustment: (input) => {
        const row: StockAdjustment = {
          ...input,
          id: nid("adj"),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ adjustments: [row, ...s.adjustments] }));
      },

      addOrder: (input) => {
        const now = new Date().toISOString();
        const row: Order = {
          ...input,
          id: nid("o"),
          status: "pending",
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ orders: [row, ...s.orders] }));
        return row;
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
          note: `অর্ডার ${order.id.slice(-4)}`,
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
        const { hydrated, loginError, ...rest } = s;
        void hydrated;
        void loginError;
        return rest as unknown as ShopState;
      },
      onRehydrateStorage: () => () => {
        useShop.setState({ hydrated: true });
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

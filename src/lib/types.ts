export type UserRole = "owner" | "manager" | "salesman" | "customer" | "systemAdmin";

export interface SessionUser {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  customerId?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  company: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  openingStock: number;
  minStock: number;
  createdAt: string;
}

export interface Customer {
  readonly id: string;
  name: string;
  /** Permanent transaction/login identity. */
  readonly phone: string;
  whatsappPhone?: string;
  address: string;
  createdAt: string;
  /** মালিক অচালু করলে আর লগইন করতে পারবে না (নির্ধারিত না থাকলে চালু)। */
  active?: boolean;
}

export type CustomerRegistrationStatus = "pending" | "approved" | "rejected";

/** মালিকের তৈরি দোকানের কর্মচারীর ভূমিকা। */
export type StaffRole = "manager" | "salesman";

/**
 * মালিক-তৈরি কর্মচারীর লগইন অ্যাকাউন্ট। নম্বরই মূল পরিচয় — একই নম্বরে
 * মালিক/ক্রেতা/অন্য কর্মচারী থাকলে তৈরি করা যায় না, তাই লগইনে অমিল সম্ভব নয়।
 */
export interface StaffAccount {
  readonly id: string;
  name: string;
  /** মূল মোবাইল — পরিবর্তনযোগ্য নয়। */
  readonly phone: string;
  role: StaffRole;
  /** অচালু করলে আর লগইন করতে পারবে না (নির্ধারিত না থাকলে চালু)। */
  active: boolean;
  createdAt: string;
}

export interface CustomerRegistration {
  id: string;
  name: string;
  phone: string;
  address: string;
  status: CustomerRegistrationStatus;
  createdAt: string;
  reviewedAt?: string;
  customerId?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  salePrice: number;
  purchasePrice: number;
  total: number;
}

export interface Sale {
  id: string;
  billNo: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  customerId?: string;
  customerName: string;
  createdBy: string;
  note?: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  total: number;
  supplier: string;
  paid: number;
  createdAt: string;
}

export interface Collection {
  id: string;
  date: string;
  partyId: string;
  partyName: string;
  kind: "customer" | "supplier";
  amount: number;
  method: string;
  note?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  kind: "shop" | "owner";
  note?: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  note?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  salePrice: number;
  total: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "accepted" | "delivered" | "cancelled";
  note?: string;
  createdAt: string;
  updatedAt: string;
}

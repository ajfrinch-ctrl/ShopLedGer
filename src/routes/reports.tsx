import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { DocumentActions } from "@/components/document-actions";
import type { PdfColumn } from "@/lib/reports/pdf-layout";
import type { PdfDocument } from "@/lib/reports/pdf";
import { useMemo, useState, type ComponentType } from "react";
import { AppShell, RequireAuth } from "@/components/app-shell";
import { allCustomerDues, profitSummary, stockOf } from "@/lib/calc";
import { bnDate, bnNum, money, monthStartKey, todayKey } from "@/lib/format";
import { SHOP } from "@/lib/shop";
import { STATEMENT_FOOTER } from "@/lib/reports/document-text";
import { canSeeProfit, useShop } from "@/lib/store";

export const Route = createFileRoute("/reports")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <ReportsPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Kind =
  | "sales"
  | "purchase"
  | "stock"
  | "customerDue"
  | "collection"
  | "expense"
  | "dailyProfit"
  | "monthlyProfit"
  | "product"
  | "transaction";

const CATALOG: { kind: Kind; label: string; desc: string; icon: ComponentType<{ size?: number }>; manage?: boolean }[] = [
  { kind: "sales", label: "বিক্রয় রিপোর্ট", desc: "তারিখ অনুয়ায়ী বিল", icon: TrendingUp },
  { kind: "purchase", label: "ক্রয় রিপোর্ট", desc: "সাপ্লায়ার চালান", icon: ShoppingBag, manage: true },
  { kind: "stock", label: "স্টক রিপোর্ট", desc: "বর্তমান মজুদ", icon: Boxes },
  { kind: "customerDue", label: "ক্রেতার বাকি", desc: "পাওনার তালিকা", icon: Users },
  { kind: "collection", label: "আদায় রিপোর্ট", desc: "বাকি আদায়", icon: Wallet },
  { kind: "expense", label: "খরচ রিপোর্ট", desc: "দোকান খরচ", icon: Receipt, manage: true },
  { kind: "dailyProfit", label: "দৈনিক লাভ", desc: "আজকের নিট", icon: CalendarDays, manage: true },
  { kind: "monthlyProfit", label: "মাসিক লাভ", desc: "চলতি মাস", icon: CalendarRange, manage: true },
  { kind: "product", label: "পণ্য রিপোর্ট", desc: "বিক্রি অনুয়ায়ী", icon: Package },
  { kind: "transaction", label: "লেনদেন", desc: "সব এন্ট্রি", icon: ClipboardList },
];

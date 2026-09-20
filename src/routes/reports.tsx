import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Download,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { useMemo, useState, type ComponentType } from "react";
import { AppShell, RequireAuth } from "@/components/app-shell";
import { allCustomerDues, profitSummary, stockOf } from "@/lib/calc";
import { bnDate, bnNum, money, monthStartKey, todayKey } from "@/lib/format";
import { SHOP } from "@/lib/shop";
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
  { kind: "sales", label: "বিক্রয় রিপোর্ট", desc: "তারিখ অনুযায়ী বিল", icon: TrendingUp },
  { kind: "purchase", label: "ক্রয় রিপোর্ট", desc: "সাপ্লায়ার চালান", icon: ShoppingBag, manage: true },
  { kind: "stock", label: "স্টক রিপোর্ট", desc: "বর্তমান মজুদ", icon: Boxes },
  { kind: "customerDue", label: "ক্রেতার বাকি", desc: "পাওনার তালিকা", icon: Users },
  { kind: "collection", label: "আদায় রিপোর্ট", desc: "বাকি আদায়", icon: Wallet },
  { kind: "expense", label: "খরচ রিপোর্ট", desc: "দোকান খরচ", icon: Receipt, manage: true },
  { kind: "dailyProfit", label: "দৈনিক লাভ", desc: "আজকের নিট", icon: CalendarDays, manage: true },
  { kind: "monthlyProfit", label: "মাসিক লাভ", desc: "চলতি মাস", icon: CalendarRange, manage: true },
  { kind: "product", label: "পণ্য রিপোর্ট", desc: "বিক্রি অনুযায়ী", icon: Package },
  { kind: "transaction", label: "লেনদেন", desc: "সব এন্ট্রি", icon: ClipboardList },
];

function ReportsPage() {
  const user = useShop((s) => s.user);
  const profit = canSeeProfit(user?.role);
  const visible = CATALOG.filter((c) => !c.manage || profit);
  const [kind, setKind] = useState<Kind | null>(null);
  const [from, setFrom] = useState(monthStartKey());
  const [to, setTo] = useState(todayKey());

  return (
    <div className="pb-8">
      <div className="bg-primary px-4 pt-4 pb-6 text-card">
        <h1 className="text-lg font-bold">রিপোর্ট সেন্টার</h1>
        <p className="mt-1 text-xs text-mint-2">বিষয় বাছুন → সময়সীমা দিন → স্টেটমেন্ট দেখুন</p>
      </div>
      <div className="space-y-2 px-4 -mt-3">
        {visible.map((def) => {
          const Icon = def.icon;
          return (
            <button
              key={def.kind}
              type="button"
              onClick={() => setKind(def.kind)}
              className="flex w-full items-center gap-3 rounded-lg border border-line bg-card p-4 text-left shadow-sm"
            >
              <span className="rounded-md bg-mint-2 p-2.5 text-primary">
                <Icon size={20} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{def.label}</span>
                <span className="block text-[11px] text-muted">{def.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      {kind ? (
        <Statement kind={kind} from={from} to={to} setFrom={setFrom} setTo={setTo} onClose={() => setKind(null)} />
      ) : null}
    </div>
  );
}

function Statement({
  kind,
  from,
  to,
  setFrom,
  setTo,
  onClose,
}: {
  kind: Kind;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  onClose: () => void;
}) {
  const def = CATALOG.find((c) => c.kind === kind)!;
  const sales = useShop((s) => s.sales);
  const purchases = useShop((s) => s.purchases);
  const expenses = useShop((s) => s.expenses);
  const collections = useShop((s) => s.collections);
  const products = useShop((s) => s.products);
  const customers = useShop((s) => s.customers);
  const adjustments = useShop((s) => s.adjustments);

  const rows = useMemo(() => {
    const inR = (d: string) => d >= from && d <= to;
    if (kind === "sales") {
      return sales
        .filter((s) => inR(s.date))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((s) => [bnDate(s.date), s.customerName, money(s.total)]);
    }
    if (kind === "purchase") {
      return purchases
        .filter((p) => inR(p.date))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((p) => [bnDate(p.date), p.supplier, money(p.total)]);
    }
    if (kind === "stock") {
      return products.map((p) => {
        const q = stockOf(p, sales, purchases, adjustments);
        return [p.name, `${bnNum(q)} ${p.unit}`, money(q * p.purchasePrice)];
      });
    }
    if (kind === "customerDue") {
      return allCustomerDues(customers, sales, collections).map((d) => [d.customer.name, d.customer.phone, money(d.due)]);
    }
    if (kind === "collection") {
      return collections
        .filter((c) => inR(c.date))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((c) => [bnDate(c.date), c.partyName, money(c.amount)]);
    }
    if (kind === "expense") {
      return expenses
        .filter((e) => inR(e.date))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => [bnDate(e.date), e.category, money(e.amount)]);
    }
    if (kind === "product") {
      const map = new Map<string, number>();
      for (const s of sales.filter((x) => inR(x.date))) {
        for (const i of s.items) map.set(i.productName, (map.get(i.productName) ?? 0) + i.total);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([n, t]) => [n, "", money(t)]);
    }
    if (kind === "transaction") {
      const t: string[][] = [];
      for (const s of sales.filter((x) => inR(x.date))) t.push([s.date, `বিক্রি • ${s.customerName}`, money(s.total)]);
      for (const p of purchases.filter((x) => inR(x.date))) t.push([p.date, `ক্রয় • ${p.supplier}`, money(p.total)]);
      for (const e of expenses.filter((x) => inR(x.date))) t.push([e.date, `খরচ • ${e.category}`, money(e.amount)]);
      return t.sort((a, b) => (a[0] < b[0] ? 1 : -1)).map((r) => [bnDate(r[0]), r[1], r[2]]);
    }
    return [];
  }, [kind, from, to, sales, purchases, expenses, collections, products, customers, adjustments]);

  const pl = profitSummary(sales, expenses, kind === "dailyProfit" ? todayKey() : from, kind === "dailyProfit" ? todayKey() : to);

  const downloadPdf = () => {
    const doc = new jsPDF();
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
    doc.setFontSize(16);
    doc.text(SHOP.name, 14, 18);
    doc.setFontSize(12);
    doc.text(def.label, 14, 28);
    doc.setFontSize(9);
    doc.text(`Period: ${from} to ${to}`, 14, 36);
    let y = 48;
    if (kind === "dailyProfit" || kind === "monthlyProfit") {
      for (const [label, value] of [["Sales", money(pl.revenue)], ["Cost", money(pl.cogs)], ["Gross profit", money(pl.gross)], ["Expenses", money(pl.shopExp)], ["Net profit", money(pl.net)]]) {
        doc.text(`${label}: ${value}`, 14, y);
        y += 8;
      }
    } else {
      rows.forEach((row) => {
        doc.text(`${row[0] ?? ""}    ${row[1] ?? ""}    ${row[2] ?? ""}`, 14, y, { maxWidth: 180 });
        y += 7;
        if (y > 280) { doc.addPage(); y = 18; }
      });
    }
    doc.save(`${def.label}-${stamp}.pdf`);
  };

  return (
    <div className="report-overlay fixed inset-0 z-40 flex items-end justify-center bg-fg/50 p-3 sm:items-center" onClick={onClose}>
      <div className="report-sheet flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h2 className="font-bold text-primary-dark">{def.label}</h2>
            <p className="text-xs text-muted">প্রিভিউ — চাইলে শেয়ার করুন</p>
          </div>
          <button type="button" aria-label="বন্ধ" onClick={onClose} className="print:hidden">
            <X size={18} />
          </button>
        </div>
        {kind !== "stock" && kind !== "customerDue" && kind !== "dailyProfit" ? (
          <div className="grid grid-cols-2 gap-2 border-b border-line p-3">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-line px-2 py-2 text-xs" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-line px-2 py-2 text-xs" />
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto p-4 text-center">
          <img src={SHOP.logo} alt="" className="mx-auto mb-2 size-12 rounded-full object-cover" />
          <p className="text-sm font-bold">{SHOP.name}</p>
          <p className="text-[11px] text-muted">{SHOP.address}</p>
          <p className="mt-2 text-sm font-semibold">{def.label}</p>
          {kind === "dailyProfit" || kind === "monthlyProfit" ? (
            <div className="mt-4 space-y-2 text-left text-sm">
              <Line k="বিক্রি" v={money(pl.revenue)} />
              <Line k="কস্ট" v={money(pl.cogs)} />
              <Line k="গ্রস লাভ" v={money(pl.gross)} />
              <Line k="খরচ" v={money(pl.shopExp)} />
              <Line k="নিট লাভ" v={money(pl.net)} bold />
            </div>
          ) : (
            <table className="mt-3 w-full text-left text-xs">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-1.5 pr-2">{r[0]}</td>
                    <td className="py-1.5 text-muted">{r[1]}</td>
                    <td className="py-1.5 text-right font-semibold tabular">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!rows.length && kind !== "dailyProfit" && kind !== "monthlyProfit" ? (
            <p className="py-6 text-sm text-muted">এই সময়ে কোনো ডাটা নেই</p>
          ) : null}
          <button
            type="button"
            onClick={downloadPdf}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-card print:hidden"
          >
            <Download size={17} />
            PDF ডাউনলোড করুন
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-primary" : ""}`}>
      <span>{k}</span>
      <span className="tabular">{v}</span>
    </div>
  );
}

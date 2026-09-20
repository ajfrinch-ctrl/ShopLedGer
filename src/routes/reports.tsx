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
  const visible = CATALOG.filter(
    (c) =>
      (!c.manage || profit) &&
      (user?.role !== "salesman" || c.kind === "sales" || c.kind === "stock"),
  );
  const [kind, setKind] = useState<Kind | null>(null);
  const [from, setFrom] = useState(monthStartKey());
  const [to, setTo] = useState(todayKey());

  return (
    <div className="pb-8">
      <div className="bg-primary px-4 pt-4 pb-6 text-card">
        <h1 className="text-heading font-bold">রিপোর্ট সেন্টার</h1>
        <p className="mt-1 text-caption text-mint-2">বিষয় বাছুন → সময়সীমা দিন → স্টেটমেন্ট দেখুন</p>
      </div>
      <div className="space-y-2 px-4 -mt-3">
        {visible.map((def) => {
          const Icon = def.icon;
          return (
            <button
              key={def.kind}
              type="button"
              onClick={() => {
                setKind(def.kind);
                if (def.kind === "sales") {
                  const today = todayKey();
                  setFrom(today);
                  setTo(today);
                }
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-line bg-card p-4 text-left shadow-sm"
            >
              <span className="rounded-md bg-mint-2 p-2.5 text-primary">
                <Icon size={20} />
              </span>
              <span className="flex-1">
                <span className="block text-body font-normal">{def.label}</span>
                <span className="block text-caption text-muted">{def.desc}</span>
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
        .map((s) => [
          bnDate(s.date),
          s.customerName,
          s.items.map((i) => `${i.productName} × ${bnNum(i.quantity)} ${i.unit}`).join(", "),
          money(s.total),
        ]);
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
        const sold = sales.reduce(
          (sum, s) => sum + s.items.filter((i) => i.productId === p.id).reduce((total, i) => total + i.quantity, 0),
          0,
        );
        return [p.id, p.name, `শুরু: ${bnNum(p.openingStock)} ${p.unit}`, `বিক্রি: ${bnNum(sold)} ${p.unit}`, `আছে: ${bnNum(q)} ${p.unit}`];
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
  const monthlyRows = useMemo(() => {
    const dates = new Set([
      ...sales.filter((s) => s.date >= from && s.date <= to).map((s) => s.date),
      ...expenses.filter((e) => e.date >= from && e.date <= to && e.kind === "shop").map((e) => e.date),
    ]);
    return [...dates].sort((a, b) => b.localeCompare(a)).map((date) => {
      const daySales = sales.filter((s) => s.date === date);
      const revenue = daySales.reduce((sum, s) => sum + s.total, 0);
      const cogs = daySales.reduce((sum, s) => sum + s.items.reduce((n, i) => n + i.purchasePrice * i.quantity, 0), 0);
      const expense = expenses.filter((e) => e.date === date && e.kind === "shop").reduce((sum, e) => sum + e.amount, 0);
      return { date, revenue, cogs, expense, net: revenue - cogs - expense };
    });
  }, [from, to, sales, expenses]);

  const periodFrom = kind === "dailyProfit" ? todayKey() : from;
  const periodTo = kind === "dailyProfit" ? todayKey() : to;
  const period = kind === "stock" || kind === "customerDue"
    ? `বর্তমান অবস্থা • ${bnDate(todayKey())}`
    : `${bnDate(periodFrom)} — ${bnDate(periodTo)}`;
  const headers: Partial<Record<Kind, string[]>> = {
    sales: ["তারিখ", "ক্রেতা", "পণ্য ও পরিমাণ", "মোট"],
    purchase: ["তারিখ", "সাপ্লায়ার", "মোট"],
    stock: ["আইডি", "পণ্য", "শুরুর মজুদ", "বিক্রি", "বর্তমান মজুদ"],
    customerDue: ["ক্রেতা", "মোবাইল", "বাকি"],
    collection: ["তারিখ", "নাম", "আদায়"],
    expense: ["তারিখ", "খাত", "খরচ"],
    product: ["পণ্য", "বিবরণ", "বিক্রি"],
    transaction: ["তারিখ", "বিবরণ", "টাকা"],
  };
  const columns: Partial<Record<Kind, PdfColumn[]>> = {
    sales: [{ kind: "date" }, { kind: "text" }, { kind: "text", minWidth: 140, weight: 5 }, { kind: "money" }],
    purchase: [{ kind: "date" }, { kind: "text" }, { kind: "money" }],
    stock: [{ kind: "id" }, { kind: "text", minWidth: 125, weight: 5 }, { kind: "quantity" }, { kind: "quantity" }, { kind: "quantity" }],
    customerDue: [{ kind: "text" }, { kind: "phone" }, { kind: "money" }],
    collection: [{ kind: "date" }, { kind: "text" }, { kind: "money" }],
    expense: [{ kind: "date" }, { kind: "text" }, { kind: "money" }],
    product: [{ kind: "text", weight: 5 }, { kind: "text" }, { kind: "money" }],
    transaction: [{ kind: "date" }, { kind: "text" }, { kind: "money" }],
  };
  const profitReport = kind === "dailyProfit" || kind === "monthlyProfit";
  const detailRows = [
    ...sales.filter((s) => s.date >= periodFrom && s.date <= periodTo).map((s) => [
      bnDate(s.date), `বিক্রি • ${s.customerName}`,
      money(s.total - s.items.reduce((sum, i) => sum + i.purchasePrice * i.quantity, 0)),
    ]),
    ...expenses.filter((e) => e.date >= periodFrom && e.date <= periodTo && e.kind === "shop").map((e) => [
      bnDate(e.date), `খরচ • ${e.category}`, money(-e.amount),
    ]),
  ];
  const document: PdfDocument = {
    title: def.label,
    subtitle: period,
    filename: `${kind}-${periodFrom}-${periodTo}.pdf`,
    sections: profitReport ? [
      { headers: ["বিবরণ", "টাকা"], emphasisRows: [4], columns: [{ kind: "text" }, { kind: "money" }], rows: [
        ["বেচা", money(pl.revenue)], ["কেনা", money(pl.cogs)],
        ["গ্রস লাভ", money(pl.gross)], ["খরচ", money(pl.shopExp)], ["নিট লাভ", money(pl.net)],
      ] },
      ...(kind === "monthlyProfit" ? [{
        title: "তারিখ অনুযায়ী স্টেটমেন্ট",
        headers: ["তারিখ", "বেচা", "কেনা", "খরচ", "লাভ"],
        columns: [{ kind: "date" }, { kind: "money" }, { kind: "money" }, { kind: "money" }, { kind: "money" }] as PdfColumn[],
        rows: monthlyRows.map((r) => [bnDate(r.date), money(r.revenue), money(r.cogs), money(r.expense), money(r.net)]),
      }] : []),
      { title: "বিস্তারিত হিসাব", headers: ["তারিখ", "বিবরণ", "টাকা"], columns: [{ kind: "date" }, { kind: "text" }, { kind: "money" }], rows: detailRows },
    ] : [{ headers: headers[kind]!, columns: columns[kind]!, rows }],
  };

  return createPortal(
    <div className="print-overlay report-overlay fixed inset-0 z-40 flex items-end justify-center bg-fg/50 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="print-sheet report-sheet flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line p-4 print:hidden">
          <div>
            <h2 id="report-title" className="font-bold text-primary-dark text-heading">{def.label}</h2>
            <p className="text-caption text-muted">প্রিভিউ — PDF ডাউনলোড করুন<span className="desktop-print-only"> বা প্রিন্ট করুন</span></p>
          </div>
          <button type="button" aria-label="বন্ধ" onClick={onClose} className="print:hidden">
            <X size={18} />
          </button>
        </div>
        {kind === "sales" ? (
          <div className="border-b border-line p-3 print:hidden">
            <label className="mb-1 block text-caption font-normal text-muted">বিক্রয়ের তারিখ</label>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setTo(e.target.value); }} className="w-full rounded-md border border-line px-2 py-2 text-input" />
          </div>
        ) : kind !== "stock" && kind !== "customerDue" && kind !== "dailyProfit" ? (
          <div className="grid grid-cols-2 gap-2 border-b border-line p-3 print:hidden">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-line px-2 py-2 text-input" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-line px-2 py-2 text-input" />
          </div>
        ) : null}
        <div className="print-content flex-1 overflow-y-auto p-4 text-center">
          <img src={SHOP.logo} alt="" className="mx-auto mb-2 size-12 rounded-full object-cover" />
          <p className="text-heading font-bold">{SHOP.name}</p>
          <p className="text-caption text-muted">{SHOP.address}</p>
          <p className="mt-2 text-heading font-bold">{def.label}</p>
          <p className="mt-1 text-caption text-muted">{period}</p>
          {kind === "dailyProfit" || kind === "monthlyProfit" ? (
            <div className="mt-4 space-y-2 text-left text-body">
              <div className="flex justify-between gap-3 border-b border-line pb-2 text-body font-bold">
                <span>কেনা: {money(pl.cogs)}</span>
                <span>বেচা: {money(pl.revenue)}</span>
              </div>
              <Line k="গ্রস লাভ" v={money(pl.gross)} />
              <Line k="খরচ" v={money(pl.shopExp)} />
              <Line k="নিট লাভ" v={money(pl.net)} bold />
              {kind === "monthlyProfit" ? (
                <div className="mt-4 border-t border-line pt-3 text-caption">
                  <p className="mb-2 font-bold text-primary-dark">তারিখ অনুযায়ী স্টেটমেন্ট</p>
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-x-2 border-b border-line pb-1 text-caption font-bold text-muted">
                    <span>তারিখ</span><span className="text-right">বেচা</span><span className="text-right">কেনা</span><span className="text-right">খরচ</span><span className="text-right">লাভ</span>
                  </div>
                  {monthlyRows.map((r) => (
                    <div key={r.date} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-x-2 border-b border-line py-1.5 tabular">
                      <span>{bnDate(r.date)}</span><span className="text-right">{money(r.revenue)}</span><span className="text-right">{money(r.cogs)}</span><span className="text-right">{money(r.expense)}</span><span className="text-right font-bold">{money(r.net)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-caption font-bold text-primary-dark">বিস্তারিত হিসাব</p>
                <div className="space-y-1.5 text-caption">
                  {detailRows.map((row, index) => (
                    <div key={index} className="flex justify-between gap-2">
                      <span>{row[0]} • {row[1]}</span>
                      <span className="shrink-0 tabular">{row[2]}</span>
                    </div>
                  ))}
                  {!detailRows.length ? <p className="text-muted">এই সময়ে কোনো ডাটা নেই</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <table className="mt-3 w-full table-fixed text-left text-body">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line align-top">
                    <td className="w-[22%] break-words py-1.5 pr-2">{r[0]}</td>
                    <td className="w-[28%] break-words py-1.5 pr-2 text-muted">{r[1]}</td>
                    <td className="break-words py-1.5 text-right font-bold tabular" colSpan={r.length > 3 ? 2 : undefined}>{r.length > 3 ? r.slice(2).join(" • ") : r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!rows.length && kind !== "dailyProfit" && kind !== "monthlyProfit" ? (
            <p className="py-6 text-body text-muted">এই সময়ে কোনো ডাটা নেই</p>
          ) : null}
          <DocumentActions document={document} />
        </div>
      </div>
    </div>,
    window.document.body,
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

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { DocumentActions } from "@/components/document-actions";
import type { PdfColumn } from "@/lib/reports/pdf-layout";
import type { PdfDocument } from "@/lib/reports/pdf";
import { useMemo, useState } from "react";
import { profitSummary } from "@/lib/calc";
import { bnDate, money, todayKey } from "@/lib/format";
import { SHOP } from "@/lib/shop";
import { STATEMENT_FOOTER } from "@/lib/reports/document-text";
import { useShop } from "@/lib/store";
import { CATALOG, type Kind } from "@/components/report-kinds";
import { reportRows } from "@/lib/reports/report-rows";

export type { Kind };
export { CATALOG };

export function Statement({
  kind, from, to, setFrom, setTo, onClose,
}: {
  kind: Kind; from: string; to: string;
  setFrom: (v: string) => void; setTo: (v: string) => void; onClose: () => void;
}) {
  const [generated, setGenerated] = useState(false);
  const def = CATALOG.find((c) => c.kind === kind)!;
  const sales = useShop((s) => s.sales);
  const purchases = useShop((s) => s.purchases);
  const expenses = useShop((s) => s.expenses);
  const collections = useShop((s) => s.collections);
  const products = useShop((s) => s.products);
  const customers = useShop((s) => s.customers);
  const adjustments = useShop((s) => s.adjustments);

  const rows = useMemo(
    () => reportRows(kind, from, to, { sales, purchases, expenses, collections, products, customers, adjustments }),
    [kind, from, to, sales, purchases, expenses, collections, products, customers, adjustments],
  );

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
    stock: [{ kind: "id", minWidth: 38 }, { kind: "text", minWidth: 170, weight: 5 }, { kind: "quantity", minWidth: 60 }, { kind: "quantity", minWidth: 60 }, { kind: "quantity", minWidth: 60 }],
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
        title: "তারিখ অনুয়ায়ী স্টেটমেন্ট",
        headers: ["তারিখ", "বেচা", "কেনা", "খরচ", "লাভ"],
        columns: [{ kind: "date" }, { kind: "money" }, { kind: "money" }, { kind: "money" }, { kind: "money" }] as PdfColumn[],
        rows: monthlyRows.map((r) => [bnDate(r.date), money(r.revenue), money(r.cogs), money(r.expense), money(r.net)]),
      }] : []),
      { title: "বিস্তারিত হিসাব", headers: ["তারিখ", "বিবরণ", "টাকা"], columns: [{ kind: "date" }, { kind: "text" }, { kind: "money" }], rows: detailRows },
    ] : [{
      headers: headers[kind]!, columns: columns[kind]!,
      emphasisRows: kind === "transaction" && rows.length ? [rows.length - 1] : undefined,
      rows: kind === "stock" ? rows.map((row) => row.map((cell, index) =>
        index >= 2 ? cell.replace(/^(?:শুরু|বিক্রি|আছে):\s*/, "") : cell,
      )) : rows,
    }],
  };

  return createPortal(
    <div className="print-overlay report-overlay fixed inset-0 z-40 flex items-end justify-center bg-fg/50 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="print-sheet report-sheet flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line p-4 print:hidden">
          <div>
            <h2 id="report-title" className="font-bold text-primary-dark text-heading">{def.label}</h2>
            <p className="text-caption text-muted">প্রিভিউ — PDF ডাউনলোড করুন<span className="desktop-print-only"> বা প্রিন্ট করুন</span></p>
          </div>
          <button type="button" aria-label="বন্ধ" onClick={onClose} className="print:hidden"><X size={18} /></button>
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
        {!generated ? <button type="button" onClick={() => setGenerated(true)} className="mx-3 my-3 rounded-md bg-primary py-3 text-body font-bold text-card">রিপোর্ট তৈরি করুন</button> : null}
        <div className={`${generated ? "" : "hidden"} print-content flex-1 overflow-y-auto p-4 text-center`}>

          <img src={SHOP.logo} alt="" className="mx-auto mb-2 size-12 rounded-full object-cover" />
          <p className="text-heading font-bold">{SHOP.name}</p>
          <p className="text-caption text-muted">{SHOP.address}</p>
          <p className="mt-2 text-heading font-bold">{def.label}</p>
          <p className="mt-1 text-caption text-muted">{period}</p>
          {profitReport ? (
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
                  <p className="mb-2 font-bold text-primary-dark">তারিখ অনুয়ায়ী স্টেটমেন্ট</p>
                  {monthlyRows.map((r) => (
                    <div key={r.date} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-x-2 border-b border-line py-1.5 tabular">
                      <span>{bnDate(r.date)}</span><span className="text-right">{money(r.revenue)}</span><span className="text-right">{money(r.cogs)}</span><span className="text-right">{money(r.expense)}</span><span className="text-right font-bold">{money(r.net)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-2 text-caption font-bold text-primary-dark">বিস্তারিত হিসাব</p>
                {detailRows.map((row, index) => (
                  <div key={index} className="flex justify-between gap-2 text-caption">
                    <span>{row[0]} • {row[1]}</span>
                    <span className="shrink-0 tabular">{row[2]}</span>
                  </div>
                ))}
                {!detailRows.length ? <p className="text-muted">এই সময়ে কোনো ডাটা নেই</p> : null}
              </div>
            </div>
          ) : (
            <table className="mt-3 w-full table-fixed text-left text-body">
              <tbody>
                {rows.map((r, i) => {
                  const totalRow = kind === "transaction" && i === rows.length - 1 && r[1] === "সর্বমোট";
                  return (
                    <tr key={i} className={`border-b border-line align-top ${totalRow ? "bg-mint-2/60" : ""}`}>
                      <td className="w-[22%] break-words py-1.5 pr-2">{r[0]}</td>
                      <td className={`w-[28%] break-words py-1.5 pr-2 ${totalRow ? "font-bold text-fg" : "text-muted"}`}>{r[1]}</td>
                      <td className="break-words py-1.5 text-right font-bold tabular" colSpan={r.length > 3 ? 2 : undefined}>{r.length > 3 ? r.slice(2).join(" • ") : r[2]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!rows.length && !profitReport ? <p className="py-6 text-body text-muted">এই সময়ে কোনো ডাটা নেই</p> : null}
          <p className="mt-6 border-t border-line pt-3 text-center text-caption text-muted">{STATEMENT_FOOTER}</p>
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

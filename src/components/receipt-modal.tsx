import { Download, Share2, X } from "lucide-react";
import { SHOP } from "@/lib/shop";
import { bnDate, bnNum, money } from "@/lib/format";
import type { Sale } from "@/lib/types";

export function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const due = sale.total - sale.paid;

  const share = async () => {
    const lines = [
      SHOP.name,
      SHOP.tagline,
      `${sale.billNo} • ${bnDate(sale.date)}`,
      `ক্রেতা: ${sale.customerName}`,
      ...sale.items.map((i) => `${i.productName} × ${bnNum(i.quantity)} = ${money(i.total)}`),
      `মোট: ${money(sale.total)}`,
      `জমা: ${money(sale.paid)}`,
      `বাকি: ${money(due)}`,
      SHOP.phones.join(", "),
    ].join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ title: sale.billNo, text: lines });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(lines);
  };

  const download = () => {
    const blob = new Blob(
      [
        `<html><head><meta charset="utf-8"><title>${sale.billNo}</title></head><body style="font-family:sans-serif;padding:24px">${document.getElementById("receipt-sheet")?.innerHTML ?? ""}</body></html>`,
      ],
      { type: "text/html" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sale.billNo}.html`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-fg/50 p-3 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-xl bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="receipt-title"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="receipt-title" className="font-semibold text-primary-dark">
            বিক্রয় রসিদ
          </h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose} className="rounded-full p-1.5 hover:bg-mint">
            <X size={18} />
          </button>
        </div>
        <div id="receipt-sheet" className="px-5 py-5 text-center">
          <img src={SHOP.logo} alt="" className="mx-auto mb-2 size-14 rounded-full object-cover" />
          <p className="text-base font-bold">{SHOP.name}</p>
          <p className="text-[11px] text-muted">{SHOP.tagline}</p>
          <p className="mt-1 text-[11px] text-muted">{SHOP.address}</p>
          <p className="text-[11px] text-muted">{SHOP.phones.join(" • ")}</p>
          <div className="my-3 border-t border-dashed border-line" />
          <div className="flex justify-between text-xs">
            <span>{sale.billNo}</span>
            <span>{bnDate(sale.date)}</span>
          </div>
          <p className="mt-1 text-left text-sm font-medium">ক্রেতা: {sale.customerName}</p>
          <table className="mt-3 w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1 font-medium">পণ্য</th>
                <th className="py-1 text-right font-medium">পরিমাণ</th>
                <th className="py-1 text-right font-medium">মোট</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((i) => (
                <tr key={i.productId + i.productName} className="border-b border-line/70">
                  <td className="py-1.5 pr-2">{i.productName}</td>
                  <td className="py-1.5 text-right tabular">
                    {bnNum(i.quantity)} {i.unit}
                  </td>
                  <td className="py-1.5 text-right tabular">{money(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 space-y-1 text-sm">
            <Row k="উপমোট" v={money(sale.subtotal)} />
            {sale.discount > 0 ? <Row k="ছাড়" v={money(sale.discount)} /> : null}
            <Row k="সর্বমোট" v={money(sale.total)} bold />
            <Row k="জমা" v={money(sale.paid)} />
            <Row k="বাকি" v={money(due)} bold={due > 0} />
          </div>
          <p className="mt-6 text-[11px] text-muted">মালিকের স্বাক্ষর ____________________</p>
        </div>
        <div className="flex gap-2 border-t border-line p-3">
          <button
            type="button"
            onClick={() => void share()}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-card"
          >
            <Share2 size={16} /> শেয়ার
          </button>
          <button
            type="button"
            onClick={download}
            className="flex items-center justify-center gap-2 rounded-md border border-line px-4 py-3 text-sm font-medium"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span className="tabular">{v}</span>
    </div>
  );
}

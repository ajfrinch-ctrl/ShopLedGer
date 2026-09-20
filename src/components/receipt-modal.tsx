import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DocumentActions } from "@/components/document-actions";
import type { PdfDocument } from "@/lib/reports/pdf";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { SHOP } from "@/lib/shop";
import { STATEMENT_FOOTER } from "@/lib/reports/document-text";
import { bnDate, bnQuantity, money } from "@/lib/format";
import { sharePdfToWhatsApp } from "@/lib/reports/share-pdf";
import { useShop } from "@/lib/store";
import type { Sale } from "@/lib/types";

export function ReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const customer = useShop((s) =>
    sale.customerId ? s.customers.find((c) => c.id === sale.customerId) : undefined,
  );
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    const trigger = window.document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialog) return;
      const buttons = [
        ...dialog.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      ].filter((button) => button.getClientRects().length > 0);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.document.addEventListener("keydown", onKeyDown);
    return () => {
      window.document.removeEventListener("keydown", onKeyDown);
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [onClose]);
  const due = sale.total - sale.paid;

  const shareMessage = [
    SHOP.name,
    `বিক্রয় রসিদ: ${sale.billNo}`,
    `ক্রেতা: ${sale.customerName}`,
    `মোট: ${money(sale.total)} • বাকি: ${money(due)}`,
    "এই বার্তার সঙ্গে রসিদের PDF পাঠানো হয়েছে।",
  ].join("\n");

  const document: PdfDocument = {
    format: "receipt-a5",
    receiptInfo: { billNo: sale.billNo, date: bnDate(sale.date), customerName: sale.customerName },
    title: "বিক্রয় রসিদ",
    subtitle: `${sale.billNo} • ${bnDate(sale.date)} • ক্রেতা: ${sale.customerName}`,
    filename: `receipt-${sale.id}.pdf`,
    sections: [
      {
        headers: ["পণ্য", "পরিমাণ", "দর", "মোট"],
        columns: [{ kind: "text", minWidth: 160, weight: 5 }, { kind: "quantity" }, { kind: "money" }, { kind: "money" }],
        rows: sale.items.map((i) => [
          i.productName,
          `${bnQuantity(i.quantity)} ${i.unit}`,
          money(i.salePrice),
          money(i.total),
        ]),
      },
      {
        headers: ["বিবরণ", "টাকা"],
        emphasisRows: [2, 4],
        columns: [{ kind: "text" }, { kind: "money" }],
        rows: [
          ["উপমোট", money(sale.subtotal)],
          ["ছাড়", money(sale.discount)],
          ["সর্বমোট", money(sale.total)],
          ["জমা", money(sale.paid)],
          ["বাকি", money(due)],
        ],
      },
    ],
    note: sale.note,
  };

  const sendPdfToWhatsApp = async () => {
    if (sharing) return;
    if (!customer?.phone) {
      toast.error("এই বিলে ক্রেতার WhatsApp নম্বর নেই");
      return;
    }
    setSharing(true);
    try {
      const result = await sharePdfToWhatsApp({
        document,
        phone: customer.phone,
        text: shareMessage,
      });
      if (result === "shared") {
        toast.success("PDF শেয়ার মেনু খোলা হয়েছে — WhatsApp নির্বাচন করুন");
      } else if (result === "fallback") {
        toast.success("PDF ডাউনলোড হয়েছে এবং ক্রেতার WhatsApp চ্যাট খোলা হয়েছে");
      }
    } catch {
      toast.error("PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setSharing(false);
    }
  };

  return createPortal(
    <div
      className="print-overlay fixed inset-0 z-50 flex items-end justify-center bg-fg/50 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="print-sheet max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-xl bg-card shadow-card"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3 print:hidden">
          <h2 id="receipt-title" className="font-bold text-primary-dark text-heading">
            বিক্রয় রসিদ
          </h2>
          <button
            type="button"
            aria-label="বন্ধ"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-mint"
          >
            <X size={18} />
          </button>
        </div>
        <div id="receipt-sheet" className="px-5 py-5 text-center">
          <img src={SHOP.logo} alt="" className="mx-auto mb-2 size-14 rounded-full object-cover" />
          <p className="text-heading font-bold">{SHOP.name}</p>
          <p className="text-caption text-muted">{SHOP.tagline}</p>
          <p className="mt-1 text-caption text-muted">{SHOP.address}</p>
          <p className="text-caption text-muted">{SHOP.phones.join(" • ")}</p>
          <div className="my-3 border-t border-dashed border-line" />
          <div className="flex justify-between text-caption">
            <span>{sale.billNo}</span>
            <span>{bnDate(sale.date)}</span>
          </div>
          <p className="mt-1 text-left text-body font-normal">ক্রেতা: {sale.customerName}</p>
          <table className="mt-3 w-full table-fixed text-left text-body">
            <colgroup>
              <col className="w-[37%]" />
              <col className="w-[21%]" />
              <col className="w-[21%]" />
              <col className="w-[21%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1 font-normal">পণ্য</th>
                <th className="py-1 text-right font-normal">পরিমাণ</th>
                <th className="py-1 text-right font-normal">দর</th>
                <th className="py-1 text-right font-normal">মোট</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((i, index) => (
                <tr key={`${i.productId}-${index}`} className="border-b border-line/70">
                  <td className="break-words py-1.5 pr-2">{i.productName}</td>
                  <td className="break-words py-1.5 pl-1 text-right tabular">
                    {bnQuantity(i.quantity)} {i.unit}
                  </td>
                  <td className="break-words py-1.5 pl-1 text-right tabular">
                    {money(i.salePrice)}
                  </td>
                  <td className="break-words py-1.5 pl-1 text-right tabular">{money(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 space-y-1 text-body">
            <Row k="উপমোট" v={money(sale.subtotal)} />
            {sale.discount > 0 ? <Row k="ছাড়" v={money(sale.discount)} /> : null}
            <Row k="সর্বমোট" v={money(sale.total)} bold />
            <Row k="জমা" v={money(sale.paid)} />
            <Row k="বাকি" v={money(due)} bold={due > 0} />
          </div>
          {sale.note ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-left text-body">
              নোট: {sale.note}
            </p>
          ) : null}
          <p className="mt-3 text-left text-caption text-muted">
            জমা ও বাকি এই বিল তৈরির সময়ের হিসাব। পরবর্তী আদায় ক্রেতার খাতায় দেখুন।
          </p>
          <p className="mt-6 border-t border-line pt-3 text-center text-caption text-muted">{STATEMENT_FOOTER}</p>
        </div>
        <div className="border-t border-line p-3 print:hidden">
          <div className="rounded-xl border border-[#b9ebc8] bg-[#f0fff4] p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
                <MessageCircle size={20} fill="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body font-bold text-[#075E54]">ক্রেতাকে PDF পাঠান</p>
                <p className="truncate text-caption text-[#52756d]">
                  {customer ? `${customer.name} • ${customer.phone}` : "এই বিলে ক্রেতার নম্বর নেই"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void sendPdfToWhatsApp()}
              disabled={sharing || !customer?.phone}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#128C7E] py-3 text-body font-bold text-white shadow-[0_6px_16px_rgba(18,140,126,0.22)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle size={17} fill="currentColor" />
              {sharing ? "PDF প্রস্তুত হচ্ছে…" : "WhatsApp-এ PDF পাঠান"}
            </button>
            <p className="mt-2 text-center text-caption text-[#52756d]">
              ফোনের শেয়ার মেনুতে WhatsApp বেছে নিন
            </p>
          </div>
          <DocumentActions document={document} />
        </div>
      </div>
    </div>,
    window.document.body,
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

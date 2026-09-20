import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { downloadPdf, type PdfDocument } from "@/lib/reports/pdf";

export function DocumentActions({ document }: { document: PdfDocument }) {
  const [busy, setBusy] = useState(false);
  const run = async (action: "download" | "print") => {
    if (busy) return;
    setBusy(true);
    try {
      if (action === "download") await downloadPdf(document);
      else {
        await window.document.fonts.ready;
        window.print();
      }
    } catch {
      toast.error(
        action === "download"
          ? "PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।"
          : "প্রিন্ট করা যায়নি। আবার চেষ্টা করুন।",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 flex flex-wrap gap-2 print:hidden" aria-busy={busy}>
      {document.format === "receipt-a5" ? (
        <p className="w-full text-center text-caption text-muted">PDF: A5 বিক্রয় রসিদ</p>
      ) : null}
      {document.format === "pos80" ? (
        <p className="w-full text-center text-caption text-muted">PDF: ৮০ মিমি POS রসিদ</p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void run("download")}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-body font-bold text-card disabled:opacity-50"
      >
        <Download size={17} /> {busy ? "প্রস্তুত হচ্ছে…" : "PDF ডাউনলোড করুন"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run("print")}
        className="desktop-print-only inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-3 text-body font-bold disabled:opacity-50"
      >
        <Printer size={17} /> প্রিন্ট
      </button>
      <p className="desktop-print-only w-full text-center text-caption text-muted">
        প্রিন্টের উইন্ডোতে Save as PDF-ও বেছে নিতে পারেন।
      </p>
    </div>
  );
}

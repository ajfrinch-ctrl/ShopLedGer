import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { DbBranch, LedgerEntry } from "../lib/db";
import { money } from "../lib/ledger";
export default function LedgerReceipt({
  entry,
  branch,
  balance,
  onClose,
}: {
  entry: LedgerEntry;
  branch?: DbBranch;
  balance: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File>();
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  async function exportReceipt(mode: "pdf" | "image" | "print") {
    if (!ref.current) return;
    const popup = mode === "print" ? window.open("", "_blank") : null;
    setBusy(true);
    setMessage("");
    try {
      await document.fonts.ready;
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      if (mode === "pdf") {
        const pdf = new jsPDF();
        const height = (canvas.height * 190) / canvas.width;
        const scale = Math.min(1, 277 / height);
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          10,
          10,
          190 * scale,
          height * scale,
        );
        pdf.save(`receipt-${entry.id}.pdf`);
      } else if (mode === "print") {
        if (!popup) throw new Error("প্রিন্টের জন্য পপআপ অনুমতি দিন");
        const img = popup.document.createElement("img");
        img.style.width = "100%";
        img.onload = () => {
          popup.focus();
          popup.print();
        };
        img.src = canvas.toDataURL("image/png");
        popup.document.body.appendChild(img);
      } else {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("ছবি তৈরি হয়নি"))),
            "image/png",
          ),
        );
        const image = new File([blob], `receipt-${entry.id}.png`, {
          type: "image/png",
        });
        setFile(image);
        download(image, image.name);
        setMessage(
          "ছবি প্রস্তুত। শেয়ার বাটন থেকে WhatsApp বেছে নিন; সমর্থন না থাকলে ডাউনলোড করা ছবি সংযুক্ত করুন।",
        );
      }
    } catch (err) {
      popup?.close();
      setMessage(err instanceof Error ? err.message : "রসিদ তৈরি হয়নি");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="লেনদেনের রসিদ"
      className="fixed inset-0 z-50 bg-black/50 p-4 overflow-auto"
    >
      <div className="max-w-xl mx-auto bg-white rounded-xl p-4">
        <button className="btn-secondary mb-3" onClick={onClose}>
          বন্ধ করুন
        </button>
        <div
          ref={ref}
          className="bg-white p-6 text-gray-900 space-y-4"
          style={{ overflowWrap: "anywhere" }}
        >
          <header className="text-center border-b-2 border-teal-700 pb-4">
            {branch?.logo && (
              <img className="h-16 mx-auto mb-2" src={branch.logo} alt="লোগো" />
            )}
            <h2 className="text-2xl font-bold text-teal-800">
              {branch?.organization || "ShopLedGer"}
            </h2>
            <p>{branch?.name}</p>
            <p>{branch?.address}</p>
            <p>{branch?.phone}</p>
          </header>
          <h3 className="text-center text-xl font-bold">
            {entry.party_type === "customer"
              ? "টাকা আদায়ের রসিদ"
              : "টাকা পরিশোধের রসিদ"}
            {entry.cancelled ? " — বাতিল" : ""}
          </h3>
          <p>রসিদ নং: {entry.id}</p>
          <p>তারিখ: {entry.date}</p>
          <p>
            {entry.party_type === "customer" ? "ক্রেতা" : "সাপ্লায়ার"}:{" "}
            {entry.party_name}
          </p>
          <p className="text-xl font-bold">টাকা: {money(entry.amount)}</p>
          <p>মাধ্যম: {entry.method}</p>
          {entry.reference && <p>রেফারেন্স: {entry.reference}</p>}
          <p>লেনদেনের পর বাকি: {money(balance)}</p>
          {entry.note && <p>মন্তব্য: {entry.note}</p>}
          <p className="border-t pt-6 text-sm">
            অনুমোদিত স্বাক্ষর: __________________
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            disabled={busy}
            className="btn-secondary"
            onClick={() => exportReceipt("print")}
          >
            প্রিন্ট
          </button>
          <button
            disabled={busy}
            className="btn-secondary"
            onClick={() => exportReceipt("pdf")}
          >
            PDF
          </button>
          <button
            disabled={busy}
            className="btn-primary"
            onClick={() => exportReceipt("image")}
          >
            ছবি তৈরি / ডাউনলোড
          </button>
          {file && (
            <button
              className="btn-primary"
              onClick={async () => {
                try {
                  if (navigator.canShare?.({ files: [file] }))
                    await navigator.share({
                      files: [file],
                      title: "লেনদেনের রসিদ",
                    });
                  else
                    setMessage(
                      "এই ব্রাউজারে ছবি শেয়ার সমর্থিত নয়। WhatsApp খুলে ডাউনলোড করা ছবিটি সংযুক্ত করুন।",
                    );
                } catch (e) {
                  if (!(e instanceof DOMException && e.name === "AbortError"))
                    setMessage("শেয়ার হয়নি। ডাউনলোড করা ছবি পাঠান।");
                }
              }}
            >
              WhatsApp / শেয়ার
            </button>
          )}
        </div>
        <p role="status" className="mt-3 text-sm">
          {busy ? "রসিদ তৈরি হচ্ছে…" : message}
        </p>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { bnDate, bnNum, money, todayKey } from "@/lib/format";
import { canManage, useShop } from "@/lib/store";

export const Route = createFileRoute("/purchases")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <PurchasesPage />
      </AppShell>
    </RequireAuth>
  ),
});

function PurchasesPage() {
  const user = useShop((s) => s.user);
  const purchases = useShop((s) => s.purchases);
  const products = useShop((s) => s.products);
  const addPurchase = useShop((s) => s.addPurchase);
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(products[0]?.purchasePrice ?? 0);
  const [supplier, setSupplier] = useState("নন্দন ফিড মিলস");
  const [paid, setPaid] = useState(0);
  const [date, setDate] = useState(todayKey());

  if (!canManage(user?.role)) {
    return <p className="p-6 text-body">ক্রয় এন্ট্রি মালিক/ব্যবস্থাপকের জন্য।</p>;
  }

  const p = products.find((x) => x.id === productId);
  const total = qty * price;

  return (
    <div>
      <PageTitle title="ক্রয়" subtitle="সাপ্লায়ার চালান ও স্টক ইন" />
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-body font-bold text-card"
        >
          <Plus size={16} /> নতুন ক্রয়
        </button>
      </div>
      <ul className="mt-3">
        {purchases.map((row) => (
          <li key={row.id} className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <div>
              <p className="text-body font-bold">{row.productName}</p>
              <p className="text-caption text-muted">
                {row.supplier} • {bnDate(row.date)} • {bnNum(row.quantity)} {row.unit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-body font-bold tabular">{money(row.total)}</p>
              <p className={`text-caption ${row.total - row.paid > 0 ? "text-danger" : "text-primary"}`}>
                {row.total - row.paid > 0 ? `বাকি ${money(row.total - row.paid)}` : "পরিশোধিত"}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-heading">স্টক ইন</h2>
              <button type="button" aria-label="বন্ধ" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-caption font-bold">
                তারিখ
                <input type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input" />
              </label>
              <label className="block text-caption font-bold">
                পণ্য
                <select
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    const np = products.find((x) => x.id === e.target.value);
                    if (np) setPrice(np.purchasePrice);
                  }}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input"
                >
                  {products.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="সাপ্লায়ার" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-caption font-bold">
                  পরিমাণ
                  <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input" />
                </label>
                <label className="text-caption font-bold">
                  দর
                  <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input" />
                </label>
              </div>
              <label className="text-caption font-bold">
                জমা (৳) — খালি রাখলে পুরোটা বাকি
                <input type="number" min={0} value={paid || ""} onChange={(e) => setPaid(Number(e.target.value) || 0)} className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input" />
              </label>
              <p className="text-body font-bold">মোট {money(total)}</p>
              <button
                type="button"
                onClick={() => {
                  if (!p || !qty || !supplier.trim()) return toast.error("সব ঘর পূরণ করুন");
                  addPurchase({
                    date,
                    productId: p.id,
                    productName: p.name,
                    quantity: qty,
                    unit: p.unit,
                    purchasePrice: price,
                    total,
                    supplier: supplier.trim(),
                    paid: Math.min(paid, total),
                  });
                  setOpen(false);
                  toast.success("ক্রয় সংরক্ষণ হয়েছে");
                }}
                className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
              >
                সংরক্ষণ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

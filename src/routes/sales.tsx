import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { ReceiptModal } from "@/components/receipt-modal";
import { stockOf } from "@/lib/calc";
import { bnDate, bnNum, money, todayKey } from "@/lib/format";
import { useShop } from "@/lib/store";
import type { Product, Sale, SaleItem } from "@/lib/types";

export const Route = createFileRoute("/sales")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <SalesPage />
      </AppShell>
    </RequireAuth>
  ),
});

function SalesPage() {
  const sales = useShop((s) => s.sales);
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  return (
    <div>
      <PageTitle title="বিক্রি" subtitle="নতুন বিল কাটুন, রসিদ দেখুন" />
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3.5 text-sm font-bold text-card"
        >
          <Plus size={18} /> নতুন বিক্রি
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {sales.map((s) => {
          const due = s.total - s.paid;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setReceipt(s)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.customerName}</p>
                  <p className="text-[11px] text-muted">
                    {s.billNo} • {bnDate(s.date)} • {bnNum(s.items.length)}টি পণ্য
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular">{money(s.total)}</p>
                  <p className={`text-[11px] ${due > 0 ? "text-danger" : "text-primary"}`}>
                    {due > 0 ? `বাকি ${money(due)}` : "পরিশোধিত"}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <SaleComposer
          onClose={() => setOpen(false)}
          onSaved={(s) => {
            setOpen(false);
            setReceipt(s);
          }}
        />
      ) : null}
      {receipt ? <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

function SaleComposer({ onClose, onSaved }: { onClose: () => void; onSaved: (s: Sale) => void }) {
  const products = useShop((s) => s.products);
  const customers = useShop((s) => s.customers);
  const sales = useShop((s) => s.sales);
  const purchases = useShop((s) => s.purchases);
  const adjustments = useShop((s) => s.adjustments);
  const addSale = useShop((s) => s.addSale);
  const addCustomer = useShop((s) => s.addCustomer);

  const [date, setDate] = useState(todayKey());
  const [q, setQ] = useState("");
  const [custId, setCustId] = useState<string>("");
  const [newCust, setNewCust] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);

  const filtered = useMemo(() => {
    const n = q.trim();
    return products.filter((p) => !n || p.name.includes(n) || p.code.toLowerCase().includes(n.toLowerCase()) || p.company.includes(n));
  }, [products, q]);

  const subtotal = cart.reduce((a, i) => a + i.total, 0);
  const total = Math.max(0, subtotal - discount);
  const due = Math.max(0, total - paid);

  const addProduct = (p: Product) => {
    const stock = stockOf(p, sales, purchases, adjustments);
    const existing = cart.find((i) => i.productId === p.id);
    const nextQty = (existing?.quantity ?? 0) + 1;
    if (nextQty > stock) {
      toast.error(`${p.name} — স্টক ${bnNum(stock)} ${p.unit}`);
      return;
    }
    if (existing) {
      setCart((c) =>
        c.map((i) =>
          i.productId === p.id
            ? { ...i, quantity: nextQty, total: nextQty * i.salePrice }
            : i,
        ),
      );
    } else {
      setCart((c) => [
        ...c,
        {
          productId: p.id,
          productName: p.name,
          unit: p.unit,
          quantity: 1,
          salePrice: p.salePrice,
          purchasePrice: p.purchasePrice,
          total: p.salePrice,
        },
      ]);
    }
  };

  const setQty = (id: string, qty: number) => {
    if (qty <= 0) {
      setCart((c) => c.filter((i) => i.productId !== id));
      return;
    }
    const p = products.find((x) => x.id === id);
    if (p) {
      const stock = stockOf(p, sales, purchases, adjustments);
      if (qty > stock) {
        toast.error(`স্টক মাত্র ${bnNum(stock)}`);
        return;
      }
    }
    setCart((c) => c.map((i) => (i.productId === id ? { ...i, quantity: qty, total: qty * i.salePrice } : i)));
  };

  const save = () => {
    if (!cart.length) {
      toast.error("অন্তত একটি পণ্য যোগ করুন");
      return;
    }
    let customerId = custId || undefined;
    let customerName = "নগদ ক্রেতা";
    if (newCust) {
      if (!custName.trim()) {
        toast.error("ক্রেতার নাম দিন");
        return;
      }
      const c = addCustomer({ name: custName.trim(), phone: custPhone.trim(), address: "" });
      customerId = c.id;
      customerName = c.name;
    } else if (custId) {
      customerName = customers.find((c) => c.id === custId)?.name ?? "ক্রেতা";
    }
    if (due > 0 && !customerId) {
      toast.error("বাকি রাখতে ক্রেতা নির্বাচন করুন");
      return;
    }
    const sale = addSale({
      date,
      items: cart,
      discount,
      paid,
      customerId,
      customerName,
    });
    toast.success(`${sale.billNo} সংরক্ষণ হয়েছে`);
    onSaved(sale);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-fg/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl bg-card sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-bold">নতুন বিক্রি</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <label className="block text-xs font-semibold">
            তারিখ
            <input
              type="date"
              max={todayKey()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-sm"
            />
          </label>

          <div>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewCust(false);
                  setCustId("");
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${!custId && !newCust ? "bg-primary text-card" : "bg-mint-2"}`}
              >
                নগদ ক্রেতা
              </button>
              <button
                type="button"
                onClick={() => setNewCust(true)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${newCust ? "bg-primary text-card" : "bg-mint-2"}`}
              >
                নতুন ক্রেতা
              </button>
            </div>
            {newCust ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="নাম"
                  className="rounded-md border border-line px-3 py-2.5 text-sm"
                />
                <input
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="মোবাইল"
                  className="rounded-md border border-line px-3 py-2.5 text-sm"
                />
              </div>
            ) : (
              <select
                value={custId}
                onChange={(e) => {
                  setCustId(e.target.value);
                  setNewCust(false);
                }}
                className="w-full rounded-md border border-line px-3 py-2.5 text-sm"
              >
                <option value="">নগদ ক্রেতা / খাতা বাছুন</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="পণ্য খুঁজুন"
                className="w-full rounded-md border border-line py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-line">
              {filtered.slice(0, 8).map((p) => {
                const st = stockOf(p, sales, purchases, adjustments);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between border-b border-line px-3 py-2 text-left last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted">
                        স্টক {bnNum(st)} {p.unit}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular">{money(p.salePrice)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {cart.length ? (
            <ul className="space-y-2">
              {cart.map((i) => (
                <li key={i.productId} className="flex items-center gap-2 rounded-md bg-mint px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.productName}</p>
                    <p className="text-[11px] text-muted tabular">{money(i.salePrice)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="rounded-full bg-card p-1" onClick={() => setQty(i.productId, i.quantity - 1)}>
                      <Minus size={14} />
                    </button>
                    <span className="w-7 text-center text-sm font-bold tabular">{bnNum(i.quantity)}</span>
                    <button type="button" className="rounded-full bg-card p-1" onClick={() => setQty(i.productId, i.quantity + 1)}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setQty(i.productId, 0)} className="text-danger">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold">
              ছাড় (৳)
              <input
                type="number"
                min={0}
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-xs font-semibold">
              জমা (৳)
              <input
                type="number"
                min={0}
                value={paid || ""}
                onChange={(e) => setPaid(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPaid(total)} className="flex-1 rounded-full bg-mint-2 py-2 text-xs font-semibold text-primary">
              পুরোটা নগদ
            </button>
            <button type="button" onClick={() => setPaid(0)} className="flex-1 rounded-full bg-mint-2 py-2 text-xs font-semibold">
              পুরোটা বাকি
            </button>
          </div>
        </div>
        <div className="border-t border-line p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span>মোট</span>
            <span className="font-bold tabular">{money(total)}</span>
          </div>
          <div className="mb-3 flex justify-between text-sm">
            <span>বাকি থাকবে</span>
            <span className={`font-bold tabular ${due ? "text-danger" : "text-primary"}`}>{money(due)}</span>
          </div>
          <button type="button" onClick={save} className="w-full rounded-md bg-primary py-3 text-sm font-bold text-card">
            বিল সংরক্ষণ
          </button>
        </div>
      </div>
    </div>
  );
}

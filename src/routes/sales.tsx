import { createFileRoute } from "@tanstack/react-router";
import { AdminActions } from "@/components/admin-actions";
import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { ReceiptModal } from "@/components/receipt-modal";
import { customerDue, stockOf } from "@/lib/calc";
import { bnDate, bnNum, money, todayKey } from "@/lib/format";
import { isSystemAdmin, useShop } from "@/lib/store";
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
  const user = useShop((s) => s.user);
  const sales = useShop((s) => s.sales);
  const updateSale = useShop((s) => s.updateSale);
  const deleteSale = useShop((s) => s.deleteSale);
  const products = useShop((s) => s.products);
  const masterAdmin = isSystemAdmin(user?.role);
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [editSale, setEditSale] = useState<Sale | null>(null);

  return (
    <div>
      <PageTitle title="বিক্রি" subtitle="নতুন বিল কাটুন, রসিদ দেখুন" />
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3.5 text-body font-bold text-card"
        >
          <Plus size={18} /> নতুন বিক্রি
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {sales.map((s) => {
          const due = s.total - s.paid;
          return (
            <li key={s.id} className="flex items-center gap-2 px-4 py-1">
              <button
                type="button"
                onClick={() => setReceipt(s)}
                className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body font-bold">{s.customerName}</p>
                  <p className="text-caption text-muted">
                    {s.billNo} • {bnDate(s.date)} • {bnNum(s.items.length)}টি পণ্য
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-body font-bold tabular">{money(s.total)}</p>
                  <p className={`text-caption ${due > 0 ? "text-danger" : "text-primary"}`}>
                    {due > 0 ? `বাকি ${money(due)}` : "পরিশোধিত"}
                  </p>
                </div>
              </button>
              {masterAdmin ? (
                <AdminActions
                  onEdit={() => setEditSale(s)}
                  onDelete={() => {
                    if (!window.confirm(`${s.billNo} মুছে ফেলবেন?`)) return;
                    if (deleteSale(s.id)) {
                      if (receipt?.id === s.id) setReceipt(null);
                      toast.success("লেনদেন মুছে ফেলা হয়েছে, হিসাব পুনরায় গণনা হয়েছে");
                    } else {
                      toast.error("লেনদেন মুছে ফেলা যায়নি");
                    }
                  }}
                />
              ) : null}
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
      {editSale ? (
        <SaleEditModal
          sale={editSale}
          products={products}
          onClose={() => setEditSale(null)}
          onSave={(patch) => {
            if (updateSale(editSale.id, patch)) {
              setEditSale(null);
              toast.success("লেনদেন আপডেট হয়েছে, হিসাব পুনরায় গণনা হয়েছে");
            } else {
              toast.error("লেনদেন আপডেট করা যায়নি");
            }
          }}
        />
      ) : null}
      {receipt ? <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

function SaleEditModal({
  sale,
  products,
  onClose,
  onSave,
}: {
  sale: Sale;
  products: Product[];
  onClose: () => void;
  onSave: (patch: Partial<Omit<Sale, "id" | "createdAt">>) => void;
}) {
  const [date, setDate] = useState(sale.date);
  const [customerName, setCustomerName] = useState(sale.customerName);
  const [items, setItems] = useState<SaleItem[]>(sale.items);
  const [discount, setDiscount] = useState(sale.discount);
  const [paid, setPaid] = useState(sale.paid);
  const [note, setNote] = useState(sale.note ?? "");
  const [newProductId, setNewProductId] = useState("");
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal - discount);

  const updateItem = (productId: string, patch: Partial<SaleItem>) => {
    setItems((current) =>
      current.map((item) => {
        if (item.productId !== productId) return item;
        const next = { ...item, ...patch };
        return {
          ...next,
          quantity: Math.max(0, next.quantity),
          salePrice: Math.max(0, next.salePrice),
          total: Math.max(0, next.quantity) * Math.max(0, next.salePrice),
        };
      }),
    );
  };

  const addItem = () => {
    const product = products.find((item) => item.id === newProductId);
    if (!product || items.some((item) => item.productId === product.id)) return;
    setItems((current) => [
      ...current,
      {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 1,
        salePrice: product.salePrice,
        purchasePrice: product.purchasePrice,
        total: product.salePrice,
      },
    ]);
    setNewProductId("");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-bold text-heading">লেনদেন সম্পাদনা</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          <label className="block text-caption font-bold">
            তারিখ
            <input type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input" />
          </label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ক্রেতার নাম" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
          <div className="rounded-lg border border-line p-3">
            <p className="mb-2 text-caption font-bold">পণ্য</p>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.productId} className="rounded-md bg-bg p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-caption font-bold">{item.productName}</span>
                    <button type="button" aria-label="পণ্য বাদ দিন" onClick={() => setItems((current) => current.filter((row) => row.productId !== item.productId))} className="text-danger"><Trash2 size={15} /></button>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <label className="text-caption">পরিমাণ<input type="number" min={0} value={item.quantity} onChange={(e) => updateItem(item.productId, { quantity: Number(e.target.value) || 0 })} className="mt-1 w-full rounded-md border border-line px-2 py-2 text-input" /></label>
                    <label className="text-caption">দর<input type="number" min={0} value={item.salePrice} onChange={(e) => updateItem(item.productId, { salePrice: Number(e.target.value) || 0 })} className="mt-1 w-full rounded-md border border-line px-2 py-2 text-input" /></label>
                  </div>
                </div>
              ))}
            </div>
            {products.length ? (
              <div className="mt-2 flex gap-2">
                <select value={newProductId} onChange={(e) => setNewProductId(e.target.value)} className="min-w-0 flex-1 rounded-md border border-line px-2 py-2 text-input">
                  <option value="">পণ্য যোগ করুন</option>
                  {products.filter((product) => !items.some((item) => item.productId === product.id)).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
                <button type="button" onClick={addItem} disabled={!newProductId} className="rounded-md bg-mint-2 px-3 text-body font-bold text-primary disabled:opacity-50">যোগ</button>
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-caption font-bold">ছাড়<input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="mt-1 w-full rounded-md border border-line px-2 py-2.5 text-input" /></label>
            <label className="text-caption font-bold">জমা<input type="number" min={0} value={paid} onChange={(e) => setPaid(Number(e.target.value) || 0)} className="mt-1 w-full rounded-md border border-line px-2 py-2.5 text-input" /></label>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
          <p className="flex justify-between text-body font-bold"><span>নতুন মোট</span><span className="tabular">{money(total)}</span></p>
          <button type="button" onClick={() => onSave({ date, customerName: customerName.trim() || "নগদ ক্রেতা", items, discount, paid, note: note.trim() || undefined })} disabled={!items.length} className="w-full rounded-md bg-primary py-3 text-body font-bold text-card disabled:opacity-50">সংরক্ষণ</button>
        </div>
      </div>
    </div>
  );
}

function SaleComposer({ onClose, onSaved }: { onClose: () => void; onSaved: (s: Sale) => void }) {
  const products = useShop((s) => s.products);
  const customers = useShop((s) => s.customers);
  const sales = useShop((s) => s.sales);
  const collections = useShop((s) => s.collections);
  const purchases = useShop((s) => s.purchases);
  const adjustments = useShop((s) => s.adjustments);
  const addSale = useShop((s) => s.addSale);
  const addCustomer = useShop((s) => s.addCustomer);

  const [date, setDate] = useState(todayKey());
  const [q, setQ] = useState("");
  const [custId, setCustId] = useState<string>("");
  const [customerQuery, setCustomerQuery] = useState("");
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

  const matchingCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(query) || c.phone.includes(query)).slice(0, 6);
  }, [customers, customerQuery]);

  const selectedCustomer = customers.find((c) => c.id === custId);
  const customerSales = selectedCustomer ? sales.filter((s) => s.customerId === selectedCustomer.id) : [];
  const lastCustomerSale = [...customerSales].sort((a, b) => b.date.localeCompare(a.date))[0];
  const customerTotal = customerSales.reduce((sum, s) => sum + s.total, 0);
  const customerBalance = selectedCustomer ? customerDue(selectedCustomer.id, sales, collections) : 0;

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
          <h2 className="font-bold text-heading">নতুন বিক্রি</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <label className="block text-caption font-bold">
            তারিখ
            <input
              type="date"
              max={todayKey()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input"
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
                className={`rounded-full px-3 py-1.5 text-caption font-normal ${!custId && !newCust ? "bg-primary text-card" : "bg-mint-2"}`}
              >
                নগদ ক্রেতা
              </button>
              <button
                type="button"
                onClick={() => setNewCust(true)}
                className={`rounded-full px-3 py-1.5 text-caption font-normal ${newCust ? "bg-primary text-card" : "bg-mint-2"}`}
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
                  className="rounded-md border border-line px-3 py-2.5 text-input"
                />
                <input
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="মোবাইল"
                  className="rounded-md border border-line px-3 py-2.5 text-input"
                />
              </div>
            ) : (
              <div className="relative">
                <input
                  value={customerQuery}
                  onChange={(e) => { setCustomerQuery(e.target.value); setCustId(""); }}
                  placeholder="নাম বা মোবাইল দিয়ে ক্রেতা খুঁজুন"
                  className="w-full rounded-md border border-line px-3 py-2.5 text-input"
                />
                {matchingCustomers.length && !custId ? (
                  <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-line bg-card shadow-lg">
                    {matchingCustomers.map((c) => (
                      <button key={c.id} type="button" onClick={() => { setCustId(c.id); setCustomerQuery(`${c.name} — ${c.phone}`); }} className="block w-full border-b border-line px-3 py-2 text-left text-body last:border-0 hover:bg-mint-2">
                        {c.name} — {c.phone}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            {selectedCustomer ? (
              <div className="mt-2 rounded-md border border-mint-3 bg-mint-2 p-3 text-caption">
                <div className="flex justify-between"><span>মোট বিক্রি</span><strong>{money(customerTotal)}</strong></div>
                <div className="mt-1 flex justify-between"><span>বর্তমান বাকি</span><strong>{money(customerBalance)}</strong></div>
                <div className="mt-1 border-t border-mint-3 pt-1"><span className="text-muted">সর্বশেষ কিনেছে: </span>{lastCustomerSale ? `${lastCustomerSale.items.map((i) => `${i.productName} × ${bnNum(i.quantity)}`).join(", ")} (${bnDate(lastCustomerSale.date)})` : "এখনও কোনো বিক্রি নেই"}</div>
              </div>
            ) : null}
          </div>

          <div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="পণ্য খুঁজুন"
                className="w-full rounded-md border border-line py-2.5 pl-9 pr-3 text-input"
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
                      <p className="text-body font-normal">{p.name}</p>
                      <p className="text-caption text-muted">
                        স্টক {bnNum(st)} {p.unit}
                      </p>
                    </div>
                    <p className="text-body font-bold tabular">{money(p.salePrice)}</p>
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
                    <p className="truncate text-body font-normal">{i.productName}</p>
                    <p className="text-caption text-muted tabular">{money(i.salePrice)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="rounded-full bg-card p-1" onClick={() => setQty(i.productId, i.quantity - 1)}>
                      <Minus size={14} />
                    </button>
                    <span className="w-7 text-center text-body font-bold tabular">{bnNum(i.quantity)}</span>
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
            <label className="text-caption font-bold">
              ছাড় (৳)
              <input
                type="number"
                min={0}
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input"
              />
            </label>
            <label className="text-caption font-bold">
              জমা (৳)
              <input
                type="number"
                min={0}
                value={paid || ""}
                onChange={(e) => setPaid(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPaid(total)} className="flex-1 rounded-full bg-mint-2 py-2 text-caption font-bold text-primary">
              পুরোটা নগদ
            </button>
            <button type="button" onClick={() => setPaid(0)} className="flex-1 rounded-full bg-mint-2 py-2 text-caption font-bold">
              পুরোটা বাকি
            </button>
          </div>
        </div>
        <div className="border-t border-line p-4">
          <div className="mb-3 flex justify-between text-body">
            <span>মোট</span>
            <span className="font-bold tabular">{money(total)}</span>
          </div>
          <div className="mb-3 flex justify-between text-body">
            <span>বাকি থাকবে</span>
            <span className={`font-bold tabular ${due ? "text-danger" : "text-primary"}`}>{money(due)}</span>
          </div>
          <button type="button" onClick={save} className="w-full rounded-md bg-primary py-3 text-body font-bold text-card">
            বিল সংরক্ষণ
          </button>
        </div>
      </div>
    </div>
  );
}

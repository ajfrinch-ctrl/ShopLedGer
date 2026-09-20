import { createFileRoute } from "@tanstack/react-router";
import { AdminActions } from "@/components/admin-actions";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { stockOf } from "@/lib/calc";
import { bnDate, bnNum, money, todayKey } from "@/lib/format";
import { canManage, isSystemAdmin, useShop } from "@/lib/store";
import type { Product, StockAdjustment } from "@/lib/types";

export const Route = createFileRoute("/stock")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <StockPage />
      </AppShell>
    </RequireAuth>
  ),
});

function StockPage() {
  const products = useShop((s) => s.products);
  const sales = useShop((s) => s.sales);
  const purchases = useShop((s) => s.purchases);
  const adjustments = useShop((s) => s.adjustments);
  const addProduct = useShop((s) => s.addProduct);
  const updateProduct = useShop((s) => s.updateProduct);
  const deleteProduct = useShop((s) => s.deleteProduct);
  const addAdjustment = useShop((s) => s.addAdjustment);
  const updateAdjustment = useShop((s) => s.updateAdjustment);
  const deleteAdjustment = useShop((s) => s.deleteAdjustment);
  const user = useShop((s) => s.user);
  const manage = canManage(user?.role);
  const masterAdmin = isSystemAdmin(user?.role);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjId, setAdjId] = useState<string | null>(null);
  const [editAdjustment, setEditAdjustment] = useState<StockAdjustment | null>(null);

  const rows = useMemo(() => {
    return products
      .map((p) => {
        const qty = stockOf(p, sales, purchases, adjustments);
        return { p, qty, value: qty * p.purchasePrice, low: qty <= p.minStock };
      })
      .filter((r) => !q.trim() || r.p.name.includes(q) || r.p.code.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => Number(b.low) - Number(a.low));
  }, [products, sales, purchases, adjustments, q]);

  const low = rows.filter((r) => r.low).length;

  return (
    <div>
      <PageTitle title="স্টক" subtitle={low ? `${bnNum(low)}টি পণ্যের স্টক কম` : "সব পণ্য পর্যাপ্ত"} />
      <div className="flex gap-2 px-4 pt-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="পণ্য খুঁজুন"
          className="flex-1 rounded-md border border-line px-3 py-2.5 text-input"
        />
        {manage ? (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-md bg-primary px-3 text-card"
            aria-label="পণ্য যোগ"
          >
            <Plus size={18} />
          </button>
        ) : null}
      </div>
      <ul className="mt-2">
        {rows.map(({ p, qty, value, low: isLow }) => (
          <li key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-body font-bold">{p.name}</p>
              <p className="text-caption text-muted">
                {p.company} • {p.code} • {user?.role === "salesman" ? p.unit : `${money(p.salePrice)}/${p.unit}`}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-body font-bold tabular ${isLow ? "text-danger" : "text-primary"}`}>
                {bnNum(qty)} {p.unit}
              </p>
              {user?.role !== "salesman" ? <p className="text-caption text-muted tabular">{money(value)}</p> : null}
            </div>
            {manage ? (
              <button type="button" onClick={() => setAdjId(p.id)} className="text-caption font-bold text-primary">
                সমন্বয়
              </button>
            ) : null}
            {masterAdmin ? (
              <AdminActions
                onEdit={() => setEditProduct(p)}
                onDelete={() => {
                  if (!window.confirm(`${p.name} এবং এর সংশ্লিষ্ট লেনদেন মুছে ফেলবেন?`)) return;
                  if (deleteProduct(p.id)) toast.success("পণ্য ও সংশ্লিষ্ট হিসাব মুছে ফেলা হয়েছে, স্টক পুনরায় গণনা হয়েছে");
                  else toast.error("পণ্য মুছে ফেলা যায়নি");
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {addOpen ? (
        <ProductForm
          title="নতুন পণ্য"
          onClose={() => setAddOpen(false)}
          onSave={(data) => {
            addProduct(data);
            setAddOpen(false);
            toast.success("পণ্য যোগ হয়েছে");
          }}
        />
      ) : null}
      {editProduct ? (
        <ProductForm
          title="পণ্য সম্পাদনা"
          initial={editProduct}
          onClose={() => setEditProduct(null)}
          onSave={(data) => {
            if (updateProduct(editProduct.id, data)) {
              setEditProduct(null);
              toast.success("পণ্যের তথ্য আপডেট হয়েছে");
            } else {
              toast.error("পণ্যের তথ্য আপডেট করা যায়নি");
            }
          }}
        />
      ) : null}

      {adjId ? (
        <AdjustForm
          productId={adjId}
          onClose={() => setAdjId(null)}
          onSave={(qty, reason) => {
            const p = products.find((x) => x.id === adjId);
            if (!p) return;
            addAdjustment({
              date: todayKey(),
              productId: p.id,
              productName: p.name,
              quantity: qty,
              reason,
            });
            setAdjId(null);
            toast.success("স্টক সমন্বয় হয়েছে");
          }}
        />
      ) : null}

      {masterAdmin ? (
        <section className="mt-5 border-t border-line pt-4">
          <h3 className="px-4 text-body font-bold">স্টক সমন্বয়ের ইতিহাস</h3>
          <ul className="mt-2">
            {adjustments.map((adjustment) => (
              <li key={adjustment.id} className="flex items-center gap-2 border-b border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body font-normal">{adjustment.productName}</p>
                  <p className="text-caption text-muted">{bnDate(adjustment.date)} • {adjustment.reason}</p>
                </div>
                <p className={`text-body font-bold tabular ${adjustment.quantity >= 0 ? "text-primary" : "text-danger"}`}>
                  {adjustment.quantity >= 0 ? "+" : ""}{bnNum(adjustment.quantity)}
                </p>
                <AdminActions
                  onEdit={() => setEditAdjustment(adjustment)}
                  onDelete={() => {
                    if (!window.confirm("এই স্টক সমন্বয় মুছে ফেলবেন?")) return;
                    if (deleteAdjustment(adjustment.id)) toast.success("স্টক সমন্বয় মুছে ফেলা হয়েছে, স্টক পুনরায় গণনা হয়েছে");
                    else toast.error("স্টক সমন্বয় মুছে ফেলা যায়নি");
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {editAdjustment ? (
        <AdjustmentEditModal
          adjustment={editAdjustment}
          onClose={() => setEditAdjustment(null)}
          onSave={(patch) => {
            if (updateAdjustment(editAdjustment.id, patch)) {
              setEditAdjustment(null);
              toast.success("স্টক সমন্বয় আপডেট হয়েছে, স্টক পুনরায় গণনা হয়েছে");
            } else {
              toast.error("স্টক সমন্বয় আপডেট করা যায়নি");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ProductForm({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial?: Product;
  onClose: () => void;
  onSave: (p: {
    code: string;
    name: string;
    company: string;
    unit: string;
    purchasePrice: number;
    salePrice: number;
    openingStock: number;
    minStock: number;
  }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "বস্তা");
  const [buy, setBuy] = useState(initial?.purchasePrice ?? 0);
  const [sell, setSell] = useState(initial?.salePrice ?? 0);
  const [open, setOpen] = useState(initial?.openingStock ?? 0);
  const [min, setMin] = useState(initial?.minStock ?? 5);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <Field label="নাম" value={name} onChange={setName} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="কোম্পানি" value={company} onChange={setCompany} />
          <Field label="কোড" value={code} onChange={setCode} />
        </div>
        <label className="block text-caption font-bold">
          একক
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input">
            <option>বস্তা</option>
            <option>কেজি</option>
            <option>পিস</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Num label="ক্রয় মূল্য" value={buy} onChange={setBuy} />
          <Num label="বিক্রয় মূল্য" value={sell} onChange={setSell} />
          <Num label="ওপেনিং স্টক" value={open} onChange={setOpen} />
          <Num label="মিন স্টক" value={min} onChange={setMin} />
        </div>
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return toast.error("পণ্যের নাম দিন");
            onSave({
              code: code || name.slice(0, 3).toUpperCase(),
              name: name.trim(),
              company: company.trim() || "লোকাল",
              unit,
              purchasePrice: buy,
              salePrice: sell,
              openingStock: open,
              minStock: min,
            });
          }}
          className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
        >
          সংরক্ষণ
        </button>
      </div>
    </Modal>
  );
}

function AdjustmentEditModal({
  adjustment,
  onClose,
  onSave,
}: {
  adjustment: StockAdjustment;
  onClose: () => void;
  onSave: (patch: Partial<Omit<StockAdjustment, "id" | "createdAt">>) => void;
}) {
  const [date, setDate] = useState(adjustment.date);
  const [quantity, setQuantity] = useState(adjustment.quantity);
  const [reason, setReason] = useState(adjustment.reason);
  return (
    <Modal title="স্টক সমন্বয় সম্পাদনা" onClose={onClose}>
      <div className="space-y-3">
        <input type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
        <Num label="পরিমাণ" value={quantity} onChange={setQuantity} />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="কারণ" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
        <button type="button" onClick={() => onSave({ date, quantity, reason })} className="w-full rounded-md bg-primary py-3 text-body font-bold text-card">সংরক্ষণ</button>
      </div>
    </Modal>
  );
}

function AdjustForm({
  productId,
  onClose,
  onSave,
}: {
  productId: string;
  onClose: () => void;
  onSave: (qty: number, reason: string) => void;
}) {
  const p = useShop((s) => s.products.find((x) => x.id === productId));
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("গণনা সংশোধন");
  if (!p) return null;
  return (
    <Modal title={`${p.name} সমন্বয়`} onClose={onClose}>
      <p className="mb-3 text-caption text-muted">ধনাত্মক = স্টক বাড়বে, ঋণাত্মক = কমবে</p>
      <Num label="পরিমাণ" value={qty} onChange={setQty} />
      <label className="mt-3 block text-caption font-bold">
        কারণ
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input">
          <option>গণনা সংশোধন</option>
          <option>ক্ষয়</option>
          <option>নষ্ট</option>
          <option>অন্যান্য</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          if (!qty) return toast.error("পরিমাণ দিন");
          onSave(qty, reason);
        }}
        className="mt-4 w-full rounded-md bg-primary py-3 text-body font-bold text-card"
      >
        সমন্বয় করুন
      </button>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-fg/50 p-3 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-heading">{title}</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-caption font-bold">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input" />
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-caption font-bold">
      {label}
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input"
      />
    </label>
  );
}

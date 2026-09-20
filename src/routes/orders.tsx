import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { ReceiptModal } from "@/components/receipt-modal";
import { bnDate, bnNum, money } from "@/lib/format";
import { useShop } from "@/lib/store";
import type { OrderItem, Sale } from "@/lib/types";

export const Route = createFileRoute("/orders")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <OrdersPage />
      </AppShell>
    </RequireAuth>
  ),
});

const STATUS: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  accepted: "গ্রহণ",
  delivered: "ডেলিভারি",
  cancelled: "বাতিল",
};

function OrdersPage() {
  const user = useShop((s) => s.user);
  const isCustomer = user?.role === "customer";
  const orders = useShop((s) => s.orders);
  const products = useShop((s) => s.products);
  const addOrder = useShop((s) => s.addOrder);
  const setOrderStatus = useShop((s) => s.setOrderStatus);
  const fulfillOrder = useShop((s) => s.fulfillOrder);
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const visible = isCustomer ? orders.filter((o) => o.customerId === user?.customerId) : orders;

  const add = (p: (typeof products)[number]) => {
    setCart((c) => {
      const ex = c.find((i) => i.productId === p.id);
      if (ex) return c.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.salePrice } : i));
      return [
        ...c,
        { productId: p.id, productName: p.name, unit: p.unit, quantity: 1, salePrice: p.salePrice, total: p.salePrice },
      ];
    });
  };

  const total = useMemo(() => cart.reduce((a, i) => a + i.total, 0), [cart]);

  return (
    <div>
      <PageTitle title="অর্ডার" subtitle={isCustomer ? "দোকানে অর্ডার পাঠান" : "ক্রেতার অর্ডার গ্রহণ করুন"} />
      {isCustomer ? (
        <div className="px-4 pt-3">
          <button type="button" onClick={() => setOpen(true)} className="w-full rounded-md bg-primary py-3 text-sm font-bold text-card">
            নতুন অর্ডার
          </button>
        </div>
      ) : null}
      <ul className="mt-3">
        {visible.map((o) => (
          <li key={o.id} className="border-b border-line px-4 py-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{o.customerName}</p>
                <p className="text-[11px] text-muted">
                  {bnDate(o.createdAt.slice(0, 10))} • {bnNum(o.items.length)}টি পণ্য
                </p>
                <p className="mt-1 text-xs text-muted">{o.items.map((i) => `${i.productName} × ${bnNum(i.quantity)}`).join(", ")}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular">{money(o.total)}</p>
                <p className="text-[11px] text-primary">{STATUS[o.status]}</p>
              </div>
            </div>
            {!isCustomer && o.status !== "delivered" && o.status !== "cancelled" ? (
              <div className="mt-2 flex gap-2">
                {o.status === "pending" ? (
                  <button type="button" onClick={() => setOrderStatus(o.id, "accepted")} className="rounded-full bg-mint-2 px-3 py-1 text-xs font-semibold text-primary">
                    গ্রহণ
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const sale = fulfillOrder(o.id);
                    if (sale) {
                      toast.success("বিক্রি হয়েছে, বাকিতে যোগ");
                      setReceipt(sale);
                    }
                  }}
                  className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-card"
                >
                  ডেলিভারি → বিক্রি
                </button>
                <button type="button" onClick={() => setOrderStatus(o.id, "cancelled")} className="rounded-full bg-bg px-3 py-1 text-xs font-semibold text-danger">
                  বাতিল
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {!visible.length ? <p className="p-8 text-center text-sm text-muted">কোনো অর্ডার নেই</p> : null}
      </ul>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end bg-fg/50 sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          <div className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-xl bg-card sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-bold">নতুন অর্ডার</h2>
              <button type="button" aria-label="বন্ধ" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {products.map((p) => (
                <button key={p.id} type="button" onClick={() => add(p)} className="flex w-full items-center justify-between border-b border-line py-2.5 text-left">
                  <span className="text-sm">{p.name}</span>
                  <span className="text-sm font-semibold tabular">{money(p.salePrice)}</span>
                </button>
              ))}
              {cart.length ? (
                <ul className="mt-3 space-y-2">
                  {cart.map((i) => (
                    <li key={i.productId} className="flex items-center justify-between rounded-md bg-mint px-3 py-2">
                      <span className="text-sm">{i.productName}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCart((c) =>
                              c
                                .map((x) =>
                                  x.productId === i.productId
                                    ? { ...x, quantity: x.quantity - 1, total: (x.quantity - 1) * x.salePrice }
                                    : x,
                                )
                                .filter((x) => x.quantity > 0),
                            )
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm font-bold tabular">{bnNum(i.quantity)}</span>
                        <button type="button" onClick={() => add(products.find((p) => p.id === i.productId)!)}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট" className="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm" rows={2} />
            </div>
            <div className="border-t border-line p-4">
              <p className="mb-2 flex justify-between text-sm font-bold">
                মোট <span className="tabular">{money(total)}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!cart.length || !user?.customerId) return toast.error("পণ্য যোগ করুন");
                  addOrder({
                    customerId: user.customerId,
                    customerName: user.name,
                    items: cart,
                    total,
                    note: note.trim() || undefined,
                  });
                  setOpen(false);
                  setCart([]);
                  setNote("");
                  toast.success("অর্ডার পাঠানো হয়েছে");
                }}
                className="w-full rounded-md bg-primary py-3 text-sm font-bold text-card"
              >
                অর্ডার পাঠান
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {receipt ? <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

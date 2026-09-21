import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminActions } from "@/components/admin-actions";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { allCustomerDues, supplierDue } from "@/lib/calc";
import { bnDate, bnNum, money, todayKey } from "@/lib/format";
import { canManage, isSystemAdmin, useShop } from "@/lib/store";
import type { Collection } from "@/lib/types";

export const Route = createFileRoute("/collections")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <CollectionsPage />
      </AppShell>
    </RequireAuth>
  ),
});

function CollectionsPage() {
  const user = useShop((s) => s.user);
  const customers = useShop((s) => s.customers);
  const sales = useShop((s) => s.sales);
  const purchases = useShop((s) => s.purchases);
  const collections = useShop((s) => s.collections);
  const addCollection = useShop((s) => s.addCollection);
  const updateCollection = useShop((s) => s.updateCollection);
  const deleteCollection = useShop((s) => s.deleteCollection);
  const showBuy = canManage(user?.role);
  const masterAdmin = isSystemAdmin(user?.role);
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [pick, setPick] = useState<{ id: string; name: string; due: number } | null>(null);
  const [editCollection, setEditCollection] = useState<Collection | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [amount, setAmount] = useState(0);

  const dues = useMemo(
    () => allCustomerDues(customers, sales, collections),
    [customers, sales, collections],
  );
  const filteredDues = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return [];
    return dues.filter(({ customer }) => customer.name.toLowerCase().includes(query) || customer.phone.includes(query));
  }, [dues, customerQuery]);

  const suppliers = useMemo(() => {
    const names = [...new Set(purchases.map((p) => p.supplier))];
    return names
      .map((name) => ({ name, due: supplierDue(name, purchases, collections) }))
      .filter((s) => s.due > 0.5)
      .sort((a, b) => b.due - a.due);
  }, [purchases, collections]);

  const recent = collections.filter((c) => (tab === "customer" ? c.kind === "customer" : c.kind === "supplier"));

  const save = () => {
    if (!pick || amount <= 0) return toast.error("পরিমাণ দিন");
    addCollection({
      date: todayKey(),
      partyId: pick.id,
      partyName: pick.name,
      kind: tab,
      amount: Math.min(amount, pick.due),
      method: "নগদ",
    });
    toast.success("সংরক্ষণ হয়েছে");
    setPick(null);
    setAmount(0);
  };

  return (
    <div>
      <PageTitle title="বাকি আদায়" subtitle="ক্রেতার পাওনা ও সাপ্লায়ার দেনা" />
      {showBuy ? (
        <div className="mx-4 mt-3 grid grid-cols-2 rounded-md bg-mint-2 p-1">
          <button
            type="button"
            onClick={() => setTab("customer")}
            className={`rounded-sm py-2 text-body font-bold ${tab === "customer" ? "bg-card text-primary" : "text-muted"}`}
          >
            ক্রেতা
          </button>
          <button
            type="button"
            onClick={() => setTab("supplier")}
            className={`rounded-sm py-2 text-body font-bold ${tab === "supplier" ? "bg-card text-primary" : "text-muted"}`}
          >
            সাপ্লায়ার
          </button>
        </div>
      ) : null}

      {tab === "customer" ? (
        <div className="mx-4 mt-3">
          <input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="নাম বা মোবাইল দিয়ে ক্রেতা খুঁজুন" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
        </div>
      ) : null}
      <div className="mt-3">
        {tab === "customer"
          ? filteredDues.map(({ customer, due }) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  setPick({ id: customer.id, name: customer.name, due });
                  setAmount(due);
                }}
                className="flex w-full items-center justify-between border-b border-line px-4 py-3.5 text-left"
              >
                <div>
                  <p className="text-body font-bold">{customer.name}</p>
                  <p className="text-caption text-muted">{customer.phone}</p>
                </div>
                <p className="text-body font-bold tabular text-danger">{money(due)}</p>
              </button>
            ))
          : suppliers.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  setPick({ id: s.name, name: s.name, due: s.due });
                  setAmount(s.due);
                }}
                className="flex w-full items-center justify-between border-b border-line px-4 py-3.5 text-left"
              >
                <p className="text-body font-bold">{s.name}</p>
                <p className="text-body font-bold tabular text-warn">{money(s.due)}</p>
              </button>
            ))}
        {(tab === "customer" ? filteredDues : suppliers).length === 0 ? (
          <p className="p-8 text-center text-body text-muted">{tab === "customer" && !customerQuery.trim() ? "নাম বা মোবাইল দিয়ে ক্রেতা খুঁজুন" : "কোনো বাকি নেই"}</p>
        ) : null}
      </div>

      <h3 className="mt-5 px-4 text-body font-bold">সাম্প্রতিক আদায় ({bnNum(recent.length)})</h3>
      <ul className="mt-1">
        {(masterAdmin ? recent : recent.slice(0, 12)).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-body font-normal">{c.partyName}</p>
              <p className="text-caption text-muted">লেনদেন: {c.id}</p>
              <p className="text-caption text-muted">
                {bnDate(c.date)} • {c.method}
              </p>
            </div>
            <p className="text-body font-bold tabular text-primary">{money(c.amount)}</p>
            {masterAdmin ? (
              <AdminActions
                onEdit={() => setEditCollection(c)}
                onDelete={() => {
                  if (!window.confirm("এই জমা/পরিশোধ লেনদেন মুছে ফেলবেন?")) return;
                  if (deleteCollection(c.id)) toast.success("লেনদেন মুছে ফেলা হয়েছে, বাকি পুনরায় গণনা হয়েছে");
                  else toast.error("লেনদেন মুছে ফেলা যায়নি");
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {tab === "customer" && canManage(user?.role) ? (
        <p className="px-4 py-3 text-center text-caption">
          <Link to="/customers" className="font-bold text-primary">
            সব ক্রেতার খাতা
          </Link>
        </p>
      ) : null}

      {editCollection ? (
        <CollectionEditModal
          collection={editCollection}
          onClose={() => setEditCollection(null)}
          onSave={(patch) => {
            if (updateCollection(editCollection.id, patch)) {
              setEditCollection(null);
              toast.success("লেনদেন আপডেট হয়েছে, বাকি পুনরায় গণনা হয়েছে");
            } else {
              toast.error("লেনদেন আপডেট করা যায়নি");
            }
          }}
        />
      ) : null}
      {pick ? (
        <div className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center" onClick={() => setPick(null)}>
          <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-heading">{pick.name}</h2>
            <p className="mt-1 text-body text-muted">বাকি {money(pick.due)}</p>
            <input
              type="number"
              min={0}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="mt-3 w-full rounded-md border border-line px-3 py-2.5 text-input"
            />
            <button type="button" onClick={save} className="mt-3 w-full rounded-md bg-primary py-3 text-body font-bold text-card">
              {tab === "customer" ? "আদায় সংরক্ষণ" : "পরিশোধ সংরক্ষণ"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CollectionEditModal({
  collection,
  onClose,
  onSave,
}: {
  collection: Collection;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Collection, "id" | "createdAt">>) => void;
}) {
  const [date, setDate] = useState(collection.date);
  const [amount, setAmount] = useState(collection.amount);
  const [method, setMethod] = useState(collection.method);
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-heading">লেনদেন সম্পাদনা</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}>×</button>
        </div>
        <div className="space-y-3">
          <input type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
          <input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="পদ্ধতি" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
          <button type="button" onClick={() => onSave({ date, amount, method })} className="w-full rounded-md bg-primary py-3 text-body font-bold text-card">সংরক্ষণ</button>
        </div>
      </div>
    </div>
  );
}

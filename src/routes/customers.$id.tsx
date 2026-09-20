import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ReceiptModal } from "@/components/receipt-modal";
import { customerDue } from "@/lib/calc";
import { bnDate, isBangladeshMobile, money, normalizePhone, todayKey, whatsappNumber } from "@/lib/format";
import { SHOP } from "@/lib/shop";
import { canManage, useShop } from "@/lib/store";
import type { Sale } from "@/lib/types";

export const Route = createFileRoute("/customers/$id")({
  ssr: false,
  component: Profile,
});

function Profile() {
  const { id } = Route.useParams();
  const customer = useShop((s) => s.customers.find((c) => c.id === id));
  const allCustomers = useShop((s) => s.customers);
  const user = useShop((s) => s.user);
  const allSales = useShop((s) => s.sales);
  const allCol = useShop((s) => s.collections);
  // Zustand selectors must return stable snapshots, not a new filtered array.
  const sales = useMemo(() => allSales.filter((s) => s.customerId === id), [allSales, id]);
  const collections = useMemo(
    () => allCol.filter((c) => c.kind === "customer" && c.partyId === id),
    [allCol, id],
  );
  const addCollection = useShop((s) => s.addCollection);
  const updateCustomer = useShop((s) => s.updateCustomer);
  const [amount, setAmount] = useState(0);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const due = customer ? customerDue(customer.id, allSales, allCol) : 0;

  const ledger = useMemo(() => {
    const rows: {
      key: string;
      date: string;
      label: string;
      debit: number;
      credit: number;
      sale?: Sale;
    }[] = [];
    for (const s of sales) {
      rows.push({
        key: s.id,
        date: s.date,
        label: s.billNo,
        debit: s.total,
        credit: s.paid,
        sale: s,
      });
    }
    for (const c of collections) {
      rows.push({
        key: c.id,
        date: c.date,
        label: `আদায় • ${c.method}`,
        debit: 0,
        credit: c.amount,
      });
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    let bal = 0;
    return rows.map((r) => {
      bal += r.debit - r.credit;
      return { ...r, bal };
    });
  }, [sales, collections]);

  if (!customer || (user?.role === "customer" && user.customerId !== id)) {
    return (
      <div className="p-6 text-center text-body">
        ক্রেতা পাওয়া যায়নি। <Link to="/customers">ফিরে যান</Link>
      </div>
    );
  }

  const collect = () => {
    if (amount <= 0) return toast.error("পরিমাণ দিন");
    addCollection({
      date: todayKey(),
      partyId: customer.id,
      partyName: customer.name,
      kind: "customer",
      amount,
      method: "নগদ",
    });
    setAmount(0);
    toast.success("আদায় সংরক্ষণ হয়েছে");
  };

  const openEdit = () => {
    setEditName(customer.name);
    setEditPhone(customer.phone);
    setEditAddress(customer.address);
    setEditOpen(true);
  };

  const saveEdit = () => {
    const name = editName.trim();
    const phone = normalizePhone(editPhone);
    if (!name) return toast.error("নাম দিন");
    if (!isBangladeshMobile(phone)) return toast.error("সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন");
    if (allCustomers.some((c) => c.id !== customer.id && normalizePhone(c.phone) === phone)) {
      return toast.error("এই মোবাইল নম্বরটি অন্য ক্রেতার আছে");
    }
    updateCustomer(customer.id, { name, phone, address: editAddress.trim() });
    setEditOpen(false);
    toast.success("ক্রেতার তথ্য আপডেট হয়েছে");
  };

  const wa = whatsappNumber(customer.phone);
  const waText = encodeURIComponent(
    `${SHOP.name}\nপ্রিয় ${customer.name},\nআপনার বর্তমান বাকি ${money(due)}।\n${SHOP.phones[0]}`,
  );
  const canEdit = canManage(user?.role);

  return (
    <div className="px-4 pt-4">
      <Link to="/customers" className="mb-3 inline-block text-body font-bold text-primary">
        ← ক্রেতার তালিকা
      </Link>
      <div className="rounded-xl bg-primary p-5 text-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-heading font-bold">{customer.name}</h1>
            <p className="mt-1 text-body text-mint-2">
              {customer.phone} {customer.address ? `• ${customer.address}` : ""}
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={openEdit}
              aria-label="ক্রেতার তথ্য সম্পাদনা"
              className="shrink-0 rounded-md bg-card/15 p-2 text-card"
            >
              <Pencil size={16} />
            </button>
          ) : null}
        </div>
        <p className="mt-4 text-caption text-mint-2">বর্তমান বাকি</p>
        <p className="text-heading font-bold tabular">{money(due)}</p>
      </div>

      {due > 0 && user?.role !== "customer" ? (
        <div className="mt-4 rounded-xl border border-line bg-card p-4">
          <p className="mb-2 text-body font-bold">বাকি আদায়</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder="পরিমাণ"
              className="flex-1 rounded-md border border-line px-3 py-2.5 text-input"
            />
            <button
              type="button"
              onClick={() => setAmount(due)}
              className="rounded-md bg-mint-2 px-3 text-caption font-bold text-primary"
            >
              সব
            </button>
            <button
              type="button"
              onClick={collect}
              className="rounded-md bg-primary px-4 text-body font-bold text-card"
            >
              জমা
            </button>
          </div>
          {wa.length >= 10 ? (
            <a
              href={`https://wa.me/${wa}?text=${waText}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-center text-caption font-bold text-primary"
            >
              WhatsApp-এ তাগাদা পাঠান
            </a>
          ) : null}
        </div>
      ) : null}

      <h3 className="mt-5 mb-2 text-body font-bold">খাতা</h3>
      <p className="mb-3 text-caption text-muted">
        বিলে চাপলে কেনা পণ্যের সম্পূর্ণ রসিদ দেখতে পাবেন।
      </p>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {ledger.length ? (
          ledger
            .slice()
            .reverse()
            .map((r) => (
              <button
                key={r.key}
                type="button"
                disabled={!r.sale}
                aria-label={r.sale ? `${r.label} — রসিদ দেখুন` : undefined}
                onClick={() => r.sale && setReceipt(r.sale)}
                className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-0 enabled:hover:bg-mint enabled:focus-visible:outline-2 enabled:focus-visible:outline-primary"
              >
                <div>
                  <p className="text-body font-normal">{r.label}</p>
                  <p className="text-caption text-muted">{bnDate(r.date)}</p>
                  {r.sale ? (
                    <p className="mt-1 text-caption font-bold text-primary">রসিদ দেখুন →</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p
                    className={`text-body font-bold tabular ${r.debit ? "text-fg" : "text-primary"}`}
                  >
                    {r.debit ? money(r.debit) : `+ ${money(r.credit)}`}
                  </p>
                  <p className="text-caption text-muted tabular">ব্যালেন্স {money(r.bal)}</p>
                </div>
              </button>
            ))
        ) : (
          <p className="p-6 text-center text-body text-muted">এখনও কোনো লেনদেন নেই</p>
        )}
      </div>

      {editOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-heading font-bold">ক্রেতার তথ্য সম্পাদনা</h2>
              <button type="button" aria-label="বন্ধ" onClick={() => setEditOpen(false)}>
                ×
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="নাম"
                className="w-full rounded-md border border-line px-3 py-2.5 text-input"
              />
              <div>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="মোবাইল / WhatsApp"
                  inputMode="tel"
                  className="w-full rounded-md border border-line px-3 py-2.5 text-input"
                />
                <p className="mt-1 text-caption text-muted">এই নম্বরেই WhatsApp বার্তা যাবে</p>
              </div>
              <textarea
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="ঠিকানা"
                rows={2}
                className="w-full resize-none rounded-md border border-line px-3 py-2.5 text-input"
              />
              <button
                type="button"
                onClick={saveEdit}
                className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
              >
                সংরক্ষণ
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {receipt ? <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

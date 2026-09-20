import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, RequireAuth } from "@/components/app-shell";
import { ReceiptModal } from "@/components/receipt-modal";
import { customerDue } from "@/lib/calc";
import { bnDate, money, todayKey } from "@/lib/format";
import { SHOP } from "@/lib/shop";
import { useShop } from "@/lib/store";
import type { Sale } from "@/lib/types";

export const Route = createFileRoute("/customers/$id")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <Profile />
      </AppShell>
    </RequireAuth>
  ),
});

function Profile() {
  const { id } = Route.useParams();
  const customer = useShop((s) => s.customers.find((c) => c.id === id));
  const sales = useShop((s) => s.sales.filter((x) => x.customerId === id));
  const collections = useShop((s) => s.collections.filter((c) => c.kind === "customer" && c.partyId === id));
  const allSales = useShop((s) => s.sales);
  const allCol = useShop((s) => s.collections);
  const addCollection = useShop((s) => s.addCollection);
  const [amount, setAmount] = useState(0);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const due = customer ? customerDue(customer.id, allSales, allCol) : 0;

  const ledger = useMemo(() => {
    const rows: { key: string; date: string; label: string; debit: number; credit: number; sale?: Sale }[] = [];
    for (const s of sales) {
      rows.push({ key: s.id, date: s.date, label: s.billNo, debit: s.total, credit: s.paid, sale: s });
    }
    for (const c of collections) {
      rows.push({ key: c.id, date: c.date, label: `আদায় • ${c.method}`, debit: 0, credit: c.amount });
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    let bal = 0;
    return rows.map((r) => {
      bal += r.debit - r.credit;
      return { ...r, bal };
    });
  }, [sales, collections]);

  if (!customer) {
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

  const wa = customer.phone.replace(/\D/g, "");
  const waText = encodeURIComponent(
    `${SHOP.name}\nপ্রিয় ${customer.name},\nআপনার বর্তমান বাকি ${money(due)}।\n${SHOP.phones[0]}`,
  );

  return (
    <div className="px-4 pt-4">
      <div className="rounded-xl bg-primary p-5 text-card">
        <p className="text-heading font-bold">{customer.name}</p>
        <p className="mt-1 text-body text-mint-2">
          {customer.phone} {customer.address ? `• ${customer.address}` : ""}
        </p>
        <p className="mt-4 text-caption text-mint-2">বর্তমান বাকি</p>
        <p className="text-heading font-bold tabular">{money(due)}</p>
      </div>

      {due > 0 ? (
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
            <button type="button" onClick={() => setAmount(due)} className="rounded-md bg-mint-2 px-3 text-caption font-bold text-primary">
              সব
            </button>
            <button type="button" onClick={collect} className="rounded-md bg-primary px-4 text-body font-bold text-card">
              জমা
            </button>
          </div>
          {wa.length >= 10 ? (
            <a
              href={`https://wa.me/88${wa}?text=${waText}`}
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
                onClick={() => r.sale && setReceipt(r.sale)}
                className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left last:border-0"
              >
                <div>
                  <p className="text-body font-normal">{r.label}</p>
                  <p className="text-caption text-muted">{bnDate(r.date)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-body font-bold tabular ${r.debit ? "text-fg" : "text-primary"}`}>
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
      {receipt ? <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

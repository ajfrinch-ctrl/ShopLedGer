import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ReceiptModal } from "@/components/receipt-modal";
import { customerDue } from "@/lib/calc";
import { bnDate, money, todayKey } from "@/lib/format";
import { SHOP } from "@/lib/shop";
import { useShop } from "@/lib/store";
import type { Sale } from "@/lib/types";

export const Route = createFileRoute("/customers/$id")({
  ssr: false,
  component: Profile,
});

function Profile() {
  const { id } = Route.useParams();
  const customer = useShop((s) => s.customers.find((c) => c.id === id));
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
  const [amount, setAmount] = useState(0);
  const [receipt, setReceipt] = useState<Sale | null>(null);

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

  const wa = customer.phone.replace(/\D/g, "");
  const waText = encodeURIComponent(
    `${SHOP.name}\nপ্রিয় ${customer.name},\nআপনার বর্তমান বাকি ${money(due)}।\n${SHOP.phones[0]}`,
  );

  return (
    <div className="px-4 pt-4">
      <Link to="/customers" className="mb-3 inline-block text-body font-bold text-primary">
        ← ক্রেতার তালিকা
      </Link>
      <div className="rounded-xl bg-primary p-5 text-card">
        <h1 className="text-heading font-bold">{customer.name}</h1>
        <p className="mt-1 text-body text-mint-2">
          {customer.phone} {customer.address ? `• ${customer.address}` : ""}
        </p>
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
      {receipt ? <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

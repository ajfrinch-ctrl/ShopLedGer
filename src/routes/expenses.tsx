import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { bnDate, money, todayKey } from "@/lib/format";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/expenses")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <ExpensesPage />
      </AppShell>
    </RequireAuth>
  ),
});

const CATS = ["ভাড়া", "বিদ্যুৎ", "যাতায়াত", "বেতন", "প্যাকেজিং", "অন্যান্য", "মালিকের উত্তোলন"];

function ExpensesPage() {
  const user = useShop((s) => s.user);
  const expenses = useShop((s) => s.expenses);
  const addExpense = useShop((s) => s.addExpense);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(CATS[0]);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayKey());

  const employee = user?.role === "salesman";
  const categories = employee ? CATS.filter((c) => c !== "মালিকের উত্তোলন") : CATS;

  return (
    <div>
      <PageTitle title="খরচ" subtitle="দোকান খরচ ও মালিকের উত্তোলন" />
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-body font-bold text-card"
        >
          <Plus size={16} /> নতুন খরচ
        </button>
      </div>
      <ul className="mt-3">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <div>
              <p className="text-body font-bold">{e.category}</p>
              <p className="text-caption text-muted">
                {bnDate(e.date)} • {e.kind === "owner" ? "মালিকের উত্তোলন" : "দোকান খরচ"}
                {e.note ? ` • ${e.note}` : ""}
              </p>
            </div>
            <p className="text-body font-bold tabular">{money(e.amount)}</p>
          </li>
        ))}
      </ul>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-heading">খরচ এন্ট্রি</h2>
              <button type="button" aria-label="বন্ধ" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-md border border-line px-3 py-2.5 text-input">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value) || 0)} placeholder="পরিমাণ" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="নোট (ঐচ্ছিক)" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <button
                type="button"
                onClick={() => {
                  if (!amount) return toast.error("পরিমাণ দিন");
                  addExpense({
                    date,
                    category,
                    amount,
                    kind: category === "মালিকের উত্তোলন" ? "owner" : "shop",
                    note: note.trim() || undefined,
                  });
                  setOpen(false);
                  setAmount(0);
                  setNote("");
                  toast.success("খরচ সংরক্ষণ হয়েছে");
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

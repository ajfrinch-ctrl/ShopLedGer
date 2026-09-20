import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/app-shell";
import { customerDue } from "@/lib/calc";
import { bnNum, money } from "@/lib/format";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/customers/")({
  ssr: false,
  component: CustomersPage,
});

function CustomersPage() {
  const customers = useShop((s) => s.customers);
  const user = useShop((s) => s.user);
  const sales = useShop((s) => s.sales);
  const collections = useShop((s) => s.collections);
  const addCustomer = useShop((s) => s.addCustomer);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const rows = useMemo(() => {
    return customers
      .map((c) => ({ c, due: customerDue(c.id, sales, collections) }))
      .filter(() => user?.role !== "salesman" || q.trim())
      .filter(({ c }) => user?.role !== "customer" || c.id === user.customerId)
      .filter(
        (r) =>
          !q.trim() ||
          r.c.name.includes(q) ||
          r.c.phone.includes(q) ||
          r.c.address.includes(q),
      )
      .sort((a, b) => b.due - a.due);
  }, [customers, sales, collections, q, user?.role, user?.customerId]);

  return (
    <div>
      <PageTitle title="ক্রেতা" subtitle={user?.role === "salesman" ? "সার্চ করে ক্রেতা খুঁজুন" : `${bnNum(customers.length)} জন খাতা`} />
      <div className="flex gap-2 px-4 pt-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="নাম বা মোবাইল"
          className="flex-1 rounded-md border border-line px-3 py-2.5 text-input"
        />
        <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary px-3 text-card" aria-label="নতুন ক্রেতা">
          <Plus size={18} />
        </button>
      </div>
      <ul className="mt-2">
        {rows.map(({ c, due }) => (
          <li key={c.id}>
            <Link to="/customers/$id" params={{ id: c.id }} className="flex items-center gap-3 border-b border-line px-4 py-3.5">
              <div className="flex size-10 items-center justify-center rounded-full bg-mint-2 text-body font-bold text-primary">
                {c.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body font-bold">{c.name}</p>
                <p className="truncate text-caption text-muted">
                  {c.phone} {c.address ? `• ${c.address}` : ""}
                </p>
              </div>
              <p className={`text-body font-bold tabular ${due > 0 ? "text-danger" : "text-primary"}`}>
                {due > 0 ? money(due) : "ক্লিয়ার"}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-heading">নতুন ক্রেতা</h2>
              <button type="button" aria-label="বন্ধ" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="মোবাইল" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঠিকানা" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) return toast.error("নাম দিন");
                  addCustomer({ name: name.trim(), phone: phone.trim(), address: address.trim() });
                  setOpen(false);
                  setName("");
                  setPhone("");
                  setAddress("");
                  toast.success("ক্রেতা যোগ হয়েছে");
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

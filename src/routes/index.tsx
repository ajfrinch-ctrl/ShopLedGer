import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  History,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell, RequireAuth } from "@/components/app-shell";
import { allCustomerDues, profitSummary, stockOf, supplierDue } from "@/lib/calc";
import { bnDate, bnNum, money, monthStartKey, todayKey } from "@/lib/format";
import { canManage, canSeeProfit, useShop } from "@/lib/store";

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <Home />
      </AppShell>
    </RequireAuth>
  ),
});

function Home() {
  const user = useShop((s) => s.user);
  if (user?.role === "customer") return <CustomerHome />;
  return <ShopHome />;
}

function ShopHome() {
  const user = useShop((s) => s.user);
  const sales = useShop((s) => s.sales);
  const purchases = useShop((s) => s.purchases);
  const expenses = useShop((s) => s.expenses);
  const collections = useShop((s) => s.collections);
  const orders = useShop((s) => s.orders);
  const products = useShop((s) => s.products);
  const customers = useShop((s) => s.customers);
  const adjustments = useShop((s) => s.adjustments);
  const showProfit = canSeeProfit(user?.role);
  const showBuy = canManage(user?.role);
  const today = todayKey();
  const month = monthStartKey(today);

  const daily = profitSummary(sales, expenses, today, today);
  const monthly = profitSummary(sales, expenses, month, today);
  const todayCollected = collections
    .filter((c) => c.kind === "customer" && c.date === today)
    .reduce((a, c) => a + c.amount, 0);
  const dues = allCustomerDues(customers, sales, collections);
  const totalDues = dues.reduce((a, d) => a + d.due, 0);
  const suppliers = [...new Set(purchases.map((p) => p.supplier))];
  const supplierDues = suppliers.reduce((a, name) => a + Math.max(0, supplierDue(name, purchases, collections)), 0);
  const stockValue = products.reduce(
    (a, p) => a + stockOf(p, sales, purchases, adjustments) * p.purchasePrice,
    0,
  );
  const pendingOrders = orders.filter((o) => o.status === "pending").slice(0, 4);
  const [orderIndex, setOrderIndex] = useState(0);
  useEffect(() => {
    if (pendingOrders.length <= 1) return;
    const timer = window.setInterval(() => setOrderIndex((i) => (i + 1) % pendingOrders.length), 10000);
    return () => window.clearInterval(timer);
  }, [pendingOrders.length]);
  const activeOrder = pendingOrders[orderIndex % Math.max(pendingOrders.length, 1)];
  const todayBangla = new Date().toLocaleDateString("bn-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const recent = [
    ...sales.map((s) => ({
      key: s.id,
      type: "বিক্রি",
      party: s.customerName,
      amount: s.total,
      date: s.date,
      to: "/sales",
    })),
    ...collections.map((c) => ({
      key: c.id,
      type: c.kind === "customer" ? "আদায়" : "পরিশোধ",
      party: c.partyName,
      amount: c.amount,
      date: c.date,
      to: "/collections",
    })),
    ...expenses.map((e) => ({
      key: e.id,
      type: "খরচ",
      party: e.category,
      amount: e.amount,
      date: e.date,
      to: "/expenses",
    })),
    ...purchases.map((p) => ({
      key: p.id,
      type: "ক্রয়",
      party: p.supplier,
      amount: p.total,
      date: p.date,
      to: "/purchases",
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5);

  return (
    <div className="space-y-5 px-4 pt-4">
      <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
        <div className="px-5 pt-5 pb-4">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-xs bg-mint-2">
                <BarChart3 size={14} className="text-primary" />
              </div>
              <h2 className="text-sm font-bold">আজকের হিসাব</h2>
            </div>
            <span className="rounded-full border border-line bg-bg px-2.5 py-1 text-[11px] font-medium text-muted">
              {todayBangla}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat
              label="বিক্রি"
              value={money(daily.revenue)}
              sub={`${bnNum(daily.saleCount)}টি`}
              icon={<ShoppingCart size={18} />}
              tone="bg-[#fff7ed]"
            />
            <Stat
              label="আদায়"
              value={money(todayCollected)}
              sub="বাকি আদায়"
              icon={<Wallet size={18} />}
              tone="bg-mint"
            />
            <Stat
              label={showBuy ? "খরচ" : "বাকি"}
              value={money(showBuy ? daily.shopExp : totalDues)}
              sub={showBuy ? "দোকান খরচ" : "পাওনা"}
              icon={showBuy ? <Receipt size={18} /> : <ArrowDownLeft size={18} />}
              tone="bg-[#eff6ff]"
            />
          </div>
        </div>
        {showProfit ? (
          <div className="flex items-center justify-between border-t border-mint-3 bg-mint px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-[10px] border border-mint-3 bg-card"><TrendingUp size={16} className="text-primary" /></div>
              <div><p className="text-[11px] font-medium text-primary-dark">আজকের নিট লাভ</p><p className="text-[11px] text-muted">খরচ বাদে</p></div>
            </div>
            <p className={`text-[15px] font-bold tabular ${daily.net < 0 ? "text-danger" : "text-primary"}`}>{money(daily.net)}</p>
          </div>
        ) : null}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h3 className="text-[13px] font-bold">দ্রুত কাজ</h3>
          <span className="rounded-full border border-line bg-card px-2.5 py-1 text-[11px] text-muted">৪টি অপশন</span>
        </div>
        <div className="rounded-xl border border-line bg-card p-4 shadow-card">
          <div className="grid grid-cols-4 gap-3">
            <Quick to="/sales" label="নতুন বিক্রি" className="bg-primary" icon={<Plus size={22} strokeWidth={2.5} />} />
            <Quick to="/collections" label="বাকি আদায়" className="bg-sale" icon={<Wallet size={20} />} />
            {showBuy ? (
              <>
                <Quick to="/purchases" label="ক্রয়" className="bg-info" icon={<ShoppingBag size={20} />} />
                <Quick to="/expenses" label="খরচ" className="bg-warn" icon={<Receipt size={20} />} />
              </>
            ) : (
              <>
                <Quick to="/stock" label="স্টক" className="bg-info" icon={<Package size={20} />} />
                <Quick to="/customers" label="ক্রেতা" className="bg-warn" icon={<Wallet size={20} />} />
              </>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <h3 className="flex items-center gap-2 text-[13px] font-bold"><ClipboardList size={12} /> ক্রেতার অর্ডার</h3>
          <Link to="/orders" className="text-xs font-semibold text-primary">সব দেখুন</Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          {activeOrder ? (
            <Link to="/orders" className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{activeOrder.customerName}</p><p className="text-[11px] text-muted">{activeOrder.items.map((i) => `${i.productName} × ${bnNum(i.quantity)}`).join(", ")}</p></div>
              <span className="ml-3 shrink-0 text-sm font-bold tabular">{money(activeOrder.total)}</span>
            </Link>
          ) : <p className="p-5 text-center text-sm text-muted">নতুন কোনো অর্ডার নেই</p>}
        </div>
      </section>

      {showBuy ? (
      <section>
        <h3 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-bold">
          <Wallet size={12} /> বর্তমান হিসাব
        </h3>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          <Account to="/collections" label="আমরা পাব" detail="ক্রেতার বাকি" value={totalDues} icon={<ArrowDownLeft size={18} />} />
          {showBuy ? (
            <Account to="/purchases" label="আমরা দেব" detail="সাপ্লায়ার পাওনা" value={supplierDues} icon={<ArrowUpRight size={18} />} />
          ) : null}
        </div>
      </section>
      ) : null}

      {showBuy ? (
      <section>
        <h3 className="mb-3 flex items-center gap-2 px-1 text-[13px] font-bold">
          <CalendarDays size={12} /> চলতি মাস
        </h3>
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-card p-4">
          <Chip label="বিক্রি" value={monthly.revenue} />
          {showBuy ? <Chip label="খরচ" value={monthly.shopExp} /> : <Chip label="লাভ" value={monthly.net} />}
          {showProfit ? <Chip label="লাভ" value={monthly.net} highlight /> : <Chip label="স্টক" value={stockValue} />}
        </div>
      </section>
      ) : null}

      <section className="pb-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <h3 className="flex items-center gap-2 text-[13px] font-bold">
            <History size={12} /> সাম্প্রতিক
          </h3>
          <Link to="/reports" className="inline-flex items-center gap-1 rounded-full bg-mint-2 px-3 py-1 text-[11px] font-semibold text-primary">
            সব দেখুন <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-card">
          {recent.length ? (
            <ul className="divide-y divide-line">
              {recent.map((r) => (
                <li key={r.key}>
                  <Link to={r.to} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex size-10 items-center justify-center rounded-sm bg-mint text-primary">
                      <ShoppingCart size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted">
                        {bnDate(r.date)} • {r.type}
                      </p>
                      <p className="truncate text-[13px] font-medium">{r.party}</p>
                    </div>
                    <p className="text-[13px] font-bold tabular">{money(r.amount)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-muted">এখনও কোনো লেনদেন নেই</p>
          )}
        </div>
      </section>
    </div>
  );
}

function CustomerHome() {
  const user = useShop((s) => s.user);
  const sales = useShop((s) => s.sales);
  const orders = useShop((s) => s.orders);
  const due = useShop((s) => (user?.customerId ? s.dueOf(user.customerId) : 0));
  const mine = sales.filter((s) => s.customerId === user?.customerId);
  const pending = orders.filter((o) => o.customerId === user?.customerId && o.status === "pending").length;
  const spent = mine.reduce((a, s) => a + s.total, 0);

  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="rounded-xl bg-primary p-5 text-card shadow-card">
        <p className="text-sm text-mint-2">আসসালামু আলাইকুম</p>
        <h2 className="mt-1 text-xl font-bold">{user?.name}</h2>
        <p className="mt-4 text-[11px] text-mint-2">বর্তমান বাকি</p>
        <p className="text-3xl font-bold tabular">{money(due)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-[11px] text-muted">মোট কেনাকাটা</p>
          <p className="mt-1 text-lg font-bold tabular">{money(spent)}</p>
        </div>
        <div className="rounded-lg border border-line bg-card p-4">
          <p className="text-[11px] text-muted">অপেক্ষমাণ অর্ডার</p>
          <p className="mt-1 text-lg font-bold tabular">{bnNum(pending)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/orders" className="rounded-lg bg-primary py-3 text-center text-sm font-semibold text-card">
          নতুন অর্ডার
        </Link>
        <Link to="/my-dues" className="rounded-lg border border-line bg-card py-3 text-center text-sm font-semibold">
          হিসাব দেখুন
        </Link>
      </div>
      <div className="rounded-xl border border-line bg-card">
        <p className="border-b border-line px-4 py-3 text-sm font-semibold">সাম্প্রতিক বিল</p>
        {mine.slice(0, 5).map((s) => (
          <div key={s.id} className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0">
            <div>
              <p className="text-sm font-medium">{s.billNo}</p>
              <p className="text-[11px] text-muted">{bnDate(s.date)}</p>
            </div>
            <p className="text-sm font-bold tabular">{money(s.total)}</p>
          </div>
        ))}
        {!mine.length ? <p className="p-6 text-center text-sm text-muted">এখনও কোনো বিল নেই</p> : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-md p-3 text-center ${tone}`}>
      <div className="mb-2 flex size-11 items-center justify-center rounded-sm bg-primary text-card">{icon}</div>
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1 text-[13px] font-bold leading-tight tabular">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted">{sub}</p>
    </div>
  );
}

function Quick({
  to,
  label,
  icon,
  className,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  className: string;
}) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2">
      <div className={`flex size-[52px] items-center justify-center rounded-md text-card shadow-md ${className}`}>
        {icon}
      </div>
      <span className="text-center text-[11px] font-medium leading-tight">{label}</span>
    </Link>
  );
}

function Account({
  to,
  label,
  detail,
  value,
  icon,
}: {
  to: string;
  label: string;
  detail: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex size-10 items-center justify-center rounded-sm bg-mint text-primary">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted">{detail}</p>
      </div>
      <p className="text-sm font-bold tabular">{money(value)}</p>
    </Link>
  );
}

function Chip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`mt-1 text-sm font-bold tabular ${highlight ? "text-primary" : ""} ${value < 0 ? "text-danger" : ""}`}>
        {money(value)}
      </p>
    </div>
  );
}

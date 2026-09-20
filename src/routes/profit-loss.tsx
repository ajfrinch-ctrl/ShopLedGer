import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { profitSummary } from "@/lib/calc";
import { money, monthStartKey, todayKey } from "@/lib/format";
import { canSeeProfit, useShop } from "@/lib/store";

export const Route = createFileRoute("/profit-loss")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <PLPage />
      </AppShell>
    </RequireAuth>
  ),
});

function PLPage() {
  const user = useShop((s) => s.user);
  const sales = useShop((s) => s.sales);
  const expenses = useShop((s) => s.expenses);
  const [tab, setTab] = useState<"day" | "month" | "range">("day");
  const [from, setFrom] = useState(monthStartKey());
  const [to, setTo] = useState(todayKey());

  if (!canSeeProfit(user?.role)) {
    return <p className="p-6 text-body">লাভ-ক্ষতি শুধু মালিক ও ব্যবস্থাপকের জন্য।</p>;
  }

  const range =
    tab === "day"
      ? { from: todayKey(), to: todayKey() }
      : tab === "month"
        ? { from: monthStartKey(), to: todayKey() }
        : { from, to };
  const pl = profitSummary(sales, expenses, range.from, range.to);

  return (
    <div>
      <PageTitle title="লাভ-ক্ষতি" subtitle="বিক্রির মুনাফা থেকে দোকান খরচ বাদ" />
      <div className="mx-4 mt-3 grid grid-cols-3 rounded-md bg-mint-2 p-1">
        {(
          [
            ["day", "আজ"],
            ["month", "মাস"],
            ["range", "কাস্টম"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-sm py-2 text-body font-bold ${tab === k ? "bg-card text-primary" : "text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "range" ? (
        <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-line px-3 py-2 text-input" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-line px-3 py-2 text-input" />
        </div>
      ) : null}
      <div className="m-4 space-y-2 rounded-xl border border-line bg-card p-4">
        <Row k="বিক্রি" v={pl.revenue} />
        <Row k="পণ্যের কস্ট" v={pl.cogs} />
        <Row k="গ্রস লাভ" v={pl.gross} />
        <Row k="দোকান খরচ" v={pl.shopExp} />
        <div className="border-t border-line pt-2">
          <Row k="নিট লাভ" v={pl.net} big />
        </div>
        {pl.ownerDraw ? <p className="pt-2 text-caption text-muted">মালিকের উত্তোলন {money(pl.ownerDraw)} — লাভ থেকে বাদ যায়নি</p> : null}
      </div>
    </div>
  );
}

function Row({ k, v, big }: { k: string; v: number; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={big ? "font-bold" : "text-body text-muted"}>{k}</span>
      <span className={`tabular ${big ? "text-heading font-bold text-primary" : "text-body font-bold"} ${v < 0 ? "text-danger" : ""}`}>
        {money(v)}
      </span>
    </div>
  );
}

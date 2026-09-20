import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { customerDue } from "@/lib/calc";
import { bnDate, money } from "@/lib/format";
import { SHOP } from "@/lib/shop";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/my-dues")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <MyDuesPage />
      </AppShell>
    </RequireAuth>
  ),
});

function MyDuesPage() {
  const user = useShop((s) => s.user);
  const sales = useShop((s) => s.sales);
  const collections = useShop((s) => s.collections);
  const id = user?.customerId;
  const due = id ? customerDue(id, sales, collections) : 0;
  const mine = sales.filter((s) => s.customerId === id);
  const cols = collections.filter((c) => c.kind === "customer" && c.partyId === id);

  return (
    <div>
      <PageTitle title="আমার বাকি" subtitle="দোকানের খাতা অনুযায়ী" />
      <div className="m-4 rounded-xl bg-primary p-5 text-card">
        <p className="text-xs text-mint-2">বর্তমান বাকি</p>
        <p className="mt-1 text-3xl font-bold tabular">{money(due)}</p>
        <p className="mt-2 text-[11px] text-mint-2">
          জমা দিতে দোকানে আসুন • {SHOP.phones[0]}
        </p>
      </div>
      <h3 className="px-4 text-sm font-bold">বিল</h3>
      <ul>
        {mine.map((s) => (
          <li key={s.id} className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium">{s.billNo}</p>
              <p className="text-[11px] text-muted">{bnDate(s.date)}</p>
            </div>
            <p className="text-sm font-bold tabular">{money(s.total)}</p>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 px-4 text-sm font-bold">জমা</h3>
      <ul>
        {cols.map((c) => (
          <li key={c.id} className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm">{bnDate(c.date)}</p>
            <p className="text-sm font-bold tabular text-primary">{money(c.amount)}</p>
          </li>
        ))}
        {!cols.length ? <p className="p-4 text-sm text-muted">এখনও কোনো জমা নেই</p> : null}
      </ul>
    </div>
  );
}

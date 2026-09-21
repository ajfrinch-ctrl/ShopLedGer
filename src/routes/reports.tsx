import { createFileRoute } from "@tanstack/react-router";
import { AppShell, RequireAuth } from "@/components/app-shell";
import { monthStartKey, todayKey } from "@/lib/format";
import { canSeeProfit, useShop } from "@/lib/store";
import { useState } from "react";
import { CATALOG, Statement, type Kind } from "@/components/report-statement";

export const Route = createFileRoute("/reports")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <ReportsPage />
      </AppShell>
    </RequireAuth>
  ),
});

function ReportsPage() {
  const user = useShop((s) => s.user);
  const profit = canSeeProfit(user?.role);
  const visible = CATALOG.filter(
    (c) =>
      (!c.manage || profit) &&
      (user?.role !== "salesman" || c.kind === "sales" || c.kind === "stock"),
  );
  const [kind, setKind] = useState<Kind | null>(null);
  const [from, setFrom] = useState(monthStartKey());
  const [to, setTo] = useState(todayKey());

  return (
    <div className="pb-8">
      <div className="bg-primary px-4 pt-4 pb-6 text-card">
        <h1 className="text-heading font-bold">রিপোর্ট সেন্টার</h1>
        <p className="mt-1 text-caption text-mint-2">বিষয় বাছুন → সময়সীমা দিন → স্টেটমেন্ট দেখুন</p>
      </div>
      <div className="space-y-2 px-4 -mt-3">
        {visible.map((def) => {
          const Icon = def.icon;
          return (
            <button
              key={def.kind}
              type="button"
              onClick={() => {
                setKind(def.kind);
                if (def.kind === "sales") {
                  const today = todayKey();
                  setFrom(today);
                  setTo(today);
                }
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-line bg-card p-4 text-left shadow-sm"
            >
              <span className="rounded-md bg-mint-2 p-2.5 text-primary">
                <Icon size={20} />
              </span>
              <span className="flex-1">
                <span className="block text-body font-normal">{def.label}</span>
                <span className="block text-caption text-muted">{def.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      {kind ? (
        <Statement kind={kind} from={from} to={to} setFrom={setFrom} setTo={setTo} onClose={() => setKind(null)} />
      ) : null}
    </div>
  );
}

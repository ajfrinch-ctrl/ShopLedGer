import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  ChevronRight,
  LogOut,
  TrendingUp,
  UserCircle2,
  Users,
} from "lucide-react";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { canManage, useShop } from "@/lib/store";

export const Route = createFileRoute("/more")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <MorePage />
      </AppShell>
    </RequireAuth>
  ),
});

function MorePage() {
  const user = useShop((s) => s.user);
  const logout = useShop((s) => s.logout);
  const navigate = useNavigate();
  const manage = canManage(user?.role);

  const items = [
    { to: "/reports", icon: BarChart3, label: "রিপোর্ট সেন্টার", desc: "বিস্তারিত রিপোর্ট ও স্টেটমেন্ট প্রিভিউ" },
    ...(manage
      ? [
          {
            to: "/customers",
            icon: Users,
            label: "ক্রেতা ব্যবস্থাপনা",
            desc:
              user?.role === "owner"
                ? "ক্রেতার তালিকা ও রেজিস্ট্রেশন অনুমোদন"
                : "ক্রেতার তালিকা ও তথ্য সম্পাদনা",
          },
          { to: "/profit-loss", icon: TrendingUp, label: "লাভ-ক্ষতি", desc: "দৈনিক ও মাসিক নিট লাভ" },
        ]
      : []),
    { to: "/profile", icon: UserCircle2, label: "আমার প্রোফাইল", desc: "নাম, মোবাইল ও ডেমো রিসেট" },
    ...(user?.role === "owner"
      ? [{ to: "/profile", icon: Building2, label: "শাখা ও প্যাড", desc: "প্রধান শাখা • কর্ণফুলী সেলস সেন্টার" }]
      : []),
  ];

  return (
    <div>
      <PageTitle title="আরও" />
      <div className="space-y-2 p-4">
        {items.map((it) => (
          <Link
            key={it.to + it.label}
            to={it.to}
            className="flex items-center gap-3 rounded-lg border border-line bg-card p-3"
          >
            <div className="rounded-md bg-mint-2 p-2.5 text-primary">
              <it.icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body font-normal">{it.label}</p>
              <p className="truncate text-caption text-muted">{it.desc}</p>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            logout();
            void navigate({ to: "/login" });
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-lg border border-line bg-card p-3 text-left"
        >
          <div className="rounded-md bg-bg p-2.5 text-muted">
            <LogOut size={20} />
          </div>
          <p className="text-body font-normal">লগআউট</p>
        </button>
      </div>
    </div>
  );
}

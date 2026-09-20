import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { TopBar } from "@/components/top-bar";
import { useShop } from "@/lib/store";
import { cn } from "@/lib/utils";

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-mint">
      <div className="text-center">
        <div className="mx-auto mb-3 size-10 animate-pulse rounded-xl bg-primary" />
        <p className="text-sm text-muted">লোড হচ্ছে...</p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useShop((s) => s.user);
  const hydrated = useShop((s) => s.hydrated);
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && !user) {
      void navigate({ to: "/login" });
    }
  }, [hydrated, user, navigate]);

  if (!hydrated || !user) return <LoadingScreen />;
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const user = useShop((s) => s.user);
  const logout = useShop((s) => s.logout);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!user) return null;
  const isCustomer = user.role === "customer";

  const nav = isCustomer
    ? [
        { to: "/", icon: LayoutDashboard, label: "হোম" },
        { to: "/orders", icon: ClipboardList, label: "অর্ডার" },
        { to: "/my-dues", icon: Wallet, label: "বাকি" },
        { to: "/profile", icon: UserCircle2, label: "প্রোফাইল" },
      ]
    : [
        { to: "/", icon: LayoutDashboard, label: "হোম" },
        { to: "/sales", icon: ShoppingCart, label: "বিক্রি" },
        { to: "/stock", icon: Package, label: "স্টক" },
        { to: "/collections", icon: Wallet, label: "বাকি" },
        { to: "/more", icon: Settings, label: "আরও" },
      ];

  const handleLogout = () => {
    logout();
    void navigate({ to: "/login" });
  };

  return (
    <div className="min-h-dvh bg-bg">
      {/* ফিক্সড টপবার — উচ্চতা `--topbar-h` ভেরিয়েবলে (top-bar.tsx মাপে), নিচে main ততটুকু জায়গা ছাড়ে */}
      <TopBar user={user} onLogout={handleLogout} />

      <main className="mx-auto max-w-md pb-24" style={{ paddingTop: "var(--topbar-h, 92px)" }}>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-md items-center justify-around px-1">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mx-0.5 flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-md transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-[10px]",
                    active && "bg-mint-2",
                  )}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    active ? "font-semibold" : "font-medium",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-line bg-card px-4 py-3">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

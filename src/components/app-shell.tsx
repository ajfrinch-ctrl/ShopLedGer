import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  UserCircle2,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SHOP } from "@/lib/shop";
import { roleLabel, useShop } from "@/lib/store";
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
  const [menuOpen, setMenuOpen] = useState(false);

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
      <header className="sticky top-0 z-20 border-b border-mint-3/80 bg-linear-to-b from-card via-card to-mint backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={SHOP.logo}
              alt=""
              className="size-10 rounded-xl object-cover shadow-[0_4px_14px_rgba(4,121,90,0.28)]"
            />
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-[15px] font-bold tracking-tight text-fg">{SHOP.name}</h1>
              <p className="truncate text-[11px] font-medium text-muted">
                {isCustomer ? "ক্রেতা প্যানেল" : SHOP.tagline}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full border border-mint-3 bg-mint-2">
              <span className="size-2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(4,121,90,0.15)]" />
            </div>
            <button
              type="button"
              aria-label="মেনু"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-9 items-center justify-center rounded-full border border-line bg-card shadow-sm"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="mx-auto max-w-md px-4 pb-3">
            <div className="rounded-lg border border-line bg-card p-2 shadow-card">
              <div className="mb-1 border-b border-line px-3 py-2">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-[11px] text-muted">
                  {roleLabel(user.role)} • {user.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-medium text-danger"
              >
                <LogOut size={16} /> লগআউট
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-md pb-24">{children}</main>

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
                <span className={cn("text-[10px] leading-none", active ? "font-semibold" : "font-medium")}>
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

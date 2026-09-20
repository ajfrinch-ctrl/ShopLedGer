import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { SHOP } from "@/lib/shop";
import { roleLabel, useShop } from "@/lib/store";

export const Route = createFileRoute("/profile")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <ProfilePage />
      </AppShell>
    </RequireAuth>
  ),
});

function ProfilePage() {
  const user = useShop((s) => s.user);
  const logout = useShop((s) => s.logout);
  const resetDemo = useShop((s) => s.resetDemo);
  const navigate = useNavigate();

  return (
    <div>
      <PageTitle title="আমার প্রোফাইল" />
      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-line bg-card p-5 text-center">
          <img src={SHOP.logo} alt="" className="mx-auto size-16 rounded-full object-cover" />
          <p className="mt-3 text-heading font-bold">{user?.name}</p>
          <p className="text-body text-muted">
            {roleLabel(user?.role)} • {user?.phone}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4 text-body">
          <p className="font-bold">{SHOP.name}</p>
          <p className="mt-1 text-muted">{SHOP.tagline}</p>
          <p className="mt-2 text-caption text-muted">{SHOP.address}</p>
          <p className="mt-1 text-caption text-muted">{SHOP.phones.join(" • ")}</p>
        </div>
        {user?.role === "owner" ? (
          <button
            type="button"
            onClick={() => {
              resetDemo();
              toast.success("ডেমো ডাটা ফিরিয়ে আনা হয়েছে");
            }}
            className="w-full rounded-md border border-line bg-card py-3 text-body font-bold"
          >
            ডেমো হিসাব রিসেট করুন
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            logout();
            void navigate({ to: "/login" });
          }}
          className="w-full rounded-md bg-danger/10 py-3 text-body font-bold text-danger"
        >
          লগআউট
        </button>
      </div>
    </div>
  );
}

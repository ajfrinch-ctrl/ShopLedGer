import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fingerprint, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import {
  createPasskey,
  findPasskeyFor,
  passkeyErrorMessage,
  passkeySupported,
  removePasskey,
  type PasskeyRecord,
} from "@/lib/passkey";
import { SHOP } from "@/lib/shop";
import { isOwner, isSystemAdmin, roleLabel, useShop } from "@/lib/store";

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
            {isSystemAdmin(user?.role) ? "সিস্টেম অ্যাডমিন" : `${roleLabel(user?.role)} • ${user?.phone}`}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4 text-body">
          <p className="font-bold">{SHOP.name}</p>
          <p className="mt-1 text-muted">{SHOP.tagline}</p>
          <p className="mt-2 text-caption text-muted">{SHOP.address}</p>
          <p className="mt-1 text-caption text-muted">{SHOP.phones.join(" • ")}</p>
        </div>
        <PasskeyCard />
        {isOwner(user?.role) ? (
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

function PasskeyCard() {
  const user = useShop((s) => s.user);
  const supported = passkeySupported();
  const [rec, setRec] = useState<PasskeyRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported || !user) return;
    let live = true;
    void findPasskeyFor(user.phone).then((r) => {
      if (live) setRec(r);
    });
    return () => {
      live = false;
    };
  }, [supported, user]);

  if (!supported) {
    return (
      <div className="rounded-xl border border-line bg-card p-4 text-body">
        <div className="flex items-center gap-2">
          <ShieldOff size={18} className="text-muted" />
          <p className="font-bold">ফিঙ্গারপ্রিন্ট / পিন / ফেস লগইন</p>
        </div>
        <p className="mt-2 text-caption text-muted">
          এই ব্রাউজার/ডিভাইসে লক-ভেরিফিকেশন লগইন পাওয়া যাচ্ছে না। মোবাইলে Chrome বা
          Safari (HTTPS-এ) ব্যবহার করলে এটি চালু হবে।
        </p>
      </div>
    );
  }

  const enable = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const r = await createPasskey({
        userId: user.id,
        userName: user.name,
        phone: user.phone,
      });
      setRec(r);
      toast.success("লক-ভেরিফিকেশন লগইন চালু হয়েছে — এখন ছোট করে লগইন করতে পারবেন");
    } catch (e) {
      toast.error(passkeyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!rec || busy) return;
    setBusy(true);
    try {
      await removePasskey(rec.id);
      setRec(null);
      toast.success("লক-ভেরিফিকেশন লগইন বন্ধ করা হয়েছে");
    } catch {
      toast.error("মুছে ফেলা যায়নি — আবার চেষ্টা করুন");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-card p-4 text-body">
      <div className="flex items-center gap-2">
        <Fingerprint size={18} className={rec ? "text-primary" : "text-muted"} />
        <p className="font-bold">ফিঙ্গারপ্রিন্ট / পিন / ফেস লগইন</p>
      </div>
      <p className="mt-2 text-caption text-muted">
        {rec
          ? "চালু আছে — লগইন পেজে নম্বর লিখে এক ক্লিকে ফিঙ্গারপ্রিন্ট, লক স্ক্রিনের পিন বা ফেস দিয়ে প্রবেশ করবেন।"
          : "চালু করলে প্রথম লগইনের পর থেকে এই ডিভাইসে পাসওয়ার্ড ছাড়াই ফিঙ্গারপ্রিন্ট, লক স্ক্রিনের পিন/প্যাটার্ন বা ফেস দিয়ে লগইন করা যাবে।"}
      </p>
      <p className="mt-1 flex items-center gap-1 text-caption text-muted">
        <ShieldCheck size={14} /> সব কিছু এই ডিভাইসে থাকে — কোনো সার্ভারে যায় না
      </p>
      <button
        type="button"
        onClick={() => (rec ? void disable() : void enable())}
        disabled={busy}
        className={`mt-3 w-full rounded-md py-3 text-body font-bold ${
          rec
            ? "border border-line bg-bg"
            : "bg-primary text-card disabled:opacity-60"
        }`}
      >
        {busy
          ? "অপেক্ষা করুন…"
          : rec
            ? "লক-ভেরিফিকেশন লগইন বন্ধ করুন"
            : "ফিঙ্গারপ্রিন্ট / পিন লগইন চালু করুন"}
      </button>
    </div>
  );
}

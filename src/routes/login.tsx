import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { DEMO_ACCOUNTS, SHOP } from "@/lib/shop";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

const ROLE_TONE: Record<string, string> = {
  owner: "border-warn/30 bg-mint text-primary-dark",
  salesman: "border-info/20 bg-card text-info",
  customer: "border-line bg-bg text-fg",
};

function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const login = useShop((s) => s.login);
  const error = useShop((s) => s.loginError);
  const user = useShop((s) => s.user);
  const hydrated = useShop((s) => s.hydrated);
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && user) void navigate({ to: "/" });
  }, [hydrated, user, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(phone, password)) void navigate({ to: "/" });
  };

  const fill = (p: string, pass: string, instant?: boolean) => {
    setPhone(p);
    setPassword(pass);
    if (instant && login(p, pass)) void navigate({ to: "/" });
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-primary px-4 py-8">
      <div className="absolute -right-20 -top-20 size-52 rounded-full bg-card/10" />
      <div className="absolute -bottom-16 -left-16 size-40 rounded-full bg-card/10" />

      <div className="relative z-10 mb-6 text-center">
        <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-xl bg-card shadow-card">
          <img src={SHOP.logo} alt="" className="size-16 rounded-lg object-cover" />
        </div>
        <h1 className="text-2xl font-bold leading-snug text-card">{SHOP.name}</h1>
        <p className="mt-1 text-sm font-medium text-mint-2">{SHOP.tagline}</p>
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-xl bg-card p-6 shadow-card">
        <div className="mb-5 text-center">
          <h2 className="text-xl font-bold">লগইন করুন</h2>
          <p className="mt-1 text-sm text-muted">আপনার অ্যাকাউন্টে প্রবেশ করুন</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-semibold">
            আইডি অথবা মোবাইল নম্বর
            <div className="relative mt-1.5">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.slice(0, 30))}
                placeholder="01XXXXXXXXX"
                autoComplete="tel"
                className="w-full rounded-md border-2 border-line py-3 pl-10 pr-4 text-base outline-none focus:border-primary"
              />
            </div>
          </label>
          <label className="block text-sm font-semibold">
            পাসওয়ার্ড
            <div className="relative mt-1.5">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="পাসওয়ার্ড লিখুন"
                autoComplete="current-password"
                className="w-full rounded-md border-2 border-line py-3 pl-10 pr-12 text-base outline-none focus:border-primary"
              />
              <button
                type="button"
                aria-label={show ? "লুকান" : "দেখান"}
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error ? (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-center text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!phone.trim() || password.length < 4}
            className="w-full rounded-md bg-primary py-3.5 text-base font-bold text-card shadow-[0_8px_20px_rgba(4,121,90,0.28)] disabled:bg-muted"
          >
            প্রবেশ করুন
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium text-muted">ডেমো অ্যাকাউন্ট</span>
          <div className="h-px flex-1 bg-line" />
        </div>
        <div className="space-y-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => fill(a.phone, a.password, true)}
              className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-sm font-medium ${ROLE_TONE[a.role] ?? ROLE_TONE.owner}`}
            >
              <span className="min-w-0 truncate">
                {a.role === "owner" ? "মালিক" : a.role === "salesman" ? "কর্মচারী" : "ক্রেতা"} — {a.name}
              </span>
              <span className="shrink-0 font-mono text-xs opacity-80">{a.phone}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="relative z-10 mt-6 text-xs text-mint-2">অফলাইনেও কাজ করে • ডাটা এই ডিভাইসে সেভ হয়</p>
    </div>
  );
}

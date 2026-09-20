import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, MapPin, Phone, UserPlus } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerAddress, setRegisterAddress] = useState("");
  const [registerNotice, setRegisterNotice] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const login = useShop((s) => s.login);
  const loginCustomer = useShop((s) => s.loginCustomer);
  const submitCustomerRegistration = useShop((s) => s.submitCustomerRegistration);
  const error = useShop((s) => s.loginError);
  const user = useShop((s) => s.user);
  const hydrated = useShop((s) => s.hydrated);
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && user) void navigate({ to: "/" });
  }, [hydrated, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (await login(phone, password)) void navigate({ to: "/" });
    } finally {
      setSubmitting(false);
    }
  };

  const enterAsCustomer = () => {
    if (loginCustomer(phone)) void navigate({ to: "/" });
  };

  const submitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    const result = submitCustomerRegistration({
      name: registerName,
      phone: registerPhone,
      address: registerAddress,
    });
    setRegisterNotice(result);
    if (result.ok) {
      setRegisterName("");
      setRegisterPhone("");
      setRegisterAddress("");
      setRegisterOpen(false);
    }
  };

  const fill = async (p: string, pass: string, instant?: boolean) => {
    setPhone(p);
    setPassword(pass);
    if (instant && (await login(p, pass))) void navigate({ to: "/" });
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-primary px-4 py-8">
      <div className="absolute -right-20 -top-20 size-52 rounded-full bg-card/10" />
      <div className="absolute -bottom-16 -left-16 size-40 rounded-full bg-card/10" />

      <div className="relative z-10 mb-6 text-center">
        <div className="mx-auto mb-3 flex size-20 items-center justify-center rounded-xl bg-card shadow-card">
          <img src={SHOP.logo} alt="" className="size-16 rounded-lg object-cover" />
        </div>
        <h1 className="text-heading font-bold text-card">{SHOP.name}</h1>
        <p className="mt-1 text-body font-normal text-mint-2">{SHOP.tagline}</p>
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-xl bg-card p-6 shadow-card">
        <div className="mb-5 text-center">
          <h2 className="text-heading font-bold">লগইন করুন</h2>
          <p className="mt-1 text-body text-muted">আপনার অ্যাকাউন্টে প্রবেশ করুন</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-body font-bold">
            আইডি অথবা মোবাইল নম্বর
            <div className="relative mt-1.5">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.slice(0, 30))}
                placeholder="01XXXXXXXXX"
                autoComplete="tel"
                className="w-full rounded-md border-2 border-line py-3 pl-10 pr-4 text-input outline-none focus:border-primary"
              />
            </div>
          </label>
          <label className="block text-body font-bold">
            পাসওয়ার্ড
            <div className="relative mt-1.5">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="পাসওয়ার্ড লিখুন"
                autoComplete="current-password"
                className="w-full rounded-md border-2 border-line py-3 pl-10 pr-12 text-input outline-none focus:border-primary"
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
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-center text-body text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || !phone.trim() || password.length < 4}
            className="w-full rounded-md bg-primary py-3.5 text-body font-bold text-card shadow-[0_8px_20px_rgba(4,121,90,0.28)] disabled:bg-muted"
          >
            {submitting ? "যাচাই হচ্ছে…" : "প্রবেশ করুন"}
          </button>
        </form>

        <div className="mt-3 rounded-md border border-line bg-bg p-3">
          <button
            type="button"
            onClick={enterAsCustomer}
            disabled={!phone.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-primary px-3 py-2.5 text-body font-bold text-primary disabled:opacity-50"
          >
            <Phone size={16} /> অনুমোদিত ক্রেতা হিসেবে প্রবেশ
          </button>
          <p className="mt-1.5 text-center text-caption text-muted">
            মালিক অনুমোদন করলে শুধু মোবাইল নম্বর দিয়েই প্রবেশ করুন
          </p>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-caption font-normal text-muted">ডেমো অ্যাকাউন্ট</span>
          <div className="h-px flex-1 bg-line" />
        </div>
        <div className="space-y-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => fill(a.phone, a.password, true)}
              className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-body font-normal ${ROLE_TONE[a.role] ?? ROLE_TONE.owner}`}
            >
              <span className="min-w-0 truncate">
                {a.role === "owner" ? "মালিক" : a.role === "salesman" ? "কর্মচারী" : "ক্রেতা"} — {a.name}
              </span>
              <span className="shrink-0 font-sans tabular text-caption opacity-80">{a.phone}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          {registerNotice ? (
            <p
              className={`mb-3 rounded-md border px-3 py-2 text-center text-caption ${
                registerNotice.ok
                  ? "border-primary/20 bg-mint text-primary-dark"
                  : "border-danger/30 bg-danger/10 text-danger"
              }`}
            >
              {registerNotice.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setRegisterOpen((open) => !open);
              setRegisterNotice(null);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-mint-2 px-3 py-2.5 text-body font-bold text-primary"
          >
            <UserPlus size={17} /> নতুন ক্রেতা রেজিস্ট্রেশন
          </button>

          {registerOpen ? (
            <form onSubmit={submitRegistration} className="mt-3 space-y-3 rounded-lg bg-bg p-3">
              <div>
                <h3 className="text-body font-bold">ক্রেতার তথ্য দিন</h3>
                <p className="mt-0.5 text-caption text-muted">
                  মালিক অনুমোদন করার পর আপনি ক্রেতা হিসেবে প্রবেশ করতে পারবেন।
                </p>
              </div>
              <input
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value.slice(0, 80))}
                placeholder="পূর্ণ নাম"
                autoComplete="name"
                required
                className="w-full rounded-md border border-line bg-card px-3 py-2.5 text-input"
              />
              <div>
                <input
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(e.target.value.slice(0, 20))}
                  placeholder="মোবাইল নম্বর"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  className="w-full rounded-md border border-line bg-card px-3 py-2.5 text-input"
                />
                <p className="mt-1 flex items-center gap-1 text-caption text-muted">
                  <Phone size={12} /> এই নম্বরটি WhatsApp যোগাযোগে ব্যবহার হবে
                </p>
              </div>
              <div>
                <div className="relative">
                  <MapPin
                    size={16}
                    className="absolute left-3 top-3 text-primary"
                    aria-hidden
                  />
                  <textarea
                    value={registerAddress}
                    onChange={(e) => setRegisterAddress(e.target.value.slice(0, 160))}
                    placeholder="ঠিকানা"
                    autoComplete="street-address"
                    rows={2}
                    required
                    className="w-full resize-none rounded-md border border-line bg-card py-2.5 pr-3 pl-9 text-input"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
              >
                রেজিস্ট্রেশন পাঠান
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <p className="relative z-10 mt-6 text-caption text-mint-2">অফলাইনেও কাজ করে • ডাটা এই ডিভাইসে সেভ হয়</p>
    </div>
  );
}

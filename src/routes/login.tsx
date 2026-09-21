import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Fingerprint, KeyRound, Lock, MapPin, Phone, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  findPasskeyFor,
  passkeyErrorMessage,
  verifyPasskey,
  type PasskeyRecord,
} from "@/lib/passkey";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-reset";
import { SHOP } from "@/lib/shop";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

type LoginMode = "login" | "reset" | "change";

const MODE_TEXT: Record<LoginMode, { title: string; sub: string }> = {
  login: { title: "লগইন করুন", sub: "মালিক বা ক্রেতার মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে প্রবেশ করুন" },
  reset: { title: "পাসওয়ার্ড রিসেট", sub: "মোবাইল নম্বর দিয়ে নতুন পাসওয়ার্ড সেট করুন" },
  change: {
    title: "পাসওয়ার্ড পরিবর্তন করুন",
    sub: "প্রথমবারের লগইনে ডিফল্ট পাসওয়ার্ড পরিবর্তন করা আবশ্যক",
  },
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
  const [pkRecord, setPkRecord] = useState<PasskeyRecord | null>(null);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkError, setPkError] = useState("");
  // প্যানেল মোড: লগইন / পাসওয়ার্ড রিসেট / প্রথম-লগইন বাধ্যতামূলক পরিবর্তন
  const [mode, setMode] = useState<LoginMode>("login");
  const [resetPhone, setResetPhone] = useState("");
  const [resetError, setResetError] = useState("");
  const [changePhone, setChangePhone] = useState("");
  const [changeError, setChangeError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const login = useShop((s) => s.login);
  const resetPassword = useShop((s) => s.resetPassword);
  const loginWithPasskey = useShop((s) => s.loginWithPasskey);
  const submitCustomerRegistration = useShop((s) => s.submitCustomerRegistration);
  const error = useShop((s) => s.loginError);
  const user = useShop((s) => s.user);
  const hydrated = useShop((s) => s.hydrated);
  const navigate = useNavigate();

  useEffect(() => {
    if (hydrated && user) void navigate({ to: "/" });
  }, [hydrated, user, navigate]);

  // নম্বর লিখলে দেখা যায় এতে ফিঙ্গারপ্রিন্ট/পিন/ফেস লগইন সেট আছে কিনা
  useEffect(() => {
    let live = true;
    if (phone.trim().length < 6) {
      setPkRecord(null);
      setPkError("");
      return;
    }
    void findPasskeyFor(phone).then((rec) => {
      if (live) {
        setPkRecord(rec);
        setPkError("");
      }
    });
    return () => {
      live = false;
    };
  }, [phone]);

  const tryPasskey = async () => {
    if (!pkRecord || pkBusy) return;
    setPkBusy(true);
    setPkError("");
    try {
      await verifyPasskey(pkRecord);
      if (loginWithPasskey(pkRecord.phone)) void navigate({ to: "/" });
    } catch (e) {
      setPkError(passkeyErrorMessage(e));
    } finally {
      setPkBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const result = await login(phone, password);
      if (result.ok && result.mustChangePassword) {
        openChange(phone.trim());
      } else if (result.ok) {
        void navigate({ to: "/" });
      }
    } finally {
      setSubmitting(false);
    }
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

  const clearPasswordFields = () => {
    setNewPassword("");
    setConfirmPassword("");
  };

  const openReset = () => {
    setResetPhone(phone.trim());
    clearPasswordFields();
    setResetError("");
    setMode("reset");
  };

  const openChange = (identity: string) => {
    setChangePhone(identity);
    clearPasswordFields();
    setChangeError("");
    setMode("change");
  };

  const backToLogin = () => {
    setMode("login");
    setResetError("");
    setChangeError("");
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    const result = resetPassword(resetPhone, newPassword, confirmPassword);
    if (result.ok) {
      setPhone(resetPhone.trim());
      setPassword("");
      backToLogin();
      setNotice(result.message);
    } else {
      setResetError(result.message);
    }
  };

  // বাধ্যতামূলক পরিবর্তন: সেভ → নতুন পাসওয়ার্ডে লগইন (সেট্রে user সেট হয়) → অ্যাপ
  const submitChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = resetPassword(changePhone, newPassword, confirmPassword);
    if (!result.ok) {
      setChangeError(result.message);
      return;
    }
    const loginResult = await login(changePhone, newPassword);
    if (loginResult.ok) {
      void navigate({ to: "/" });
    } else {
      setChangeError("পাসওয়ার্ড সেট করা গেল না — আবার চেষ্টা করুন");
    }
  };

  const newPasswordFields = (
    <>
      <label className="block text-body font-bold">
        নতুন পাসওয়ার্ড
        <div className="relative mt-1.5">
          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
          <input
            type={show ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষর`}
            autoComplete="new-password"
            required
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

      <label className="block text-body font-bold">
        নতুন পাসওয়ার্ড (আবার)
        <div className="relative mt-1.5">
          <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
          <input
            type={show ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="নতুন পাসওয়ার্ড আবার লিখুন"
            autoComplete="new-password"
            required
            className="w-full rounded-md border-2 border-line py-3 pl-10 pr-4 text-input outline-none focus:border-primary"
          />
        </div>
      </label>
    </>
  );

  const panelFooter = (
    <button
      type="button"
      onClick={backToLogin}
      className="mx-auto mt-4 flex items-center gap-1.5 text-body font-bold text-primary"
    >
      <ArrowLeft size={16} /> লগইনে ফিরে যান
    </button>
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-primary">
      <div className="absolute -right-20 -top-20 size-52 rounded-full bg-card/10" />
      <div className="absolute -bottom-16 -left-16 size-40 rounded-full bg-card/10" />

      {/* পুরো টপ রো ফিক্সড — অ্যাপের টপবারের একই ভাষা */}
      <header
        data-testid="login-logo-header"
        className="sticky top-0 z-20 border-b border-line bg-card pb-3.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] shadow-card"
      >
        <div className="mx-auto flex max-w-md items-center gap-3 px-4">
          <img
            src={SHOP.logo}
            alt=""
            className="size-12 shrink-0 rounded-xl object-cover shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
          />
          <div className="min-w-0 text-left">
            <h1 className="text-heading leading-tight font-bold text-fg [overflow-wrap:anywhere]">
              {SHOP.name}
            </h1>
            <p className="text-caption leading-tight text-muted [overflow-wrap:anywhere]">
              {SHOP.tagline}
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-card">
        <div className="mb-5 text-center">
          <h2 className="text-heading font-bold">{MODE_TEXT[mode].title}</h2>
          <p className="mt-1 text-body text-muted">{MODE_TEXT[mode].sub}</p>
        </div>

        {mode === "reset" ? (
          <form onSubmit={submitReset} className="space-y-4">
            <label className="block text-body font-bold">
              মোবাইল নম্বর
              <div className="relative mt-1.5">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input
                  value={resetPhone}
                  onChange={(e) => setResetPhone(e.target.value.slice(0, 30))}
                  placeholder="01XXXXXXXXX"
                  autoComplete="tel"
                  required
                  className="w-full rounded-md border-2 border-line py-3 pl-10 pr-4 text-input outline-none focus:border-primary"
                />
              </div>
            </label>
            {newPasswordFields}
            {resetError ? (
              <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-center text-body text-danger">
                {resetError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={
                !resetPhone.trim() ||
                newPassword.length < MIN_PASSWORD_LENGTH ||
                newPassword !== confirmPassword
              }
              className="w-full rounded-md bg-primary py-3.5 text-body font-bold text-card shadow-[0_8px_20px_rgba(4,121,90,0.28)] disabled:bg-muted"
            >
              নতুন পাসওয়ার্ড সেট করুন
            </button>
            <p className="text-center text-caption text-muted">
              নতুন পাসওয়ার্ড শুধু এই ডিভাইসে সেভ হবে (অফলাইন অ্যাপ)
            </p>
          </form>
        ) : null}

        {mode === "change" ? (
          <form onSubmit={submitChange} className="space-y-4">
            <label className="block text-body font-bold">
              মোবাইল নম্বর
              <div className="relative mt-1.5">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input
                  value={changePhone}
                  disabled
                  aria-label="লগইন করা মোবাইল নম্বর"
                  className="w-full rounded-md border-2 border-line bg-bg py-3 pl-10 pr-4 text-input opacity-80 outline-none"
                />
              </div>
            </label>
            {newPasswordFields}
            {changeError ? (
              <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-center text-body text-danger">
                {changeError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={
                !changePhone.trim() ||
                newPassword.length < MIN_PASSWORD_LENGTH ||
                newPassword !== confirmPassword
              }
              className="w-full rounded-md bg-primary py-3.5 text-body font-bold text-card shadow-[0_8px_20px_rgba(4,121,90,0.28)] disabled:bg-muted"
            >
              নতুন পাসওয়ার্ড সেট করুন
            </button>
            <p className="text-center text-caption text-muted">
              পরিবর্তন না করা পর্যন্ত অ্যাপে প্রবেশ করা যাবে না — নতুন পাসওয়ার্ড শুধু এই ডিভাইসে সেভ হবে
            </p>
          </form>
        ) : null}

        {mode === "login" ? (
          <>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-body font-bold">
                মোবাইল নম্বর
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

              {pkRecord ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => void tryPasskey()}
                    disabled={pkBusy}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3.5 text-body font-bold text-card shadow-[0_8px_20px_rgba(4,121,90,0.28)] disabled:opacity-60"
                  >
                    <Fingerprint size={20} />
                    {pkBusy ? "ভেরিফাই হচ্ছে…" : "ফিঙ্গারপ্রিন্ট / পিন / ফেস দিয়ে প্রবেশ করুন"}
                  </button>
                  {pkError ? (
                    <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-center text-body text-danger">
                      {pkError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {pkRecord ? (
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-line" />
                  <span className="text-caption font-normal text-muted">অথবা পাসওয়ার্ড</span>
                  <div className="h-px flex-1 bg-line" />
                </div>
              ) : null}

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
              {notice ? (
                <p className="rounded-md border border-primary/20 bg-mint px-3 py-2 text-center text-body text-primary-dark">
                  {notice}
                </p>
              ) : null}
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
              <button
                type="button"
                onClick={openReset}
                className="mx-auto flex items-center gap-1.5 text-body font-bold text-primary"
              >
                <KeyRound size={16} /> পাসওয়ার্ড ভুলে গেছেন?
              </button>
            </form>

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
                      মালিক অনুমোদন করলে ডিফল্ট পাসওয়ার্ড ১২৩৪৫৬ দিয়ে প্রবেশ করুন — প্রথমবার পরিবর্তন করতে হবে।
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
                      <Phone size={12} /> এই মূল নম্বর পরিবর্তন করা যাবে না; পরে আলাদা WhatsApp নম্বর যোগ করা যাবে
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
          </>
        ) : null}

        {mode !== "login" ? panelFooter : null}
        </div>
        <p className="mt-6 text-caption text-mint-2">অফলাইনেও কাজ করে • ডাটা এই ডিভাইসে সেভ হয়</p>
      </div>
    </div>
  );
}

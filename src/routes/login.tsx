import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Fingerprint, KeyRound, Lock, MapPin, Phone, ShieldCheck, User, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  findPasskeyFor,
  passkeyErrorMessage,
  verifyPasskey,
  type PasskeyRecord,
} from "@/lib/passkey";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-reset";
import { consumeReturnTo, readReturnTo, routeLabel } from "@/lib/return-to";
import { SHOP } from "@/lib/shop";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

type LoginMode = "login" | "reset" | "change";

const MODE_TEXT: Record<LoginMode, { title: string; sub: string }> = {
  login: { title: "লগইন করুন", sub: "আপনার ইউজারনেম ও পাসওয়ার্ড দিয়ে প্রবেশ করুন" },
  reset: { title: "পাসওয়ার্ড রিসেট", sub: "ইউজারনেম দিয়ে নতুন পাসওয়ার্ড সেট করুন" },
  change: {
    title: "পাসওয়ার্ড পরিবর্তন করুন",
    sub: "প্রথমবারের লগইনে নতুন পাসওয়ার্ড সেট করা আবশ্যক",
  },
};

/** লগইনের পরে যেখানে ফিরতে হবে — সেভ করা ঠিকানা (একবারই ব্যবহার) নাহলে হোম। */
function returnTarget(): string {
  return consumeReturnTo() ?? "/";
}

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerAddress, setRegisterAddress] = useState("");
  const [registerNotice, setRegisterNotice] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [adminSetupOpen, setAdminSetupOpen] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");
  const [adminError, setAdminError] = useState("");
  const [pkRecord, setPkRecord] = useState<PasskeyRecord | null>(null);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkError, setPkError] = useState("");
  // প্যানেল মোড: লগইন / পাসওয়ার্ড রিসেট / প্রথম-লগইন বাধ্যতামূলক পরিবর্তন
  const [mode, setMode] = useState<LoginMode>("login");
  const [resetUsername, setResetUsername] = useState("");
  const [resetError, setResetError] = useState("");
  const [changeUsername, setChangeUsername] = useState("");
  const [changeError, setChangeError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const login = useShop((s) => s.login);
  const resetPassword = useShop((s) => s.resetPassword);
  const loginWithPasskey = useShop((s) => s.loginWithPasskey);
  const createAdminAccount = useShop((s) => s.createAdminAccount);
  const ownersCount = useShop((s) => (s.owners ?? []).length);
  const submitCustomerRegistration = useShop((s) => s.submitCustomerRegistration);
  const error = useShop((s) => s.loginError);
  const user = useShop((s) => s.user);
  const hydrated = useShop((s) => s.hydrated);
  const navigate = useNavigate();
  // গভীর-লিংক (যেমন `/sales`) থেকে আসা ব্যবহারকারী লগইনের পরে সেই পাতাতেই ফেরেন
  const returnTo = useMemo(() => readReturnTo(), []);
  const returnLabel = routeLabel(returnTo);

  // পাতা খোলার সময়েই লগইন করা ছিল কি না — থাকলে নিচের effect নিজেই ভেতরে পাঠাবে।
  // লগইন ফর্ম দিয়ে ঢুকলে নেভিগেশন করে হ্যান্ডলারগুলো (`goAfterLogin`) — নইলে
  // দুটোই নেভিগেট করে সেভ করা ঠিকানা আগেই খরচ হয়ে "/"‑এ গিয়ে ঠেকে।
  const [arrivedSignedIn] = useState(() => Boolean(useShop.getState().user));

  const goAfterLogin = () => {
    void navigate({ to: returnTarget() as never, replace: true });
  };

  useEffect(() => {
    if (!arrivedSignedIn) return;
    if (hydrated && user) void navigate({ to: returnTarget() as never, replace: true });
  }, [arrivedSignedIn, hydrated, user, navigate]);

  // ইউজারনেম লিখলে দেখা যায় এতে ফিঙ্গারপ্রিন্ট/পিন/ফেস লগইন সেট আছে কিনা
  useEffect(() => {
    let live = true;
    if (username.trim().length < 3) {
      setPkRecord(null);
      setPkError("");
      return;
    }
    void findPasskeyFor(username).then((rec) => {
      if (live) {
        setPkRecord(rec);
        setPkError("");
      }
    });
    return () => {
      live = false;
    };
  }, [username]);

  const tryPasskey = async () => {
    if (!pkRecord || pkBusy) return;
    setPkBusy(true);
    setPkError("");
    try {
      await verifyPasskey(pkRecord);
      if (loginWithPasskey(pkRecord.username || pkRecord.phone)) goAfterLogin();
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
      const result = await login(username, password);
      if (result.ok && result.mustChangePassword) {
        openChange(username.trim());
      } else if (result.ok) {
        goAfterLogin();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    const result = submitCustomerRegistration({
      name: registerName,
      username: registerUsername,
      password: registerPassword,
      confirm: registerConfirm,
      phone: registerPhone,
      address: registerAddress,
    });
    setRegisterNotice(result);
    if (result.ok) {
      setRegisterName("");
      setRegisterUsername("");
      setRegisterPassword("");
      setRegisterConfirm("");
      setRegisterPhone("");
      setRegisterAddress("");
      setRegisterOpen(false);
    }
  };

  const submitAdminSetup = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createAdminAccount({
      name: adminName,
      password: adminPassword,
      confirm: adminConfirm,
    });
    if (!result.ok) {
      setAdminError(result.message);
      return;
    }
    setAdminName("");
    setAdminPassword("");
    setAdminConfirm("");
    setAdminError("");
    setAdminSetupOpen(false);
    setUsername(result.username ?? "");
    setPassword("");
    setNotice(`অ্যাডমিন অ্যাকাউন্ট তৈরি হয়েছে — ইউজারনেম: ${result.username} — এখন লগইন করুন`);
  };

  const clearPasswordFields = () => {
    setNewPassword("");
    setConfirmPassword("");
  };

  const openReset = () => {
    setResetUsername(username.trim());
    clearPasswordFields();
    setResetError("");
    setMode("reset");
  };

  const openChange = (identity: string) => {
    setChangeUsername(identity);
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
    const result = resetPassword(resetUsername, newPassword, confirmPassword);
    if (result.ok) {
      setUsername(resetUsername.trim());
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
    const result = resetPassword(changeUsername, newPassword, confirmPassword);
    if (!result.ok) {
      setChangeError(result.message);
      return;
    }
    const loginResult = await login(changeUsername, newPassword);
    if (loginResult.ok) {
      goAfterLogin();
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

        {mode === "login" && returnTo ? (
          <p className="mb-4 flex items-start gap-2 rounded-md border border-primary/20 bg-mint px-3 py-2 text-caption text-primary-dark">
            <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {returnLabel ? `«${returnLabel}» পাতা` : "আগের পাতাটি"} দেখতে আগে লগইন করুন — লগইনের পরেই
              সেখানেই ফিরে যাবেন।
            </span>
          </p>
        ) : null}

        {mode === "reset" ? (
          <form onSubmit={submitReset} className="space-y-4">
            <label className="block text-body font-bold">
              ইউজারনেম
              <div className="relative mt-1.5">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value.slice(0, 30))}
                  placeholder="আপনার ইউজারনেম"
                  autoComplete="username"
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
                !resetUsername.trim() ||
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
              ইউজারনেম
              <div className="relative mt-1.5">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input
                  value={changeUsername}
                  disabled
                  aria-label="লগইন করা ইউজারনেম"
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
                !changeUsername.trim() ||
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
                ইউজারনেম
                <div className="relative mt-1.5">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.slice(0, 30))}
                    placeholder="আপনার ইউজারনেম"
                    autoComplete="username"
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
                disabled={submitting || !username.trim() || password.length < 4}
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
              {!username.trim() || password.length < MIN_PASSWORD_LENGTH ? (
                <p className="text-center text-caption text-muted">
                  ইউজারনেম আর কমপক্ষে {MIN_PASSWORD_LENGTH} অক্ষরের পাসওয়ার্ড দিলেই «প্রবেশ করুন»
                  চালু হবে
                </p>
              ) : null}
              <p className="rounded-md bg-bg px-3 py-2 text-center text-caption text-muted">
                <strong className="font-bold">প্রথমবার ঢুকছেন?</strong> মালিকের দেওয়া ইউজারনেম ও
                পাসওয়ার্ড দিন। পাসওয়ার্ড শুধু এই ডিভাইসে সেভ থাকে।
              </p>
            </form>

            {hydrated && ownersCount === 0 ? (
              <div className="mt-5 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAdminSetupOpen((open) => !open);
                    setAdminError("");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-mint-2 px-3 py-2.5 text-body font-bold text-primary"
                >
                  <ShieldCheck size={17} /> অ্যাডমিন অ্যাকাউন্ট তৈরি করুন
                </button>

                {adminSetupOpen ? (
                  <form onSubmit={submitAdminSetup} className="mt-3 space-y-3 rounded-lg bg-bg p-3">
                    <div>
                      <h3 className="text-body font-bold">প্রথম অ্যাডমিনের তথ্য দিন</h3>
                      <p className="mt-0.5 text-caption text-muted">
                        নামের প্রথম অংশ থেকে ইউজারনেম স্বয়ংক্রিয়ভাবে তৈরি হবে (যেমন: admin.karim)।
                      </p>
                    </div>
                    <input
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value.slice(0, 80))}
                      placeholder="পূর্ণ নাম"
                      autoComplete="name"
                      required
                      className="w-full rounded-md border border-line bg-card px-3 py-2.5 text-input"
                    />
                    <input
                      type={show ? "text" : "password"}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder={`পাসওয়ার্ড (কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষর)`}
                      autoComplete="new-password"
                      required
                      className="w-full rounded-md border border-line bg-card px-3 py-2.5 text-input"
                    />
                    <input
                      type={show ? "text" : "password"}
                      value={adminConfirm}
                      onChange={(e) => setAdminConfirm(e.target.value)}
                      placeholder="পাসওয়ার্ড আবার লিখুন"
                      autoComplete="new-password"
                      required
                      className="w-full rounded-md border border-line bg-card px-3 py-2.5 text-input"
                    />
                    {adminError ? (
                      <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-center text-caption text-danger">
                        {adminError}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
                    >
                      অ্যাকাউন্ট তৈরি করুন
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}

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
                      মালিক অনুমোদন করলে আপনার ইউজারনেম ও পাসওয়ার্ড দিয়ে প্রবেশ করুন।
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
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value.slice(0, 30))}
                      placeholder="ইউজারনেম বেছে নিন"
                      autoComplete="username"
                      required
                      className="w-full rounded-md border border-line bg-card px-3 py-2.5 text-input"
                    />
                    <p className="mt-1 text-caption text-muted">
                      ইউজারনেম পরে পরিবর্তন করা যাবে না
                    </p>
                  </div>
                  <input
                    type={show ? "text" : "password"}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder={`পাসওয়ার্ড (কমপক্ষে ${MIN_PASSWORD_LENGTH} অক্ষর)`}
                    autoComplete="new-password"
                    required
                    className="w-full rounded-md border border-line bg-card px-3 py-2.5 text-input"
                  />
                  <input
                    type={show ? "text" : "password"}
                    value={registerConfirm}
                    onChange={(e) => setRegisterConfirm(e.target.value)}
                    placeholder="পাসওয়ার্ড আবার লিখুন"
                    autoComplete="new-password"
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

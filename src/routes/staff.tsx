import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle, RequireAuth } from "@/components/app-shell";
import { bnDate, bnNum } from "@/lib/format";
import { isOwner, roleLabel, useShop } from "@/lib/store";
import type { StaffAccount, StaffRole } from "@/lib/types";

export const Route = createFileRoute("/staff")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <AppShell>
        <StaffPage />
      </AppShell>
    </RequireAuth>
  ),
});

function StaffPage() {
  const user = useShop((s) => s.user);
  const staff = useShop((s) => s.staff);
  const addStaff = useShop((s) => s.addStaff);
  const updateStaff = useShop((s) => s.updateStaff);
  const deleteStaff = useShop((s) => s.deleteStaff);
  const setStaffPassword = useShop((s) => s.setStaffPassword);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [resetting, setResetting] = useState<StaffAccount | null>(null);

  if (!isOwner(user?.role)) {
    return (
      <div className="p-6 text-center text-body">
        এই পাতাটি মালিকের জন্য। <Link to="/more">ফিরে যান</Link>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="কর্মচারী"
        subtitle={`${bnNum(staff.length)} জনের অ্যাকাউন্ট — লগইন, ভূমিকা ও অচালু করার ব্যবস্থাপনা`}
      />
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-body font-bold text-card"
        >
          <Plus size={18} /> নতুন কর্মচারী
        </button>
      </div>
      <ul className="mt-2">
        {staff.map((row) => (
          <li key={row.id} className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-2 text-body font-bold text-primary">
              {row.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-body font-bold">
                {row.name}
                <span className="rounded-full bg-bg px-2 py-0.5 text-caption font-bold text-muted">
                  {roleLabel(row.role)}
                </span>
                {row.active === false ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-bold text-muted">
                    অচালু
                  </span>
                ) : null}
              </p>
              <p className="text-caption text-muted">{row.id}</p>
              <p className="truncate text-caption text-muted">
                {row.phone} • যোগ হয়েছিল {bnDate(row.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="সম্পাদনা"
                onClick={() => setEditing(row)}
                className="rounded-md p-2 text-primary hover:bg-mint-2"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                aria-label="পাসওয়ার্ড বদলান"
                onClick={() => setResetting(row)}
                className="rounded-md p-2 text-primary hover:bg-mint-2"
              >
                <KeyRound size={16} />
              </button>
              <button
                type="button"
                aria-label="ডিলিট"
                onClick={() => {
                  if (!window.confirm(`${row.name}-এর অ্যাকাউন্ট মুছে ফেলবেন? আগের হিসাবে নাম থাকবে, কিন্তু আর লগইন করা যাবে না।`)) return;
                  if (deleteStaff(row.id)) toast.success("কর্মচারীর অ্যাকাউন্ট মুছে ফেলা হয়েছে");
                  else toast.error("মুছে ফেলা যায়নি");
                }}
                className="rounded-md p-2 text-danger hover:bg-danger/10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
        {!staff.length ? (
          <li className="p-6 text-center text-body text-muted">
            এখনও কোনো কর্মচারী নেই — উপরের বোতাম দিয়ে যোগ করুন
          </li>
        ) : null}
      </ul>

      {open ? <AddStaffModal onClose={() => setOpen(false)} onSave={addStaff} /> : null}
      {editing ? (
        <StaffEditModal
          staff={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            if (updateStaff(editing.id, patch)) {
              setEditing(null);
              toast.success("কর্মচারীর তথ্য আপডেট হয়েছে");
            } else {
              toast.error("কর্মচারীর তথ্য আপডেট করা যায়নি");
            }
          }}
        />
      ) : null}
      {resetting ? (
        <StaffPasswordModal
          staff={resetting}
          onClose={() => setResetting(null)}
          onSave={(password) => {
            const result = setStaffPassword(resetting.id, password);
            if (!result.ok) return toast.error(result.message);
            setResetting(null);
            toast.success(result.message);
          }}
        />
      ) : null}
    </div>
  );
}

function AddStaffModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: { name: string; phone: string; role: StaffRole }) => {
    ok: boolean;
    message: string;
    staff?: StaffAccount;
  };
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("salesman");
  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-heading">নতুন কর্মচারী</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="নাম"
            className="w-full rounded-md border border-line px-3 py-2.5 text-input"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="মোবাইল"
            inputMode="tel"
            className="w-full rounded-md border border-line px-3 py-2.5 text-input"
          />
          <p className="text-caption text-muted">
            মোবাইল নম্বরই লগইন আইডি — সংরক্ষণের পর পরিবর্তন করা যাবে না, আর একই নম্বরে অন্য
            একাউন্ট থাকলে যোগ করা যাবে না।
          </p>
          <label className="block text-caption font-bold">
            ভূমিকা
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input"
            >
              <option value="salesman">সেলস ম্যান — বিক্রি, স্টক ও ক্রেতা খোঁজা</option>
              <option value="manager">ব্যবস্থাপক — সেলসের সবটা + ক্রেতা সম্পাদনা, লাভ-ক্ষতি</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const result = onSave({ name, phone, role });
              if (!result.ok) return toast.error(result.message);
              onClose();
              toast.success(result.message);
            }}
            className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
          >
            সংরক্ষণ
          </button>
          <p className="text-center text-caption text-muted">
            ডিফল্ট পাসওয়ার্ড ১২৩৪৫৬ — প্রথম লগইনে নিজের পাসওয়ার্ড সেট করতে হবে
          </p>
        </div>
      </div>
    </div>
  );
}

function StaffEditModal({
  staff,
  onClose,
  onSave,
}: {
  staff: StaffAccount;
  onClose: () => void;
  onSave: (patch: Partial<Pick<StaffAccount, "name" | "role" | "active">>) => void;
}) {
  const [name, setName] = useState(staff.name);
  const [role, setRole] = useState<StaffRole>(staff.role);
  const [active, setActive] = useState(staff.active !== false);
  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-heading">কর্মচারীর তথ্য সম্পাদনা</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="নাম"
            className="w-full rounded-md border border-line px-3 py-2.5 text-input"
          />
          <div>
            <label className="block text-caption font-bold">
              মূল মোবাইল (অপরিবর্তনীয়)
              <input
                value={staff.phone}
                readOnly
                aria-readonly="true"
                className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2.5 text-input"
              />
            </label>
            <p className="mt-1 mb-3 text-caption text-muted">
              সব লেনদেন ও লগইন এই নম্বরের সঙ্গে যুক্ত। এটি পরিবর্তন করা যাবে না।
            </p>
            <label className="block text-caption font-bold">
              ভূমিকা
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5 text-input"
              >
                <option value="salesman">সেলস ম্যান</option>
                <option value="manager">ব্যবস্থাপক</option>
              </select>
            </label>
          </div>
          <label className="flex items-start gap-2 rounded-md border border-line bg-bg p-3 text-caption">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-primary)]"
            />
            <span>
              <span className="font-bold text-body">কর্মচারী চালু আছে</span>
              <span className="block text-muted">
                অচালু করলে আর লগইন করতে পারবে না; চলমান সেশনও বন্ধ হয়ে যাবে।
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return toast.error("নাম দিন");
              onSave({ name, role, active });
            }}
            className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
          >
            সংরক্ষণ
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffPasswordModal({
  staff,
  onClose,
  onSave,
}: {
  staff: StaffAccount;
  onClose: () => void;
  onSave: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <div
      className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-heading">পাসওয়ার্ড বদলান — {staff.name}</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="নতুন পাসওয়ার্ড"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border border-line px-3 py-2.5 text-input"
          />
          <p className="text-caption text-muted">
            কমপক্ষে ৪ অক্ষর। সংরক্ষণের পর {staff.name} এই নতুন পাসওয়ার্ড দিয়ে লগইন করবে —
            পুরনোটা আর চলবে না।
          </p>
          <button
            type="button"
            disabled={password.length < 4}
            onClick={() => onSave(password)}
            className="w-full rounded-md bg-primary py-3 text-body font-bold text-card disabled:opacity-50"
          >
            সংরক্ষণ
          </button>
        </div>
      </div>
    </div>
  );
}

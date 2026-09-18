import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type DbBranch, type DbUser } from "../lib/db";
import {
  useAuthStore,
  resetStaffPassword,
  createStaffUser,
  toggleStaffStatus,
  unlockStaffUser,
  normalizePhone,
} from "../stores/authStore";
import {
  Building2,
  Key,
  Lock,
  Unlock,
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  Info,
  RotateCcw,
  Plus,
  Sparkles,
  MessageCircle,
} from "lucide-react";

const blank = (): DbBranch => ({
  id: crypto.randomUUID(),
  name: "",
  organization: "",
  address: "",
  phone: "",
  is_active: true,
  created_at: new Date().toISOString(),
});

export default function BranchPads() {
  const user = useAuthStore((s) => s.user);
  const branches = useLiveQuery(() => db.branches.toArray()) || [];
  const staffUsers = useLiveQuery(() => db.users.where("role").equals("staff").toArray()) || [];

  const [activeTab, setActiveTab] = useState<"pad" | "staff" | "info">("pad");
  const [form, setForm] = useState<DbBranch>(blank);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // New staff form state
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("123456");
  const [staffMessage, setStaffMessage] = useState<{
    text: string;
    type: "success" | "error";
    phone?: string;
    name?: string;
    password?: string;
  } | null>(null);

  // Password reset inline state
  const [resettingUser, setResettingUser] = useState<DbUser | null>(null);
  const [customPassword, setCustomPassword] = useState("123456");
  const [resetMessage, setResetMessage] = useState<{
    text: string;
    type: "success" | "error";
    phone?: string;
    name?: string;
    password?: string;
  } | null>(null);

  if (user?.role !== "owner") {
    return (
      <p className="p-6 text-center text-red-600 font-medium">
        শাখা ও ব্যবস্থাপক প্যানেল কেবল দোকানের মালিক ব্যবহার করতে পারবেন।
      </p>
    );
  }

  // Active branch being inspected (form.id or first branch)
  const selectedBranchId = form.id;
  const currentBranchStaff = staffUsers.filter((u) => u.branch_id === selectedBranchId);

  const getWhatsAppUrl = (phone: string, staffName: string, pass = "123456") => {
    const clean = normalizePhone(phone);
    const branchName = form.name || "আমাদের";
    const text = `আসসালামু আলাইকুম ${staffName},\nShopLedGer-এ আপনার "${branchName}" শাখার অ্যাকাউন্ট প্রস্তুত:\n\n📱 মোবাইল: ${phone}\n🔑 প্রাথমিক পাসওয়ার্ড: ${pass}\n\n⚠️ প্রথমবার লগইন করার পর অবশ্যই আপনার নিজস্ব নতুন পাসওয়ার্ড সেট করে নিবেন।\nধন্যবাদ!`;
    return `https://wa.me/88${clean}?text=${encodeURIComponent(text)}`;
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setMessage({ text: "শাখার নাম অবশ্যই দিতে হবে", type: "error" });
      return;
    }
    try {
      await db.branches.put({ ...form, name: form.name.trim() });
      setMessage({ text: "শাখার তথ্য ও প্যাড সফলভাবে সংরক্ষিত হয়েছে!", type: "success" });
    } catch {
      setMessage({ text: "সংরক্ষণ হয়নি, আবার চেষ্টা করুন", type: "error" });
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffMessage(null);
    if (!selectedBranchId) {
      setStaffMessage({ text: "প্রথমে একটি শাখা নির্বাচন বা সংরক্ষণ করুন", type: "error" });
      return;
    }
    const res = await createStaffUser({
      name: newStaffName,
      phone: newStaffPhone,
      password: newStaffPassword,
      branch_id: selectedBranchId,
    });
    if (res.ok) {
      setStaffMessage({
        text: `ব্যবস্থাপক "${newStaffName}" সফলভাবে তৈরি হয়েছে! প্রাথমিক পাসওয়ার্ড: ${newStaffPassword} (১ম লগইনে পরিবর্তন বাধ্যতামূলক)`,
        type: "success",
        phone: newStaffPhone,
        name: newStaffName,
        password: newStaffPassword,
      });
      setNewStaffName("");
      setNewStaffPhone("");
      setNewStaffPassword("123456");
    } else {
      setStaffMessage({ text: res.error || "ব্যবস্থাপক তৈরি করা যায়নি", type: "error" });
    }
  };

  const handleResetPassword = async (staff: DbUser, pass = "123456") => {
    setResetMessage(null);
    const res = await resetStaffPassword(staff.id, pass);
    if (res.ok) {
      setResetMessage({
        text: `পাসওয়ার্ড সফলভাবে রিসেট হয়েছে! নতুন পাসওয়ার্ড: "${pass}" (১ম লগইনে পরিবর্তন করতে হবে)`,
        type: "success",
        phone: staff.phone,
        name: staff.name,
        password: pass,
      });
    } else {
      setResetMessage({ text: res.error || "পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে", type: "error" });
    }
  };

  const handleUnlock = async (userId: string) => {
    const res = await unlockStaffUser(userId);
    if (res.ok) {
      setMessage({
        text: "ব্যবস্থাপকের অ্যাকাউন্ট সফলভাবে আনলক করা হয়েছে!",
        type: "success",
      });
    }
  };

  const handleToggleStatus = async (userId: string) => {
    const res = await toggleStaffStatus(userId);
    if (res.ok) {
      setMessage({
        text: res.is_active
          ? "ব্যবস্থাপকের অ্যাকাউন্ট সক্রিয় করা হয়েছে"
          : "ব্যবস্থাপকের অ্যাকাউন্ট সাময়িক নিষ্ক্রিয় (লক) করা হয়েছে",
        type: "success",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5 pb-24">
      {/* Top Header */}
      <div className="border-b pb-3">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Building2 className="text-teal-700" size={24} />
          শাখা ও ব্যবস্থাপক ব্যবস্থাপনা (মালিক অংশ)
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          নতুন শাখা খোলা, রসিদের নিজস্ব প্যাড নির্ধারণ, শাখা ব্যবস্থাপক নিয়োগ এবং পাসওয়ার্ড রিকভারি নিয়ন্ত্রণ।
        </p>
      </div>

      {/* Global Toast */}
      {message && (
        <div
          className={`p-3 rounded-xl border text-sm font-medium flex items-center justify-between ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            className="text-xs opacity-70 hover:opacity-100"
            onClick={() => setMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Branch Selector Chips */}
      <div className="card space-y-2 bg-gray-50/50">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
          শাখা নির্বাচন করুন
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          {branches.map((b) => {
            const isSelected = form.id === b.id;
            const staffCount = staffUsers.filter((u) => u.branch_id === b.id).length;
            return (
              <button
                key={b.id}
                type="button"
                className={`py-2 px-3.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
                  isSelected
                    ? "bg-teal-700 text-white border-teal-700 shadow-sm"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setForm(b);
                  setMessage(null);
                  setStaffMessage(null);
                  setResettingUser(null);
                }}
              >
                <span>{b.name || "নামহীন শাখা"}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-teal-800 text-teal-100" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {staffCount} কর্মী
                </span>
                {!b.is_active && (
                  <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">নিষ্ক্রিয়</span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            className="btn-primary py-2 px-3.5 text-sm flex items-center gap-1.5"
            onClick={() => {
              setForm(blank());
              setMessage(null);
              setStaffMessage(null);
              setResettingUser(null);
            }}
          >
            <Plus size={16} /> নতুন শাখা
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "pad"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("pad")}
        >
          <Building2 size={16} /> শাখার তথ্য ও প্যাড
        </button>
        <button
          type="button"
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "staff"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("staff")}
        >
          <Users size={16} /> শাখা ব্যবস্থাপক ও পাসওয়ার্ড ({currentBranchStaff.length})
        </button>
        <button
          type="button"
          className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "info"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("info")}
        >
          <Sparkles size={16} /> নতুন শাখা খুললে কী হবে?
        </button>
      </div>

      {/* TAB 1: BRANCH INFO & PAD */}
      {activeTab === "pad" && (
        <form className="card space-y-4" onSubmit={handleSaveBranch}>
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-semibold text-gray-800">
              {form.name ? `"${form.name}" এর তথ্য ও রসিদের প্যাড` : "নতুন শাখা তৈরি"}
            </h3>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded text-teal-700 focus:ring-teal-500"
              />
              <span className={form.is_active ? "text-green-700 font-medium" : "text-gray-400"}>
                {form.is_active ? "শাখা সক্রিয় (চালু)" : "শাখা সাময়িক বন্ধ"}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                শাখার নাম <span className="text-red-500">*</span>
              </span>
              <input
                required
                className="input-field mt-1"
                placeholder="যেমন: আগ্রাবাদ শাখা, চকবাজার শাখা"
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                প্রতিষ্ঠানের নাম <span className="text-red-500">*</span>
              </span>
              <input
                required
                className="input-field mt-1"
                placeholder="যেমন: মেসার্স জনতা এন্টারপ্রাইজ"
                value={form.organization || ""}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">শাখার ঠিকানা</span>
              <input
                className="input-field mt-1"
                placeholder="যেমন: দোকান নং ১২, রোড ৩, চকবাজার"
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">শাখার যোগাযোগ নম্বর</span>
              <input
                className="input-field mt-1"
                placeholder="যেমন: 01800000000"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              রসিদের লোগো (PNG/JPEG/WebP, সর্বোচ্চ ১ MB)
            </span>
            <input
              className="input-field mt-1"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (
                  f.size > 1024 * 1024 ||
                  !["image/png", "image/jpeg", "image/webp"].includes(f.type)
                ) {
                  setMessage({ text: "সঠিক ফরম্যাটে সর্বোচ্চ ১ MB আকারের লোগো দিন", type: "error" });
                  return;
                }
                const reader = new FileReader();
                reader.onload = () =>
                  setForm((prev) => ({ ...prev, logo: String(reader.result) }));
                reader.readAsDataURL(f);
              }}
            />
          </label>

          {form.logo && (
            <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border">
              <img
                src={form.logo}
                alt="প্রতিষ্ঠানের লোগো"
                className="h-14 object-contain rounded border bg-white p-1"
              />
              <button
                type="button"
                className="text-sm text-red-600 hover:underline"
                onClick={() => setForm({ ...form, logo: "" })}
              >
                লোগো সরান
              </button>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button className="btn-primary" type="submit">
              শাখা ও প্যাড সংরক্ষণ
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: STAFF & FORGOT PASSWORD MANAGEMENT */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          {/* Rules alert covering the user's specific requirements */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Key className="text-amber-700" size={18} />
              ব্যবস্থাপক পাসওয়ার্ড/পার্স ভুলে গেলে করণীয় ও নিরাপত্তা নীতি:
            </div>
            <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
              <li>
                <strong>সহজ ডিফল্ট ১২৩৪৫৬ পাসওয়ার্ড:</strong> মালিক নতুন কর্মী যোগ করলে বা রিসেট করলে সহজ পাসওয়ার্ড{" "}
                <code className="bg-amber-100 font-mono px-1 py-0.5 rounded">123456</code> সেট হবে।
              </li>
              <li>
                <strong>প্রথম লগইনে পরিবর্তন বাধ্যতামূলক:</strong> কর্মী প্রথমবার লগইন করলে তাকে বাধ্যতামূলকভাবে নিজস্ব গোপন পাসওয়ার্ড পরিবর্তন করতে হবে।
              </li>
              <li>
                <strong>৫ বার ভুল দিলে লক:</strong> একটানা ৫ বার ভুল পাসওয়ার্ড দিলে অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে লক হয়ে যাবে। মালিক এখান থেকে <strong>"এক ক্লিকে আনলক"</strong> করে দিতে পারবেন।
              </li>
              <li>
                <strong>হোয়াটসঅ্যাপে নোটিফিকেশন:</strong> পাসওয়ার্ড রিসেট বা কর্মী তৈরি করার সাথে সাথে সবুজ হোয়াটসঅ্যাপ বাটনে চাপ দিলে সরাসরি কর্মীকে পাসওয়ার্ড পাঠানো যাবে।
              </li>
            </ul>
          </div>

          {/* Existing Staff List for selected branch */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-800 flex items-center justify-between">
              <span>
                "{form.name || "নির্বাচিত শাখা"}"-এর ব্যবস্থাপক ও কর্মী তালিকা ({currentBranchStaff.length} জন)
              </span>
            </h3>

            {currentBranchStaff.length === 0 ? (
              <div className="py-8 text-center text-gray-500 bg-gray-50 rounded-lg">
                <Users className="mx-auto mb-2 text-gray-400" size={28} />
                <p className="text-sm">এই শাখার জন্য এখনো কোনো ব্যবস্থাপক বা কর্মী তৈরি করা হয়নি।</p>
                <p className="text-xs text-gray-400 mt-1">নিচের ফর্ম ব্যবহার করে নতুন ব্যবস্থাপক যোগ করুন।</p>
              </div>
            ) : (
              <div className="divide-y border rounded-lg overflow-hidden bg-white">
                {currentBranchStaff.map((staff) => {
                  const isLocked = !staff.is_active || (staff.failed_login_attempts || 0) >= 5;
                  return (
                    <div
                      key={staff.id}
                      className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{staff.name}</p>
                          {isLocked ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                              <Lock size={12} /> লক করা{" "}
                              {staff.failed_login_attempts && staff.failed_login_attempts >= 5
                                ? "(৫ বার ভুল পার্স)"
                                : ""}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 flex items-center gap-1">
                              <CheckCircle2 size={12} /> সক্রিয়
                            </span>
                          )}

                          {staff.must_change_password && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                              ১ম লগইনে পাসওয়ার্ড বদলাতে হবে
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          মোবাইল: <span className="font-mono text-gray-700">{staff.phone}</span> • রোল: শাখা ব্যবস্থাপক / সেলস কর্মী
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 1-click Unlock if locked */}
                        {isLocked && (
                          <button
                            type="button"
                            className="py-1.5 px-3 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 shadow-sm"
                            onClick={() => handleUnlock(staff.id)}
                            title="৫ বার ভুলের কারণে লক হওয়া অ্যাকাউন্ট এক ক্লিকে আনলক করুন"
                          >
                            <Unlock size={14} /> এক ক্লিকে আনলক
                          </button>
                        )}

                        {/* Reset password button */}
                        <button
                          type="button"
                          className="py-1.5 px-2.5 rounded-lg border text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200 flex items-center gap-1"
                          onClick={() => {
                            setResettingUser(staff);
                            setCustomPassword("123456");
                            setResetMessage(null);
                          }}
                        >
                          <Key size={14} /> পাসওয়ার্ড রিসেট
                        </button>

                        {/* WhatsApp direct share */}
                        <a
                          href={getWhatsAppUrl(staff.phone, staff.name, "123456")}
                          target="_blank"
                          rel="noreferrer"
                          className="py-1.5 px-2.5 rounded-lg border text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border-green-200 flex items-center gap-1"
                          title="হোয়াটসঅ্যাপে পাসওয়ার্ড পাঠানোর লিংক খুলুন"
                        >
                          <MessageCircle size={14} /> হোয়াটসঅ্যাপ
                        </a>

                        {/* Lock / Unlock toggle */}
                        <button
                          type="button"
                          className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 ${
                            staff.is_active
                              ? "text-red-700 bg-red-50 hover:bg-red-100 border-red-200"
                              : "text-green-700 bg-green-50 hover:bg-green-100 border-green-200"
                          }`}
                          onClick={() => handleToggleStatus(staff.id)}
                        >
                          {staff.is_active ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reset Password Inline Modal/Card */}
          {resettingUser && (
            <div className="card border-2 border-amber-300 bg-amber-50/40 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <div className="flex items-center gap-2">
                  <Key className="text-amber-700" size={18} />
                  <h4 className="font-semibold text-gray-900 text-sm">
                    "{resettingUser.name}" ({resettingUser.phone})-এর পাসওয়ার্ড রিসেট
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  বন্ধ করুন ✕
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  রিসেট করার পর কর্মীর অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে আনলক হয়ে যাবে এবং প্রথম লগইনে নতুন পাসওয়ার্ড পরিবর্তন করতে হবে।
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn-secondary py-1.5 px-3 text-xs bg-white text-gray-800 font-semibold flex items-center gap-1.5 shadow-sm"
                    onClick={() => handleResetPassword(resettingUser, "123456")}
                  >
                    <RotateCcw size={14} className="text-amber-600" />
                    ডিফল্ট "123456" পাসওয়ার্ড দিন
                  </button>
                  <span className="text-xs text-gray-500">অথবা নিজের পছন্দমতো লিখুন:</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input-field text-sm bg-white"
                    placeholder="কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary py-2 px-4 text-xs shrink-0"
                    onClick={() => handleResetPassword(resettingUser, customPassword)}
                  >
                    পাসওয়ার্ড সেট করুন
                  </button>
                </div>

                {resetMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-semibold space-y-2 ${
                      resetMessage.type === "success"
                        ? "bg-green-100 text-green-900 border-green-200"
                        : "bg-red-100 text-red-800 border-red-200"
                    }`}
                  >
                    <p>{resetMessage.text}</p>
                    {resetMessage.type === "success" && resetMessage.phone && (
                      <a
                        href={getWhatsAppUrl(
                          resetMessage.phone,
                          resetMessage.name || "ব্যবস্থাপক",
                          resetMessage.password || "123456"
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow-sm transition-colors"
                      >
                        <MessageCircle size={15} /> হোয়াটসঅ্যাপে পাসওয়ার্ড পাঠান
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Add New Staff/Manager Form */}
          <form className="card space-y-4" onSubmit={handleAddStaff}>
            <div className="border-b pb-2 flex items-center gap-2">
              <UserPlus className="text-teal-700" size={18} />
              <h3 className="font-semibold text-gray-800 text-sm">
                "{form.name || "নির্বাচিত শাখা"}"-এর জন্য নতুন শাখা ব্যবস্থাপক/কর্মী যোগ করুন
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">ব্যবস্থাপকের নাম *</span>
                <input
                  required
                  className="input-field mt-1 text-sm"
                  placeholder="যেমন: মামুন হাসান"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-gray-700">মোবাইল নম্বর (১১ সংখ্যা) *</span>
                <input
                  required
                  className="input-field mt-1 text-sm"
                  placeholder="যেমন: 01711223344"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-gray-700">প্রাথমিক পাসওয়ার্ড *</span>
                <input
                  required
                  className="input-field mt-1 text-sm font-mono"
                  placeholder="ডিফল্ট: 123456"
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                />
              </label>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <button type="submit" className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                <Plus size={14} /> ব্যবস্থাপক যুক্ত করুন
              </button>

              {staffMessage && (
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold ${
                      staffMessage.type === "success" ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {staffMessage.text}
                  </span>
                  {staffMessage.type === "success" && staffMessage.phone && (
                    <a
                      href={getWhatsAppUrl(
                        staffMessage.phone,
                        staffMessage.name || "ব্যবস্থাপক",
                        staffMessage.password || "123456"
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 bg-green-700 hover:bg-green-800 text-white font-bold py-1.5 px-3 rounded-lg text-xs shrink-0"
                    >
                      <MessageCircle size={14} /> হোয়াটসঅ্যাপে পাঠান
                    </a>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: NEW BRANCH IMPACT GUIDE */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Info className="text-teal-700" size={20} />
              নতুন শাখা খুললে সিস্টেমে কী কী ঘটবে?
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              ShopLedGer একটি মাল্টি-শাখা ভিত্তিক অফলাইন-ফার্স্ট অ্যাকাউন্টিং সিস্টেম। একটি নতুন শাখা যুক্ত করার পর নিচের বিষয়গুলো কার্যকর হয়:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl space-y-1">
                <p className="font-semibold text-teal-900 text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-teal-700" /> ১. শাখাভিত্তিক সম্পূর্ণ আলাদা গণনা
                </p>
                <p className="text-xs text-teal-800 leading-relaxed">
                  নতুন শাখার পণ্যের মজুত ও স্টক সম্পূর্ণ আলাদা হিসেবে গণনা হয়। এই শাখার মালামাল বিক্রয় হলে অন্য শাখার স্টকে কোনো প্রভাব পড়বে না।
                </p>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
                <p className="font-semibold text-blue-900 text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-blue-700" /> ২. শুধু নিজের শাখার দেখতে পারবে
                </p>
                <p className="text-xs text-blue-800 leading-relaxed">
                  নতুন শাখায় নিযুক্ত ব্যবস্থাপক ও কর্মী কেবল নিজের শাখার পণ্য বিক্রি, ক্রয় ও খরচ দেখতে পারবে। প্রধান শাখা বা অন্য শাখার গোপনীয় তথ্য দেখতে পারবে না।
                </p>
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl space-y-1">
                <p className="font-semibold text-purple-900 text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-purple-700" /> ৩. ক্রয়-বিক্রয়ের শাখার প্যাড ও রসিদ
                </p>
                <p className="text-xs text-purple-800 leading-relaxed">
                  যে শাখায় ক্রয়-বিক্রয় সংঘটিত হবে, ক্যাশমেমো ও WhatsApp রসিদে হুবহু সেই শাখার নাম, ঠিকানা, ফোন নম্বর এবং নির্ধারিত নিজস্ব লোগো ব্যবহৃত হবে।
                </p>
              </div>

              <div className="p-3 bg-green-50/70 border border-green-100 rounded-xl space-y-1">
                <p className="font-semibold text-green-900 text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-green-700" /> ৪. পৃথক ও সমন্বিত কেন্দ্রীয় রিপোর্ট
                </p>
                <p className="text-xs text-green-800 leading-relaxed">
                  মালিকের কেন্দ্রীয় ড্যাশবোর্ড থেকে সকল শাখার সমন্বিত হিসাব যেমন দেখা যাবে, তেমনি ড্রপডাউন থেকে যেকোনো নির্দিষ্ট শাখার আলাদা দৈনিক/মাসিক লাভ-ক্ষতি ও বাকি রিপোর্ট পাওয়া যাবে।
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl mt-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle size={15} className="text-amber-700" /> নিরাপত্তা নীতি ও পার্স/পাসওয়ার্ড রিকভারি:
              </p>
              <p className="text-amber-800 leading-relaxed">
                সহজ ডিফল্ট পাসওয়ার্ড (১২৩৪৫৬) প্রদান করা হয় এবং প্রথম লগইনে তা বাধ্যতামূলক পরিবর্তন করতে হয়। টানা ৫ বার ভুল পাসওয়ার্ড দিলে অ্যাকাউন্টটি লক হয়ে যায়, যা মালিক এই প্যানেলে এসে <strong>"এক ক্লিকে আনলক"</strong> ও পাসওয়ার্ড রিসেট করে তাৎক্ষণিক <strong>হোয়াটসঅ্যাপের মাধ্যমে</strong> জানিয়ে দিতে পারেন।
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

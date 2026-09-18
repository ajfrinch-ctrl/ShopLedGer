import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type DbBranch } from "../lib/db";
import { useAuthStore } from "../stores/authStore";
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
  const [form, setForm] = useState<DbBranch>(blank);
  const [message, setMessage] = useState("");
  if (user?.role !== "owner")
    return <p className="p-6">প্যাড সেটিংস শুধু মালিক পরিবর্তন করতে পারবেন।</p>;
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h2 className="text-xl font-bold">শাখা ও প্রতিষ্ঠানের প্যাড</h2>
      <p>প্রতিটি শাখার রসিদে তার নিজস্ব প্যাড ব্যবহৃত হবে।</p>
      <div className="flex flex-wrap gap-2">
        {branches.map((b) => (
          <button
            className="btn-secondary"
            key={b.id}
            onClick={() => {
              setForm(b);
              setMessage("");
            }}
          >
            {b.name}
          </button>
        ))}
        <button className="btn-primary" onClick={() => setForm(blank())}>
          নতুন শাখা
        </button>
      </div>
      <form
        className="card space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await db.branches.put({ ...form, name: form.name.trim() });
            setMessage("প্যাড সংরক্ষিত হয়েছে");
          } catch {
            setMessage("সংরক্ষণ হয়নি, আবার চেষ্টা করুন");
          }
        }}
      >
        {(["name", "organization", "address", "phone"] as const).map(
          (key, i) => (
            <label className="block" key={key}>
              {["শাখার নাম", "প্রতিষ্ঠানের নাম", "ঠিকানা", "মোবাইল নম্বর"][i]}
              <input
                required={i < 2}
                className="input-field"
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ),
        )}
        <label className="block">
          লোগো (PNG/JPEG/WebP, সর্বোচ্চ ১ MB)
          <input
            className="input-field"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (
                f.size > 1024 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(f.type)
              ) {
                setMessage("সঠিক ফরম্যাটে সর্বোচ্চ ১ MB লোগো দিন");
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
          <div>
            <img src={form.logo} alt="প্রতিষ্ঠানের লোগো" className="h-20" />
            <button
              type="button"
              onClick={() => setForm({ ...form, logo: "" })}
            >
              লোগো সরান
            </button>
          </div>
        )}
        <button className="btn-primary">প্যাড সংরক্ষণ</button>
        <p role="status">{message}</p>
      </form>
    </div>
  );
}

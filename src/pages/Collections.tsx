import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LedgerEntry } from "../lib/db";
import { ledgerRows, money, saveLedgerEntry, supplierId } from "../lib/ledger";
import { useAuthStore } from "../stores/authStore";
import { useSalesStore } from "../stores/salesStore";
import { usePurchaseStore } from "../stores/purchaseStore";
import LedgerReceipt from "../components/LedgerReceipt";
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
export default function Collections() {
  const user = useAuthStore((s) => s.user);
  const sales = useSalesStore((s) => s.sales);
  const purchases = usePurchaseStore((s) => s.purchases);
  const data = useLiveQuery(async () => ({
    entries: await db.ledgerEntries.toArray(),
    customers: await db.customers.toArray(),
    branches: await db.branches.toArray(),
    audits: await db.ledgerAudits.toArray(),
    collections: await db.collections.toArray(),
  }));
  const [params] = useSearchParams();
  const [type, setType] = useState<"customer" | "supplier">(
    params.get("type") === "supplier" ? "supplier" : "customer",
  );
  const [party, setParty] = useState(params.get("party") || "");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<LedgerEntry | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<LedgerEntry | null>(null);
  const [newName, setNewName] = useState("");
  const [history, setHistory] = useState(false);
  if (!user || user.role === "customer")
    return <p className="p-6">এই খাতা শুধু মালিক ও কর্মীদের জন্য।</p>;
  if (!data) return <p className="p-6">খাতা লোড হচ্ছে…</p>;
  const parties = new Map<string, string>();
  if (type === "customer") {
    data.customers.forEach((c) => parties.set(c.id, c.name));
    sales.forEach((s) => {
      if (s.customer_id)
        parties.set(s.customer_id, s.customer_name || s.customer_id);
    });
  } else
    purchases.forEach((p) => {
      if (p.supplier) parties.set(supplierId(p.supplier), p.supplier);
    });
  data.entries
    .filter((e) => e.party_type === type)
    .forEach((e) => parties.set(e.party_id, e.party_name));
  const rows = ledgerRows(
    party,
    sales,
    purchases,
    data.entries,
    data.collections,
  );
  const balance = rows[rows.length - 1]?.balance || 0;
  const existing = form && data.entries.some((e) => e.id === form.id);
  const branchName = (id: string) =>
    data.branches.find((b) => b.id === id)?.name || id;
  const canEdit = (e: LedgerEntry) =>
    !e.cancelled && (user.role === "owner" || e.branch_id === user.branch_id);
  function create(
    kind: "opening" | "payment",
    id = party,
    name = parties.get(party) || "",
  ) {
    setMessage("");
    setReason("");
    setForm({
      id: crypto.randomUUID(),
      party_id: id,
      party_name: name,
      party_type: type,
      kind,
      amount: 0,
      date: today(),
      branch_id: user!.branch_id || data!.branches[0]?.id || "",
      method: "নগদ টাকা",
      reference: "",
      note: "",
      cancelled: false,
      created_at: new Date().toISOString(),
      created_by: user!.id,
    });
  }
  async function save(entry: LedgerEntry) {
    setBusy(true);
    setMessage("");
    try {
      await saveLedgerEntry(
        entry,
        user!,
        useSalesStore.getState().sales,
        usePurchaseStore.getState().purchases,
        reason,
      );
      setParty(entry.party_id);
      setForm(null);
      setMessage("লেনদেন সংরক্ষিত হয়েছে");
      if (entry.kind === "payment" && !entry.cancelled) setReceipt(entry);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "সংরক্ষণ হয়নি");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">বাকি ও পরিশোধের খাতা</h2>
          <p className="text-sm text-gray-500">
            সব শাখার সমন্বিত হিসাব • অগ্রিম নয়
          </p>
        </div>
        <Link className="text-teal-700 underline" to="/branch-pads">
          শাখার প্যাড
        </Link>
      </div>
      <div className="flex gap-2">
        {(["customer", "supplier"] as const).map((t) => (
          <button
            key={t}
            className={type === t ? "btn-primary" : "btn-secondary"}
            onClick={() => {
              setType(t);
              setParty("");
              setForm(null);
              setMessage("");
            }}
          >
            {t === "customer" ? "ক্রেতার বাকি" : "সাপ্লায়ারের বাকি"}
          </button>
        ))}
      </div>
      {type === "supplier" && (
        <p className="text-sm text-amber-800">
          পুরোনো ক্রয়ে পেমেন্টের ধরন ছিল না, তাই স্বয়ংক্রিয় বাকি ধরা হয়নি।
          প্রয়োজন হলে পুরোনো বাকি যোগ করুন। একই সাপ্লায়ারের জন্য সব শাখায় একই
          নাম ব্যবহার করুন।
        </p>
      )}
      <div className="card space-y-3">
        <input
          className="input-field"
          aria-label="ব্যক্তি খুঁজুন"
          placeholder="নাম দিয়ে খুঁজুন"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="ব্যক্তি নির্বাচন"
          className="input-field"
          value={party}
          onChange={(e) => {
            setParty(e.target.value);
            setForm(null);
          }}
        >
          <option value="">ব্যক্তি নির্বাচন করুন</option>
          {[...parties]
            .filter(([, n]) => n.includes(search))
            .map(([id, n]) => (
              <option key={id} value={id}>
                {n} · {id.slice(-6)}
              </option>
            ))}
        </select>
        <details>
          <summary className="cursor-pointer text-teal-700">
            নতুন ব্যক্তির পুরোনো বাকি
          </summary>
          <input
            className="input-field my-2"
            placeholder="ব্যক্তির নাম"
            aria-label="নতুন ব্যক্তির নাম"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            className="btn-secondary"
            disabled={!newName.trim()}
            onClick={() => {
              const name = newName.trim();
              create(
                "opening",
                type === "supplier" ? supplierId(name) : crypto.randomUUID(),
                name,
              );
            }}
          >
            বাকি যোগ করুন
          </button>
        </details>
      </div>
      {party && (
        <>
          <div className="card flex justify-between flex-wrap gap-3">
            <div>
              <p>{parties.get(party)} — বর্তমান বাকি</p>
              <strong className="text-2xl text-teal-700">
                {money(balance)}
              </strong>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-secondary"
                onClick={() => create("opening")}
              >
                পুরোনো বাকি
              </button>
              <button
                disabled={balance <= 0}
                className="btn-primary disabled:opacity-40"
                onClick={() => create("payment")}
              >
                {type === "customer" ? "টাকা আদায়" : "টাকা পরিশোধ"}
              </button>
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead>
                <tr>
                  {[
                    "তারিখ / বিবরণ",
                    "শাখা",
                    "বাকি বৃদ্ধি",
                    "আদায় / পরিশোধ",
                    "অবশিষ্ট",
                    "করণীয়",
                  ].map((t) => (
                    <th className="p-2 border-b" key={t}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const entry = data.entries.find((e) => e.id === r.id);
                  return (
                    <tr key={r.id}>
                      <td className="p-2 border-b">
                        {r.date.slice(0, 10)}
                        <br />
                        {r.label}
                      </td>
                      <td className="p-2">{branchName(r.branch_id)}</td>
                      <td className="p-2">{money(r.debit)}</td>
                      <td className="p-2">{money(r.credit)}</td>
                      <td className="p-2 font-bold">{money(r.balance)}</td>
                      <td className="p-2">
                        {entry && (
                          <div className="flex gap-2">
                            {entry.kind === "payment" && (
                              <button
                                className="text-teal-700"
                                onClick={() => setReceipt(entry)}
                              >
                                রসিদ
                              </button>
                            )}
                            {canEdit(entry) && (
                              <button
                                onClick={() => {
                                  setForm(entry);
                                  setReason("");
                                  setMessage("");
                                }}
                              >
                                সংশোধন / বাতিল
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && <p className="p-4">এখনও কোনো লেনদেন নেই।</p>}
          </div>
          <button
            className="btn-secondary"
            onClick={() => setHistory(!history)}
          >
            পরিবর্তনের ইতিহাস {history ? "লুকান" : "দেখুন"}
          </button>
          {history && (
            <div className="card space-y-3">
              {data.audits
                .filter((a) => a.after.party_id === party)
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((a) => (
                  <div key={a.id} className="border-b pb-3 text-sm">
                    <p className="font-bold">
                      {a.action} • {a.actor} •{" "}
                      {new Date(a.at).toLocaleString("bn-BD")}
                    </p>
                    <p>{a.reason}</p>
                    <details>
                      <summary>আগের ও পরের তথ্য</summary>
                      {[a.before, a.after].map((e, i) => (
                        <div key={i} className="p-2 bg-gray-50 my-1">
                          <strong>{i === 0 ? "আগে" : "পরে"}</strong>
                          {e ? (
                            <p>
                              {e.party_name} • {e.date} • {money(e.amount)} •{" "}
                              {branchName(e.branch_id)} • {e.method} •
                              রেফারেন্স: {e.reference || "—"} • মন্তব্য:{" "}
                              {e.note || "—"} •{" "}
                              {e.cancelled ? "বাতিল" : "সক্রিয়"}
                            </p>
                          ) : (
                            <p>নেই</p>
                          )}
                        </div>
                      ))}
                    </details>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
      {form && (
        <form
          className="card space-y-3 border-teal-600"
          onSubmit={(e) => {
            e.preventDefault();
            void save(form);
          }}
        >
          <h3 className="font-bold">
            {form.party_name} —{" "}
            {form.kind === "opening" ? "পুরোনো বাকি" : "আদায় / পরিশোধ"}
          </h3>
          <label className="block">
            তারিখ
            <input
              required
              type="date"
              className="input-field"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="block">
            লেনদেনের শাখা
            <select
              disabled={!!existing || user.role === "staff"}
              className="input-field"
              value={form.branch_id}
              onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
            >
              {data.branches
                .filter((b) => b.is_active)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            টাকার পরিমাণ
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              className="input-field"
              value={form.amount || ""}
              onChange={(e) =>
                setForm({ ...form, amount: Number(e.target.value) })
              }
            />
          </label>
          {form.kind === "payment" && (
            <>
              <label className="block">
                মাধ্যম
                <select
                  className="input-field"
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                >
                  {["নগদ টাকা", "ব্যাংক", "বিকাশ", "নগদ (মোবাইল ব্যাংকিং)"].map(
                    (m) => (
                      <option key={m}>{m}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="block">
                ট্রানজ্যাকশন আইডি / রেফারেন্স (ঐচ্ছিক)
                <input
                  className="input-field"
                  value={form.reference}
                  onChange={(e) =>
                    setForm({ ...form, reference: e.target.value })
                  }
                />
              </label>
            </>
          )}
          <label className="block">
            মন্তব্য (ঐচ্ছিক)
            <input
              className="input-field"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          {existing && (
            <label className="block">
              পরিবর্তন / বাতিলের কারণ
              <input
                required
                className="input-field"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="flex gap-2 flex-wrap">
            <button disabled={busy} className="btn-primary">
              সংরক্ষণ
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setForm(null)}
            >
              বন্ধ করুন
            </button>
            {existing && (
              <button
                disabled={busy}
                type="button"
                className="btn-secondary text-red-700"
                onClick={() => {
                  if (
                    window.confirm("লেনদেন বাতিল করবেন? ইতিহাস সংরক্ষিত থাকবে।")
                  )
                    void save({
                      ...data.entries.find((e) => e.id === form.id)!,
                      cancelled: true,
                    });
                }}
              >
                লেনদেন বাতিল
              </button>
            )}
          </div>
        </form>
      )}
      <p role="status" className="text-teal-800">
        {message}
      </p>
      <p className="text-xs text-gray-500">
        তথ্য এই ব্রাউজারে সংরক্ষিত থাকে; অন্য ডিভাইসের সঙ্গে স্বয়ংক্রিয় সিঙ্ক হয়
        না।
      </p>
      {receipt && (
        <LedgerReceipt
          entry={receipt}
          branch={data.branches.find((b) => b.id === receipt.branch_id)}
          balance={
            ledgerRows(
              receipt.party_id,
              sales,
              purchases,
              data.entries,
              data.collections,
            ).find((r) => r.id === receipt.id)?.balance || 0
          }
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}

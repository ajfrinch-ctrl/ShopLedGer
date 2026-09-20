import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminActions } from "@/components/admin-actions";
import { FileText, Image as ImageIcon, MessageCircle, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ReceiptModal } from "@/components/receipt-modal";
import { customerDue } from "@/lib/calc";
import { bnDate, isBangladeshMobile, money, normalizePhone, todayKey, whatsappNumber } from "@/lib/format";
import type { PdfDocument } from "@/lib/reports/pdf";
import { sharePdfImagesToWhatsApp, sharePdfToWhatsApp } from "@/lib/reports/share-pdf";
import { SHOP } from "@/lib/shop";
import { canManage, isSystemAdmin, useShop } from "@/lib/store";
import type { Sale } from "@/lib/types";

export const Route = createFileRoute("/customers/$id")({
  ssr: false,
  component: Profile,
});

function Profile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const customer = useShop((s) => s.customers.find((c) => c.id === id));
  const allCustomers = useShop((s) => s.customers);
  const user = useShop((s) => s.user);
  const allSales = useShop((s) => s.sales);
  const allCol = useShop((s) => s.collections);
  // Zustand selectors must return stable snapshots, not a new filtered array.
  const sales = useMemo(() => allSales.filter((s) => s.customerId === id), [allSales, id]);
  const collections = useMemo(
    () => allCol.filter((c) => c.kind === "customer" && c.partyId === id),
    [allCol, id],
  );
  const addCollection = useShop((s) => s.addCollection);
  const updateCustomer = useShop((s) => s.updateCustomer);
  const deleteCustomer = useShop((s) => s.deleteCustomer);
  const [amount, setAmount] = useState(0);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [sharingStatement, setSharingStatement] = useState<"pdf" | "image" | null>(null);

  const due = customer ? customerDue(customer.id, allSales, allCol) : 0;

  const ledger = useMemo(() => {
    const rows: {
      key: string;
      date: string;
      label: string;
      debit: number;
      credit: number;
      sale?: Sale;
    }[] = [];
    for (const s of sales) {
      rows.push({
        key: s.id,
        date: s.date,
        label: s.billNo,
        debit: s.total,
        credit: s.paid,
        sale: s,
      });
    }
    for (const c of collections) {
      rows.push({
        key: c.id,
        date: c.date,
        label: `আদায় • ${c.method}`,
        debit: 0,
        credit: c.amount,
      });
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    let bal = 0;
    return rows.map((r) => {
      bal += r.debit - r.credit;
      return { ...r, bal };
    });
  }, [sales, collections]);

  if (!customer || (user?.role === "customer" && user.customerId !== id)) {
    return (
      <div className="p-6 text-center text-body">
        ক্রেতা পাওয়া যায়নি। <Link to="/customers">ফিরে যান</Link>
      </div>
    );
  }

  const collect = () => {
    if (amount <= 0) return toast.error("পরিমাণ দিন");
    addCollection({
      date: todayKey(),
      partyId: customer.id,
      partyName: customer.name,
      kind: "customer",
      amount,
      method: "নগদ",
    });
    setAmount(0);
    toast.success("আদায় সংরক্ষণ হয়েছে");
  };

  const openEdit = () => {
    setEditName(customer.name);
    setEditPhone(customer.phone);
    setEditAddress(customer.address);
    setEditOpen(true);
  };

  const saveEdit = () => {
    const name = editName.trim();
    const phone = normalizePhone(editPhone);
    if (!name) return toast.error("নাম দিন");
    if (!isBangladeshMobile(phone)) return toast.error("সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন");
    if (allCustomers.some((c) => c.id !== customer.id && normalizePhone(c.phone) === phone)) {
      return toast.error("এই মোবাইল নম্বরটি অন্য ক্রেতার আছে");
    }
    updateCustomer(customer.id, { name, phone, address: editAddress.trim() });
    setEditOpen(false);
    toast.success("ক্রেতার তথ্য আপডেট হয়েছে");
  };

  const wa = whatsappNumber(customer.phone);
  const canEdit = canManage(user?.role);
  const masterAdmin = isSystemAdmin(user?.role);
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const totalPaid = sales.reduce((sum, sale) => sum + sale.paid, 0) + collections.reduce((sum, row) => sum + row.amount, 0);
  const statementDocument: PdfDocument = {
    title: "ক্রেতার হিসাব বিবরণী",
    subtitle: `${customer.name} • ${customer.phone}`,
    filename: `customer-statement-${customer.id}.pdf`,
    sections: [
      {
        title: "সারাংশ",
        headers: ["বিবরণ", "টাকা"],
        columns: [{ kind: "text" }, { kind: "money" }],
        rows: [
          ["মোট বিক্রি", money(totalSales)],
          ["মোট জমা", money(totalPaid)],
          ["বর্তমান বাকি", money(due)],
        ],
        emphasisRows: [2],
      },
      {
        title: "লেনদেনের বিবরণ",
        headers: ["তারিখ", "বিবরণ", "দেনা", "জমা", "ব্যালেন্স"],
        columns: [
          { kind: "date" },
          { kind: "text", minWidth: 120, weight: 3 },
          { kind: "money" },
          { kind: "money" },
          { kind: "money" },
        ],
        rows: ledger.map((row) => [
          bnDate(row.date),
          row.label,
          money(row.debit),
          money(row.credit),
          money(row.bal),
        ]),
      },
    ],
    note: "এই বিবরণী বর্তমান দোকানের খাতা অনুযায়ী তৈরি করা হয়েছে।",
  };
  const statementMessage = [
    SHOP.name,
    `ক্রেতার হিসাব: ${customer.name}`,
    `বর্তমান বাকি: ${money(due)}`,
    "এই বার্তার সঙ্গে হিসাবের PDF পাঠানো হয়েছে।",
  ].join("\n");

  const sendStatementToWhatsApp = async (kind: "pdf" | "image") => {
    if (sharingStatement) return;
    setSharingStatement(kind);
    try {
      const result =
        kind === "image"
          ? await sharePdfImagesToWhatsApp({
              document: statementDocument,
              phone: customer.phone,
              text: statementMessage,
            })
          : await sharePdfToWhatsApp({
              document: statementDocument,
              phone: customer.phone,
              text: statementMessage,
            });
      const label = kind === "image" ? "ছবি" : "PDF";
      if (result === "shared") {
        toast.success(`${label} শেয়ার মেনু খোলা হয়েছে — WhatsApp নির্বাচন করুন`);
      } else if (result === "fallback") {
        toast.success(`${label} ডাউনলোড হয়েছে এবং ক্রেতার WhatsApp চ্যাট খোলা হয়েছে`);
      }
    } catch {
      toast.error(`${kind === "image" ? "ছবি" : "PDF"} তৈরি করা যায়নি। আবার চেষ্টা করুন।`);
    } finally {
      setSharingStatement(null);
    }
  };

  return (
    <div className="px-4 pt-4">
      <Link to="/customers" className="mb-3 inline-block text-body font-bold text-primary">
        ← ক্রেতার তালিকা
      </Link>
      <div className="rounded-xl bg-primary p-5 text-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-heading font-bold">{customer.name}</h1>
            <p className="mt-1 text-body text-mint-2">
              {customer.phone} {customer.address ? `• ${customer.address}` : ""}
            </p>
          </div>
          {canEdit ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={openEdit}
                aria-label="ক্রেতার তথ্য সম্পাদনা"
                className="rounded-md bg-card/15 p-2 text-card"
              >
                <Pencil size={16} />
              </button>
              {masterAdmin ? (
                <AdminActions
                  onDelete={() => {
                    if (!window.confirm("এই ক্রেতা ও তার সব হিসাব মুছে ফেলবেন?")) return;
                    if (deleteCustomer(customer.id)) {
                      toast.success("ক্রেতা ও সংশ্লিষ্ট সব হিসাব মুছে ফেলা হয়েছে");
                      void navigate({ to: "/customers" });
                    } else {
                      toast.error("ক্রেতা মুছে ফেলা যায়নি");
                    }
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-caption text-mint-2">বর্তমান বাকি</p>
        <p className="text-heading font-bold tabular">{money(due)}</p>
      </div>

      {due > 0 && user?.role !== "customer" ? (
        <div className="mt-4 rounded-xl border border-line bg-card p-4">
          <p className="mb-2 text-body font-bold">বাকি আদায়</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder="পরিমাণ"
              className="flex-1 rounded-md border border-line px-3 py-2.5 text-input"
            />
            <button
              type="button"
              onClick={() => setAmount(due)}
              className="rounded-md bg-mint-2 px-3 text-caption font-bold text-primary"
            >
              সব
            </button>
            <button
              type="button"
              onClick={collect}
              className="rounded-md bg-primary px-4 text-body font-bold text-card"
            >
              জমা
            </button>
          </div>

        </div>
      ) : null}

      {canEdit && wa.length >= 10 ? (
        <div className="mt-4 rounded-xl border border-[#b9ebc8] bg-[#f0fff4] p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
              <MessageCircle size={20} fill="currentColor" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body font-bold text-[#075E54]">ক্রেতাকে হিসাবের PDF পাঠান</p>
              <p className="truncate text-caption text-[#52756d]">
                {customer.name} • {customer.phone}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void sendStatementToWhatsApp("pdf")}
              disabled={sharingStatement !== null}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#128C7E] px-2 py-3 text-caption font-bold text-white shadow-[0_6px_16px_rgba(18,140,126,0.22)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText size={16} />
              {sharingStatement === "pdf" ? "তৈরি হচ্ছে…" : "PDF পাঠান"}
            </button>
            <button
              type="button"
              onClick={() => void sendStatementToWhatsApp("image")}
              disabled={sharingStatement !== null}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#128C7E] px-2 py-3 text-caption font-bold text-[#075E54] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImageIcon size={16} />
              {sharingStatement === "image" ? "তৈরি হচ্ছে…" : "ছবি পাঠান"}
            </button>
          </div>
          <p className="mt-2 text-center text-caption text-[#52756d]">
            ছবিটি PDF-এর মতোই তৈরি হবে • ফোনের শেয়ার মেনুতে WhatsApp বেছে নিন
          </p>
        </div>
      ) : null}

      <h3 className="mt-5 mb-2 text-body font-bold">খাতা</h3>
      <p className="mb-3 text-caption text-muted">
        বিলে চাপলে কেনা পণ্যের সম্পূর্ণ রসিদ দেখতে পাবেন।
      </p>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {ledger.length ? (
          ledger
            .slice()
            .reverse()
            .map((r) => (
              <button
                key={r.key}
                type="button"
                disabled={!r.sale}
                aria-label={r.sale ? `${r.label} — রসিদ দেখুন` : undefined}
                onClick={() => r.sale && setReceipt(r.sale)}
                className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-0 enabled:hover:bg-mint enabled:focus-visible:outline-2 enabled:focus-visible:outline-primary"
              >
                <div>
                  <p className="text-body font-normal">{r.label}</p>
                  <p className="text-caption text-muted">{bnDate(r.date)}</p>
                  {r.sale ? (
                    <p className="mt-1 text-caption font-bold text-primary">রসিদ দেখুন →</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p
                    className={`text-body font-bold tabular ${r.debit ? "text-fg" : "text-primary"}`}
                  >
                    {r.debit ? money(r.debit) : `+ ${money(r.credit)}`}
                  </p>
                  <p className="text-caption text-muted tabular">ব্যালেন্স {money(r.bal)}</p>
                </div>
              </button>
            ))
        ) : (
          <p className="p-6 text-center text-body text-muted">এখনও কোনো লেনদেন নেই</p>
        )}
      </div>

      {editOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-heading font-bold">ক্রেতার তথ্য সম্পাদনা</h2>
              <button type="button" aria-label="বন্ধ" onClick={() => setEditOpen(false)}>
                ×
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="নাম"
                className="w-full rounded-md border border-line px-3 py-2.5 text-input"
              />
              <div>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="মোবাইল / WhatsApp"
                  inputMode="tel"
                  className="w-full rounded-md border border-line px-3 py-2.5 text-input"
                />
                <p className="mt-1 text-caption text-muted">এই নম্বরেই WhatsApp বার্তা যাবে</p>
              </div>
              <textarea
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="ঠিকানা"
                rows={2}
                className="w-full resize-none rounded-md border border-line px-3 py-2.5 text-input"
              />
              <button
                type="button"
                onClick={saveEdit}
                className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
              >
                সংরক্ষণ
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {receipt ? <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} /> : null}
    </div>
  );
}

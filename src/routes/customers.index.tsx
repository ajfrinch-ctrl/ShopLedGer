import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, MessageCircle, Plus, X } from "lucide-react";
import { AdminActions } from "@/components/admin-actions";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/app-shell";
import { customerDue } from "@/lib/calc";
import { bnNum, money, whatsappNumber } from "@/lib/format";
import { canManage, isOwner, isSystemAdmin, useShop } from "@/lib/store";
import type { CustomerRegistration } from "@/lib/types";

export const Route = createFileRoute("/customers/")({
  ssr: false,
  component: CustomersPage,
});

function CustomersPage() {
  const customers = useShop((s) => s.customers);
  const customerRequests = useShop((s) => s.customerRequests);
  const user = useShop((s) => s.user);
  const sales = useShop((s) => s.sales);
  const collections = useShop((s) => s.collections);
  const addCustomer = useShop((s) => s.addCustomer);
  const approveCustomerRegistration = useShop((s) => s.approveCustomerRegistration);
  const rejectCustomerRegistration = useShop((s) => s.rejectCustomerRegistration);
  const updateCustomerRegistration = useShop((s) => s.updateCustomerRegistration);
  const deleteCustomerRegistration = useShop((s) => s.deleteCustomerRegistration);
  const canEdit = canManage(user?.role);
  const masterAdmin = isSystemAdmin(user?.role);
  const pendingRequests = useMemo(
    () => customerRequests.filter((request) => request.status === "pending"),
    [customerRequests],
  );
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [address, setAddress] = useState("");
  const [editRegistration, setEditRegistration] = useState<CustomerRegistration | null>(null);

  const rows = useMemo(() => {
    return customers
      .map((c) => ({ c, due: customerDue(c.id, sales, collections) }))
      .filter(() => user?.role !== "salesman" || q.trim())
      .filter(({ c }) => user?.role !== "customer" || c.id === user.customerId)
      .filter(
        (r) =>
          !q.trim() ||
          r.c.name.includes(q) ||
          r.c.id.toLowerCase().includes(q.toLowerCase()) ||
          r.c.phone.includes(q) ||
          r.c.address.includes(q),
      )
      .sort((a, b) => b.due - a.due);
  }, [customers, sales, collections, q, user?.role, user?.customerId]);

  return (
    <div>
      <PageTitle title="ক্রেতা" subtitle={user?.role === "salesman" ? "সার্চ করে ক্রেতা খুঁজুন" : `${bnNum(customers.length)} জন খাতা`} />

      {isOwner(user?.role) && pendingRequests.length ? (
        <section className="mx-4 mt-3 overflow-hidden rounded-lg border border-warn/30 bg-card">
          <div className="flex items-center justify-between bg-warn/10 px-3 py-2.5">
            <div>
              <h2 className="text-body font-bold">নতুন ক্রেতা রেজিস্ট্রেশন</h2>
              <p className="text-caption text-muted">মালিকের অনুমোদন দরকার</p>
            </div>
            <span className="rounded-full bg-card px-2.5 py-1 text-caption font-bold text-warn">
              {bnNum(pendingRequests.length)}টি অপেক্ষমাণ
            </span>
          </div>
          <ul className="divide-y divide-line">
            {pendingRequests.map((request) => (
              <li key={request.id} className="p-3">
                <div className="min-w-0">
                  <p className="text-body font-bold">{request.name}</p>
                  <p className="text-caption text-muted">{request.id}</p>
                  <p className="text-caption text-muted">
                    {request.phone} {request.address ? `• ${request.address}` : ""}
                  </p>
                  <p className="mt-1 text-caption text-primary">মূল মোবাইল নম্বর অপরিবর্তনীয়; পরে আলাদা WhatsApp নম্বর যোগ করা যাবে</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={`https://wa.me/${whatsappNumber(request.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-2 text-caption font-bold text-primary"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (rejectCustomerRegistration(request.id)) toast.success("রেজিস্ট্রেশন বাতিল করা হয়েছে");
                    }}
                    className="rounded-md border border-danger/30 px-2.5 py-2 text-caption font-bold text-danger"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (approveCustomerRegistration(request.id)) toast.success("ক্রেতা অনুমোদিত হয়েছে — ডিফল্ট পাসওয়ার্ড ১২৩৪৫৬");
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-2 text-caption font-bold text-card"
                  >
                    <Check size={14} /> গ্রহণ করুন
                  </button>
                  {masterAdmin ? (
                    <AdminActions
                      onEdit={() => setEditRegistration(request)}
                      onDelete={() => {
                        if (!window.confirm("এই রেজিস্ট্রেশন মুছে ফেলবেন?")) return;
                        if (deleteCustomerRegistration(request.id)) toast.success("রেজিস্ট্রেশন মুছে ফেলা হয়েছে");
                        else toast.error("রেজিস্ট্রেশন মুছে ফেলা যায়নি");
                      }}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {masterAdmin && customerRequests.some((request) => request.status !== "pending") ? (
        <section className="mx-4 mt-3 overflow-hidden rounded-lg border border-line bg-card">
          <div className="bg-bg px-3 py-2.5">
            <h2 className="text-body font-bold">রেজিস্ট্রেশন রেকর্ড</h2>
            <p className="text-caption text-muted">অনুমোদিত ও বাতিল রেজিস্ট্রেশন</p>
          </div>
          <ul className="divide-y divide-line">
            {customerRequests.filter((request) => request.status !== "pending").map((request) => (
              <li key={request.id} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body font-bold">{request.name}</p>
                  <p className="text-caption text-muted">{request.id}</p>
                  <p className="text-caption text-muted">{request.phone} {request.address ? `• ${request.address}` : ""}</p>
                  <p className={`text-caption ${request.status === "approved" ? "text-primary" : "text-danger"}`}>
                    {request.status === "approved" ? "অনুমোদিত" : "বাতিল"}
                  </p>
                </div>
                <AdminActions
                  onEdit={() => setEditRegistration(request)}
                  onDelete={() => {
                    if (!window.confirm("এই রেজিস্ট্রেশন রেকর্ড মুছে ফেলবেন?")) return;
                    if (deleteCustomerRegistration(request.id)) toast.success("রেজিস্ট্রেশন রেকর্ড মুছে ফেলা হয়েছে");
                    else toast.error("রেজিস্ট্রেশন রেকর্ড মুছে ফেলা যায়নি");
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-2 px-4 pt-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="নাম, আইডি বা মোবাইল"
          className="flex-1 rounded-md border border-line px-3 py-2.5 text-input"
        />
        {canEdit ? (
          <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary px-3 text-card" aria-label="নতুন ক্রেতা">
            <Plus size={18} />
          </button>
        ) : null}
      </div>
      <ul className="mt-2">
        {rows.map(({ c, due }) => (
          <li key={c.id}>
            <Link to="/customers/$id" params={{ id: c.id }} className="flex items-center gap-3 border-b border-line px-4 py-3.5">
              <div className="flex size-10 items-center justify-center rounded-full bg-mint-2 text-body font-bold text-primary">
                {c.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-body font-bold">
                  {c.name}
                  {c.active === false ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-caption font-bold text-muted">অচালু</span>
                  ) : null}
                </p>
                <p className="text-caption text-muted">{c.id}</p>
                <p className="truncate text-caption text-muted">
                  {c.phone} {c.address ? `• ${c.address}` : ""}
                </p>
              </div>
              <p className={`text-body font-bold tabular ${due > 0 ? "text-danger" : "text-primary"}`}>
                {due > 0 ? money(due) : "ক্লিয়ার"}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-heading">নতুন ক্রেতা</h2>
              <button type="button" aria-label="বন্ধ" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="মোবাইল" inputMode="tel" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <p className="text-caption text-muted">সংরক্ষণের পর মূল মোবাইল নম্বর পরিবর্তন করা যাবে না।</p>
              <input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} placeholder="আলাদা WhatsApp নম্বর (ঐচ্ছিক)" inputMode="tel" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঠিকানা" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) return toast.error("নাম দিন");
                  try {
                    addCustomer({ name: name.trim(), phone: phone.trim(), whatsappPhone, address: address.trim() });
                  } catch (error) {
                    return toast.error(error instanceof Error ? error.message : "ক্রেতা যোগ করা যায়নি");
                  }
                  setOpen(false);
                  setName("");
                  setPhone("");
                  setWhatsappPhone("");
                  setAddress("");
                  toast.success("ক্রেতা যোগ হয়েছে");
                }}
                className="w-full rounded-md bg-primary py-3 text-body font-bold text-card"
              >
                সংরক্ষণ
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {editRegistration ? (
        <RegistrationEditModal
          registration={editRegistration}
          onClose={() => setEditRegistration(null)}
          onSave={(patch) => {
            if (updateCustomerRegistration(editRegistration.id, patch)) {
              setEditRegistration(null);
              toast.success("রেজিস্ট্রেশন তথ্য আপডেট হয়েছে");
            } else {
              toast.error("রেজিস্ট্রেশন তথ্য আপডেট করা যায়নি");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function RegistrationEditModal({
  registration,
  onClose,
  onSave,
}: {
  registration: CustomerRegistration;
  onClose: () => void;
  onSave: (patch: Pick<CustomerRegistration, "name" | "address">) => void;
}) {
  const [name, setName] = useState(registration.name);
  const [address, setAddress] = useState(registration.address);
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-fg/50 p-3 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-heading">রেজিস্ট্রেশন সম্পাদনা</h2>
          <button type="button" aria-label="বন্ধ" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
          <label className="block text-caption">মূল মোবাইল (অপরিবর্তনীয়)<input value={registration.phone} readOnly className="w-full rounded-md border border-line bg-bg px-3 py-2.5 text-input" /></label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ঠিকানা" className="w-full rounded-md border border-line px-3 py-2.5 text-input" />
          <button
            type="button"
            onClick={() => {
              if (!name.trim()) return toast.error("নাম দিন");
              onSave({ name: name.trim(), address: address.trim() });
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
